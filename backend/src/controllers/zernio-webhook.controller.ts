import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config';
import { ApiError } from '../lib/errors';
import { deleteWebhookEvent, insertWebhookEvent, markWebhookProcessed, setSocialAccountStatus, updatePublicationFromWebhook } from '../lib/social-store';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.length ? value : null;
}

function validSignature(raw: Buffer, signature: string | undefined) {
  if (!config.ZERNIO_WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac('sha256', config.ZERNIO_WEBHOOK_SECRET).update(raw).digest('hex');
  const supplied = Buffer.from(signature.toLowerCase());
  const expectedBuffer = Buffer.from(expected);
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}

export const handleZernioWebhook: RequestHandler = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!validSignature(raw, req.header('x-zernio-signature') ?? req.header('x-late-signature') ?? undefined)) {
    throw new ApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Invalid webhook signature');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    throw new ApiError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Invalid webhook payload');
  }
  const body = record(payload);
  const eventId = text(body?.id) ?? req.header('x-zernio-event-id') ?? req.header('x-late-event-id');
  const eventType = text(body?.event) ?? req.header('x-zernio-event');
  if (!eventId || !eventType) throw new ApiError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook event ID and type are required');
  const inserted = await insertWebhookEvent(eventId, eventType, payload);
  if (!inserted) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    const post = record(body?.post);
    const metadata = record(post?.metadata);
    const identifier = {
      zernioPostId: text(post?._id) ?? text(post?.id) ?? text(body?.postId),
      requestKey: text(metadata?.contentlaneRequestKey),
    };
    const targets = Array.isArray(post?.platforms) ? post.platforms : [];
    const target = record(body?.platform) ?? record(targets.find((value) => record(value)?.platform === 'tiktok'));
    if (identifier.zernioPostId || identifier.requestKey) {
      if (eventType === 'post.published' || eventType === 'post.platform.published') {
        await updatePublicationFromWebhook(identifier, {
          status: 'PUBLISHED',
          platformPostId: text(target?.platformPostId),
          platformPostUrl: text(target?.publishedUrl) ?? text(target?.platformPostUrl),
        });
      } else if (eventType === 'post.failed' || eventType === 'post.platform.failed') {
        const platformError = record(target?.platformError);
        await updatePublicationFromWebhook(identifier, {
          status: 'FAILED',
          errorCode: text(target?.errorCategory) ?? text(platformError?.code),
          errorMessage: text(target?.error) ?? text(target?.errorMessage) ?? text(platformError?.message) ?? 'TikTok publishing failed',
        });
      } else if (eventType === 'post.tiktok.url_resolved') {
        await updatePublicationFromWebhook(identifier, {
          platformPostId: text(target?.platformPostId) ?? text(body?.platformPostId),
          platformPostUrl: text(target?.publishedUrl) ?? text(target?.platformPostUrl) ?? text(body?.platformPostUrl),
        });
      }
    }
    if (eventType === 'account.disconnected') {
      const account = record(body?.account);
      const accountId = text(account?.accountId) ?? text(account?._id) ?? text(account?.id) ?? text(body?.accountId);
      if (accountId) await setSocialAccountStatus({ zernioAccountId: accountId }, 'NEEDS_RECONNECTION');
    }
    await markWebhookProcessed(eventId);
    res.status(200).json({ received: true });
  } catch (error) {
    await deleteWebhookEvent(eventId);
    throw error;
  }
};

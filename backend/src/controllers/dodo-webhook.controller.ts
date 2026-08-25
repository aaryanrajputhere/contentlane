import type { RequestHandler } from 'express';
import type { Subscription } from 'dodopayments/resources/subscriptions';
import { Prisma } from '@prisma/client';
import { requireWebhookConfiguration } from '../lib/dodo';
import { ApiError } from '../lib/errors';
import prisma from '../lib/prisma';
import { getPlanByProductId } from '../lib/billing-plans';

const subscriptionEvents = new Set([
  'subscription.active',
  'subscription.updated',
  'subscription.renewed',
  'subscription.plan_changed',
  'subscription.on_hold',
  'subscription.paused',
  'subscription.cancelled',
  'subscription.failed',
  'subscription.expired',
]);

function requiredHeader(value: string | undefined, name: string) {
  if (!value) throw new ApiError(400, 'INVALID_WEBHOOK', `Missing ${name} header`);
  return value;
}

export const handleDodoWebhook: RequestHandler = async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body)) throw new ApiError(400, 'INVALID_WEBHOOK', 'Webhook body must be raw');
    const webhookId = requiredHeader(req.header('webhook-id'), 'webhook-id');
    const webhookSignature = requiredHeader(req.header('webhook-signature'), 'webhook-signature');
    const webhookTimestamp = requiredHeader(req.header('webhook-timestamp'), 'webhook-timestamp');
    const { client, webhookKey } = requireWebhookConfiguration();
    let event;
    try {
      event = client.webhooks.unwrap(req.body.toString('utf8'), {
        headers: {
          'webhook-id': webhookId,
          'webhook-signature': webhookSignature,
          'webhook-timestamp': webhookTimestamp,
        },
        key: webhookKey,
      });
    } catch {
      throw new ApiError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed');
    }

    const eventType: string = event.type;
    if (!subscriptionEvents.has(eventType)) return res.status(204).send();
    const data = event.data as Subscription;
    const eventAt = new Date(event.timestamp);
    if (Number.isNaN(eventAt.getTime())) throw new ApiError(400, 'INVALID_WEBHOOK', 'Invalid event timestamp');

    const existingEvent = await prisma.dodoWebhookEvent.findUnique({ where: { webhookId }, select: { webhookId: true } });
    if (existingEvent) return res.status(204).send();

    await prisma.$transaction(async (tx) => {
      await tx.dodoWebhookEvent.create({ data: { webhookId, eventType, eventAt } });
      if (!getPlanByProductId(data.product_id)) return;

      const metadataUserId = typeof data.metadata?.contentlane_user_id === 'string'
        ? data.metadata.contentlane_user_id
        : undefined;
      const user = metadataUserId
        ? await tx.user.findUnique({ where: { id: metadataUserId }, select: { id: true } })
        : await tx.user.findFirst({ where: { dodoCustomerId: data.customer.customer_id }, select: { id: true } });
      if (!user) return;

      const current = await tx.subscription.findUnique({
        where: { dodoSubscriptionId: data.subscription_id },
        select: { latestProviderEventAt: true, scheduledDodoProductId: true },
      });
      if (current && current.latestProviderEventAt >= eventAt) return;

      const status = eventType === 'subscription.paused' ? 'paused' : data.status;
      await tx.user.update({ where: { id: user.id }, data: { dodoCustomerId: data.customer.customer_id } });
      if (status === 'active') {
        await tx.$executeRaw`UPDATE "User" SET "freeAccessEndedAt" = COALESCE("freeAccessEndedAt", NOW()) WHERE "id" = ${user.id}`;
      }
      await tx.subscription.upsert({
        where: { dodoSubscriptionId: data.subscription_id },
        create: {
          userId: user.id,
          dodoCustomerId: data.customer.customer_id,
          dodoSubscriptionId: data.subscription_id,
          dodoProductId: data.product_id,
          status,
          currentPeriodStart: new Date(data.previous_billing_date),
          currentPeriodEnd: new Date(data.next_billing_date),
          cancelAtNextBillingDate: data.cancel_at_next_billing_date,
          latestProviderEventAt: eventAt,
          scheduledDodoProductId: current?.scheduledDodoProductId === data.product_id ? null : current?.scheduledDodoProductId,
        },
        update: {
          userId: user.id,
          dodoCustomerId: data.customer.customer_id,
          dodoProductId: data.product_id,
          status,
          currentPeriodStart: new Date(data.previous_billing_date),
          currentPeriodEnd: new Date(data.next_billing_date),
          cancelAtNextBillingDate: data.cancel_at_next_billing_date,
          latestProviderEventAt: eventAt,
          scheduledDodoProductId: current?.scheduledDodoProductId === data.product_id ? null : current?.scheduledDodoProductId,
        },
      });
    });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(204).send();
      return;
    }
    next(error);
  }
};

import type { Request, RequestHandler } from 'express';
import prisma from '../lib/prisma';
import { config } from '../config';
import { ApiError } from '../lib/errors';
import {
  socialAccountParamsSchema,
  socialPublicationParamsSchema,
  projectIdParamsSchema,
  tiktokMusicQuerySchema,
  tiktokPublishSchema,
} from '../domain/schemas';
import {
  createZernioPost,
  createZernioProfile,
  deleteZernioAccount,
  getTikTokConnectUrl,
  getTikTokCreatorInfo,
  getZernioAnalytics,
  listTikTokMusic,
  listZernioAccounts,
  validateZernioMedia,
  validateZernioPost,
} from '../lib/zernio';
import {
  createSocialProfile,
  createSocialPublication,
  findOwnedPublication,
  findPublicationByRequestKey,
  findSocialAccount,
  findSocialProfile,
  listSocialPublications,
  setPublicationFailed,
  setPublicationProviderResult,
  setPublicationPublishing,
  setSocialAccountStatus,
  updatePublicationAnalytics,
  upsertSocialAccount,
  type PublicationStatus,
} from '../lib/social-store';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function requireTikTokAccess(role: 'USER' | 'ADMIN') {
  const rollout = config.ZERNIO_TIKTOK_ROLLOUT;
  if (rollout === 'off' || (rollout === 'internal' && role !== 'ADMIN')) {
    throw new ApiError(404, 'NOT_FOUND', 'TikTok publishing is not available yet');
  }
}

async function ensureSocialProfile(userId: string) {
  const existing = await findSocialProfile(userId);
  if (existing) return existing;
  const created = await createZernioProfile(`ContentLane ${userId}`, `contentlane-profile-${userId}`);
  return createSocialProfile(userId, created.profile._id);
}

function remoteAccountData(value: unknown) {
  const item = record(value);
  const id = stringValue(item?._id) ?? stringValue(item?.id);
  if (!item || !id || item.platform !== 'tiktok') return null;
  const metadata = record(item.metadata);
  const active = item.isActive !== false && item.needsReconnection !== true;
  return {
    zernioAccountId: id,
    username: stringValue(item.username),
    displayName: stringValue(item.displayName),
    avatarUrl: stringValue(item.profilePicture) ?? stringValue(item.avatarUrl),
    countryCode: stringValue(item.countryCode) ?? stringValue(metadata?.countryCode),
    connectionStatus: active ? 'CONNECTED' as const : 'NEEDS_RECONNECTION' as const,
    metadata: item,
  };
}

async function reconcileTikTokAccount(userId: string) {
  const profile = await ensureSocialProfile(userId);
  const remote = await listZernioAccounts(profile.zernioProfileId);
  const account = (remote.accounts ?? []).map(remoteAccountData).find((item) => item !== null);
  if (!account) {
    await setSocialAccountStatus({ userId }, 'DISCONNECTED');
    return findSocialAccount(userId);
  }
  return upsertSocialAccount({ ...account, userId, socialProfileId: profile.id });
}

function musicTrack(value: unknown) {
  const item = record(value);
  if (!item) return null;
  const clip = record(item.clip);
  const id = stringValue(item.id) ?? stringValue(clip?.id);
  const title = stringValue(item.name) ?? stringValue(item.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    artist: stringValue(item.artist) ?? 'Unknown artist',
    durationSeconds: numberValue(item.durationSec) ?? numberValue(clip?.durationSec),
    previewUrl: stringValue(clip?.previewUrl) ?? stringValue(item.previewUrl),
    thumbnailUrl: stringValue(item.thumbnailUrl),
    rank: numberValue(item.rank),
    genres: Array.isArray(item.genres) ? item.genres.filter((genre): genre is string => typeof genre === 'string') : [],
  };
}

async function ownedAccount(userId: string, id: string) {
  const account = await findSocialAccount(userId, id);
  if (!account) throw new ApiError(404, 'SOCIAL_ACCOUNT_NOT_FOUND', 'TikTok account not found');
  if (account.connectionStatus !== 'CONNECTED') {
    throw new ApiError(409, 'SOCIAL_ACCOUNT_RECONNECT', 'Reconnect TikTok before continuing');
  }
  return account;
}

function reelFromResult(result: unknown, conceptId: string) {
  const reels = record(result)?.reels;
  if (!Array.isArray(reels)) return null;
  for (const value of reels) {
    const item = record(value);
    if (item?.conceptId === conceptId && typeof item.url === 'string') return item.url;
  }
  return null;
}

function buildPostBody(input: ReturnType<typeof tiktokPublishSchema.parse>, accountId: string, sourceUrl: string) {
  const musicSoundInfo = input.music ? {
    musicSoundId: input.music.id,
    musicSoundVolume: input.music.musicVolume,
    musicSoundStart: input.music.startMs,
    ...(input.music.endMs === null ? {} : { musicSoundEnd: input.music.endMs }),
  } : undefined;
  return {
    content: input.caption,
    metadata: { contentlaneRequestKey: input.requestKey },
    mediaItems: [{ type: 'video', url: sourceUrl }],
    platforms: [{ platform: 'tiktok', accountId }],
    tiktokSettings: {
      privacy_level: 'PUBLIC_TO_EVERYONE',
      allow_comment: input.settings.allowComment,
      allow_duet: input.settings.allowDuet,
      allow_stitch: input.settings.allowStitch,
      commercialContentType: input.settings.commercialContentType,
      content_preview_confirmed: input.settings.contentPreviewConfirmed,
      express_consent_given: input.settings.expressConsentGiven,
      ...(musicSoundInfo ? { musicSoundInfo, videoOriginalSoundVolume: input.music?.originalVolume ?? 50 } : {}),
    },
    publishNow: true,
  };
}

function providerPost(value: unknown) {
  const post = record(record(value)?.post);
  const platforms = Array.isArray(post?.platforms) ? post.platforms : [];
  const target = record(platforms.find((item) => record(item)?.platform === 'tiktok'));
  const rawStatus = stringValue(target?.status) ?? stringValue(post?.status) ?? 'publishing';
  const status: PublicationStatus = rawStatus === 'published' ? 'PUBLISHED'
    : rawStatus === 'failed' ? 'FAILED'
      : 'PUBLISHING';
  return {
    id: stringValue(post?._id) ?? stringValue(post?.id),
    status,
    platformPostId: stringValue(target?.platformPostId),
    platformPostUrl: stringValue(target?.platformPostUrl),
    errorMessage: stringValue(target?.errorMessage),
  };
}

function preflightError(value: unknown) {
  const result = record(value);
  if (result?.valid !== false) return null;
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const messages = errors.flatMap((error) => {
    if (typeof error === 'string') return [error];
    const item = record(error);
    return [stringValue(item?.message) ?? stringValue(item?.error)].filter((message): message is string => message !== null);
  });
  return messages.join(' ') || 'TikTok rejected the publishing settings';
}

function assertPreflight(media: unknown, post: unknown) {
  const message = preflightError(media) ?? preflightError(post);
  if (message) throw new ApiError(422, 'TIKTOK_PREFLIGHT_FAILED', message);
}

export const listSocialAccounts: RequestHandler = async (req, res) => {
  requireTikTokAccess(req.user!.role);
  const account = await reconcileTikTokAccount(req.user!.id);
  res.json({ accounts: account ? [account] : [], rollout: config.ZERNIO_TIKTOK_ROLLOUT });
};

export const connectTikTok: RequestHandler = async (req, res) => {
  requireTikTokAccess(req.user!.role);
  const profile = await ensureSocialProfile(req.user!.id);
  const redirectUrl = `${config.FRONTEND_URL}/social-accounts?connected=tiktok`;
  const result = await getTikTokConnectUrl(profile.zernioProfileId, redirectUrl);
  res.json({ authUrl: result.authUrl });
};

export const disconnectTikTok: RequestHandler = async (req, res) => {
  requireTikTokAccess(req.user!.role);
  const { accountId } = socialAccountParamsSchema.parse(req.params);
  const account = await ownedAccount(req.user!.id, accountId);
  await deleteZernioAccount(account.zernioAccountId);
  await setSocialAccountStatus({ id: account.id }, 'DISCONNECTED');
  res.status(204).send();
};

export const getTikTokMusic: RequestHandler = async (req, res) => {
  requireTikTokAccess(req.user!.role);
  const { accountId } = socialAccountParamsSchema.parse(req.params);
  const { countryCode } = tiktokMusicQuerySchema.parse(req.query);
  const account = await ownedAccount(req.user!.id, accountId);
  const result = await listTikTokMusic(account.zernioAccountId, countryCode);
  res.json({ tracks: (result.tracks ?? []).map(musicTrack).filter((track) => track !== null), countryCode });
};

export const getTikTokPublishingOptions: RequestHandler = async (req, res) => {
  requireTikTokAccess(req.user!.role);
  const { accountId } = socialAccountParamsSchema.parse(req.params);
  const account = await ownedAccount(req.user!.id, accountId);
  res.json({ creator: await getTikTokCreatorInfo(account.zernioAccountId) });
};

async function preparePublication(req: Request) {
  requireTikTokAccess(req.user!.role);
  const { id: projectId } = projectIdParamsSchema.parse(req.params);
  const input = tiktokPublishSchema.parse(req.body);
  const account = await ownedAccount(req.user!.id, input.socialAccountId);
  const job = await prisma.generationJob.findFirst({
    where: { id: input.renderJobId, project: { id: projectId, userId: req.user!.id }, type: 'RENDER_REELS', status: 'COMPLETED' },
  });
  const sourceUrl = job ? reelFromResult(job.result, input.conceptId) : null;
  if (!job || !sourceUrl) throw new ApiError(404, 'RENDER_NOT_FOUND', 'The finished video could not be found');
  const concept = await prisma.hookConcept.findFirst({ where: { id: input.conceptId, projectId } });
  if (!concept) throw new ApiError(404, 'CONCEPT_NOT_FOUND', 'The video concept could not be found');
  return { input, account, job, sourceUrl, postBody: buildPostBody(input, account.zernioAccountId, sourceUrl) };
}

export const validateTikTokPublication: RequestHandler = async (req, res) => {
  const prepared = await preparePublication(req);
  const [media, post] = await Promise.all([
    validateZernioMedia(prepared.sourceUrl),
    validateZernioPost(prepared.postBody),
  ]);
  assertPreflight(media, post);
  res.json({ valid: true, media, post });
};

export const publishTikTok: RequestHandler = async (req, res) => {
  const prepared = await preparePublication(req);
  const { id: projectId } = projectIdParamsSchema.parse(req.params);
  const existing = await findPublicationByRequestKey(prepared.input.requestKey);
  if (existing) {
    if (existing.projectId !== projectId || existing.socialAccountId !== prepared.account.id) {
      throw new ApiError(409, 'REQUEST_KEY_CONFLICT', 'This publishing request key has already been used');
    }
    if (existing.status !== 'FAILED') {
      res.status(existing.status === 'PUBLISHED' ? 200 : 202).json({ publication: existing });
      return;
    }
  }
  const publication = existing ?? await createSocialPublication({
    requestKey: prepared.input.requestKey,
    projectId,
    conceptId: prepared.input.conceptId,
    renderJobId: prepared.job.id,
    socialAccountId: prepared.account.id,
    sourceUrl: prepared.sourceUrl,
    caption: prepared.input.caption,
    music: prepared.input.music,
    settings: prepared.input.settings,
  });
  try {
    const [media, post] = await Promise.all([validateZernioMedia(prepared.sourceUrl), validateZernioPost(prepared.postBody)]);
    assertPreflight(media, post);
    await setPublicationPublishing(publication.id);
    const result = providerPost(await createZernioPost(prepared.postBody, prepared.input.requestKey));
    const updated = await setPublicationProviderResult(publication.id, { status: result.status, zernioPostId: result.id, platformPostId: result.platformPostId, platformPostUrl: result.platformPostUrl, errorMessage: result.errorMessage });
    res.status(updated.status === 'PUBLISHED' ? 201 : 202).json({ publication: updated });
  } catch (error) {
    await setPublicationFailed(publication.id, error instanceof ApiError ? error.code : 'PUBLISH_FAILED', error instanceof Error ? error.message : 'Publishing failed');
    throw error;
  }
};

export const listProjectPublications: RequestHandler = async (req, res) => {
  requireTikTokAccess(req.user!.role);
  const { id: projectId } = projectIdParamsSchema.parse(req.params);
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: req.user!.id }, select: { id: true } });
  if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  const publications = await listSocialPublications(project.id);
  res.json({ publications });
};

export const getPublicationAnalytics: RequestHandler = async (req, res) => {
  requireTikTokAccess(req.user!.role);
  const { publicationId } = socialPublicationParamsSchema.parse(req.params);
  const publication = await findOwnedPublication(publicationId, req.user!.id);
  if (!publication) throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Published video not found');
  if (!publication.zernioPostId) throw new ApiError(409, 'ANALYTICS_NOT_READY', 'Analytics will appear after TikTok accepts the post');
  const fresh = publication.analyticsSyncedAt && Date.now() - publication.analyticsSyncedAt.getTime() < 15 * 60 * 1000;
  if (fresh && publication.analytics) {
    res.json({ analytics: publication.analytics, syncedAt: publication.analyticsSyncedAt, cached: true });
    return;
  }
  const analytics = await getZernioAnalytics(publication.zernioPostId);
  const updated = await updatePublicationAnalytics(publication.id, analytics);
  res.json({ analytics, syncedAt: updated.analyticsSyncedAt, cached: false });
};

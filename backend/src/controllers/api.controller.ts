import { randomUUID } from 'node:crypto';
import { JobType, UsageStatus } from '@prisma/client';
import type { RequestHandler } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { getQuota, settleQuota } from '../lib/quota';
import { createGenerationJob, publicJob } from '../services/jobs';
import { stableKey, parseScenes } from '../services/providers';

const auth = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

export const analyzeCampaign: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const url = new URL(req.body.website as string); url.hash = ''; url.hostname = url.hostname.toLowerCase();
  const website = url.toString(); const websiteKey = `${url.hostname}${url.pathname.replace(/\/$/, '')}`.toLowerCase();
  let campaign = await prisma.campaign.findUnique({ where: { userId_websiteKey: { userId, websiteKey } }, include: { brandContext: true, products: true } });
  if (campaign?.status === 'COMPLETED' && !req.body.forceRegenerate) return res.json({ campaignId: campaign.id, brandContext: campaign.brandContext, products: campaign.products, cached: true });
  campaign = await prisma.campaign.upsert({ where: { userId_websiteKey: { userId, websiteKey } }, update: { website, status: 'ANALYZING' }, create: { userId, website, websiteKey, status: 'ANALYZING' }, include: { brandContext: true, products: true } });
  const idempotencyKey = req.body.forceRegenerate ? randomUUID() : req.body.idempotencyKey ?? stableKey({ websiteKey });
  const job = await createGenerationJob({ userId, campaignId: campaign.id, type: JobType.CAMPAIGN_ANALYSIS, input: { website, forceRegenerate: req.body.forceRegenerate }, idempotencyKey });
  res.status(202).json({ job: publicJob(job), campaignId: campaign.id });
};

export const getCampaign: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const campaignId = String(req.params.id);
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId }, include: { brandContext: true, products: true } });
  if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
  res.json({ campaignId: campaign.id, website: campaign.website, status: campaign.status, brandContext: campaign.brandContext, products: campaign.products });
};

export const createHooksJob: RequestHandler = async (req, res) => {
  auth(req);
  res.status(410).json({ error: { code: 'AI_HOOK_GENERATION_DISABLED', message: 'AI hook generation is disabled. Use admin-created hooks.' } });
};

export const listScripts: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const campaign = await prisma.campaign.findFirst({ where: { id: String(req.params.id), userId }, select: { id: true } });
  if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
  res.json(await prisma.scriptGeneration.findMany({ where: { campaignId: campaign.id, productId: req.query.productId as string | undefined }, orderBy: { createdAt: 'desc' } }));
};

export const getScript: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const script = await prisma.scriptGeneration.findFirst({ where: { id: String(req.params.id), campaign: { userId } }, include: { product: true, campaign: { include: { brandContext: true } } } });
  if (!script) throw new ApiError(404, 'NOT_FOUND', 'Script not found');
  res.json(script);
};

export const createScriptJob: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const product = await prisma.product.findFirst({ where: { id: req.body.productId, campaignId: req.body.campaignId, campaign: { userId } } });
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found');
  const job = await createGenerationJob({ userId, campaignId: req.body.campaignId, type: JobType.SCRIPT_GENERATION, input: { productId: product.id, hooks: req.body.hooks, character: req.body.character ?? null, productImageUrl: product.imageUrls[0] ?? null, characterImageUrl: req.body.characterImageUrl ?? null }, idempotencyKey: req.body.idempotencyKey });
  res.status(202).json({ job: publicJob(job) });
};

const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const stringField = (value: unknown, key: string) => {
  const record = asRecord(value);
  const field = record?.[key];
  return typeof field === 'string' && field.trim() ? field : null;
};

function jobResultContainsScript(result: unknown, scriptId: string) {
  const scripts = asRecord(result)?.scripts;
  return Array.isArray(scripts) && scripts.some(item => stringField(item, 'id') === scriptId);
}

async function findScriptCharacterImageUrl(script: { id: string; campaignId: string; productId: string }) {
  const jobs = await prisma.generationJob.findMany({
    where: { campaignId: script.campaignId, type: JobType.SCRIPT_GENERATION, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { input: true, result: true },
  });
  const matchingJob = jobs.find(job => jobResultContainsScript(job.result, script.id))
    ?? jobs.find(job => stringField(job.input, 'productId') === script.productId && stringField(job.input, 'characterImageUrl'));
  return stringField(matchingJob?.input, 'characterImageUrl');
}

const mediaJob = (type: JobType): RequestHandler => async (req, res) => {
  const { userId } = auth(req);
  const script = await prisma.scriptGeneration.findFirst({
    where: { id: String(req.params.id), campaign: { userId } },
    include: { product: { select: { imageUrls: true } } },
  });
  if (!script) throw new ApiError(404, 'NOT_FOUND', 'Script not found');
  const scenes = parseScenes(script.scenes);
  const characterImageUrl = req.body.characterImageUrl ?? await findScriptCharacterImageUrl(script);
  const job = await createGenerationJob({
    userId,
    campaignId: script.campaignId,
    scriptId: script.id,
    type,
    input: {
      characterImageUrl,
      productImageUrl: req.body.productImageUrl ?? script.product.imageUrls[0] ?? null,
    },
    idempotencyKey: req.body.idempotencyKey,
    quotaUnits: scenes.length,
  });
  res.status(202).json({ job: publicJob(job) });
};
export const createImageJob = mediaJob(JobType.IMAGE_GENERATION);
export const createVideoJob = mediaJob(JobType.VIDEO_GENERATION);

export const deleteScript: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const result = await prisma.scriptGeneration.deleteMany({ where: { id: String(req.params.id), campaign: { userId } } });
  if (!result.count) throw new ApiError(404, 'NOT_FOUND', 'Script not found');
  res.status(204).end();
};

export const getJob: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const job = await prisma.generationJob.findFirst({ where: { id: String(req.params.id), userId } });
  if (!job) throw new ApiError(404, 'NOT_FOUND', 'Job not found');
  res.json({ job: publicJob(job) });
};

export const cancelJob: RequestHandler = async (req, res) => {
  const { userId } = auth(req);
  const job = await prisma.generationJob.findFirst({ where: { id: String(req.params.id), userId } });
  if (!job) throw new ApiError(404, 'NOT_FOUND', 'Job not found');
  if (job.status === 'QUEUED') {
    await prisma.generationJob.update({ where: { id: job.id }, data: { status: 'CANCELLED', cancelRequestedAt: new Date(), completedAt: new Date(), progressMessage: 'Cancelled' } });
    await settleQuota(job.id, UsageStatus.RELEASED);
  } else if (job.status === 'ACTIVE') {
    await prisma.generationJob.update({ where: { id: job.id }, data: { cancelRequestedAt: new Date(), progressMessage: 'Cancellation requested' } });
  }
  res.status(202).json({ jobId: job.id, cancellationRequested: true });
};

export const quota: RequestHandler = async (req, res) => res.json({ quota: await getQuota(auth(req).userId) });

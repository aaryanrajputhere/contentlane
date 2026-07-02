import { JobStatus, JobType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { generationQueue } from '../lib/queue';
import { quotaForJob, reserveQuota } from '../lib/quota';
import { stableKey } from './providers';

interface CreateJobInput { userId: string; type: JobType; campaignId?: string; scriptId?: string; input: Prisma.InputJsonValue; idempotencyKey?: string; quotaUnits?: number }

export async function createGenerationJob(values: CreateJobInput) {
  const idempotencyKey = values.idempotencyKey ?? stableKey({ type: values.type, campaignId: values.campaignId, scriptId: values.scriptId, input: values.input });
  const existing = await prisma.generationJob.findUnique({ where: { userId_type_idempotencyKey: { userId: values.userId, type: values.type, idempotencyKey } } });
  if (existing) return existing;
  const job = await prisma.generationJob.create({ data: { userId: values.userId, type: values.type, campaignId: values.campaignId, scriptId: values.scriptId, input: values.input, idempotencyKey } });
  try {
    const quota = quotaForJob(values.type, values.quotaUnits ?? 1);
    if (quota) await reserveQuota(values.userId, job.id, quota.category, quota.units);
    await generationQueue.add(values.type, { generationJobId: job.id }, { jobId: job.id, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 });
    return job;
  } catch (error) {
    await prisma.generationJob.delete({ where: { id: job.id } }).catch(() => undefined);
    throw error;
  }
}

export const publicJob = (job: { id: string; type: JobType; status: JobStatus; progress: number; progressMessage: string | null; result: Prisma.JsonValue | null; errorCode: string | null; errorMessage: string | null; campaignId: string | null; scriptId: string | null; createdAt: Date; updatedAt: Date }) => job;

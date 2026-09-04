import { JobStatus, JobType, Prisma, RenderUsageStatus, type UserRole } from '@prisma/client';
import prisma from './prisma';
import { ApiError } from './errors';
import { getRecognizedProductIds } from './billing-plans';
import { getEffectiveAccess } from './access';

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getActiveSubscription(userId: string, db: DbClient = prisma) {
  return db.subscription.findFirst({
    where: { userId, status: 'active', dodoProductId: { in: getRecognizedProductIds() } },
    orderBy: [{ latestProviderEventAt: 'desc' }, { updatedAt: 'desc' }],
  });
}

export async function getRenderUsage(userId: string, role: UserRole, db: DbClient = prisma) {
  const access = await getEffectiveAccess(userId, role, db);
  if (access.source === 'admin') {
    return { limit: null, consumed: 0, reserved: 0, remaining: null, periodStart: null, periodEnd: null };
  }
  if (access.source === 'none') return { limit: 0, consumed: 0, reserved: 0, remaining: 0, periodStart: null, periodEnd: null };
  const now = new Date();
  const periodStart = access.source === 'subscription' ? access.subscription.currentPeriodStart : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = access.source === 'subscription' ? access.subscription.currentPeriodEnd : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  if (!periodStart || !periodEnd) return { limit: access.plan.videoLimit, consumed: 0, reserved: 0, remaining: 0, periodStart, periodEnd };
  const reservations = await db.renderUsageReservation.findMany({
    where: {
      userId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      status: { in: [RenderUsageStatus.RESERVED, RenderUsageStatus.CONSUMED] },
    },
    select: { requestedCount: true, consumedCount: true, status: true },
  });
  const consumed = reservations.reduce((total, item) => total + (item.status === RenderUsageStatus.CONSUMED ? item.consumedCount : 0), 0);
  const reserved = reservations.reduce((total, item) => total + (item.status === RenderUsageStatus.RESERVED ? item.requestedCount : 0), 0);
  return {
    limit: access.plan.videoLimit,
    consumed,
    reserved,
    remaining: Math.max(0, access.plan.videoLimit - consumed - reserved),
    periodStart,
    periodEnd,
  };
}

export async function createReservedRenderJob(input: {
  userId: string;
  role: UserRole;
  projectId: string;
  renderInput: Prisma.InputJsonValue;
  requestedCount: number;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`;
    const job = await tx.generationJob.create({
      data: { projectId: input.projectId, type: JobType.RENDER_REELS, input: input.renderInput, status: JobStatus.QUEUED, progress: 0 },
    });
    const access = await getEffectiveAccess(input.userId, input.role, tx);
    if (access.source === 'admin') return job;
    if (access.source === 'none') throw new ApiError(402, 'SUBSCRIPTION_REQUIRED', 'An active ContentLane subscription or complimentary grant is required');
    const usage = await getRenderUsage(input.userId, input.role, tx);
    if (!usage.periodStart || !usage.periodEnd) {
      throw new ApiError(409, 'BILLING_PERIOD_UNAVAILABLE', 'Your billing period is still syncing. Try again shortly.');
    }
    if (usage.remaining === null || input.requestedCount > usage.remaining) {
      throw new ApiError(402, 'VIDEO_LIMIT_REACHED', `This render needs ${input.requestedCount} videos, but your ${access.plan.name} plan has ${usage.remaining ?? 0} remaining this period.`);
    }
    await tx.renderUsageReservation.create({
      data: {
        userId: input.userId,
        generationJobId: job.id,
        billingPeriodStart: usage.periodStart,
        billingPeriodEnd: usage.periodEnd,
        requestedCount: input.requestedCount,
      },
    });
    return job;
  });
}

export async function consumeRenderReservation(generationJobId: string, consumedCount: number, db: DbClient = prisma) {
  await db.renderUsageReservation.updateMany({
    where: { generationJobId, status: RenderUsageStatus.RESERVED },
    data: { status: RenderUsageStatus.CONSUMED, consumedCount },
  });
}

export async function releaseRenderReservation(generationJobId: string, db: DbClient = prisma) {
  await db.renderUsageReservation.updateMany({
    where: { generationJobId, status: RenderUsageStatus.RESERVED },
    data: { status: RenderUsageStatus.RELEASED, consumedCount: 0 },
  });
}

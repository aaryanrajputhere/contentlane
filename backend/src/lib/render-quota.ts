import { JobStatus, JobType, Prisma, RenderUsageStatus, type UserRole } from '@prisma/client';
import prisma from './prisma';
import { ApiError } from './errors';
import { getPlanByProductId, getRecognizedProductIds } from './billing-plans';

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getActiveSubscription(userId: string, db: DbClient = prisma) {
  return db.subscription.findFirst({
    where: { userId, status: 'active', dodoProductId: { in: getRecognizedProductIds() } },
    orderBy: [{ latestProviderEventAt: 'desc' }, { updatedAt: 'desc' }],
  });
}

export async function getRenderUsage(userId: string, role: UserRole, db: DbClient = prisma) {
  if (role === 'ADMIN') {
    return { limit: null, consumed: 0, reserved: 0, remaining: null, periodStart: null, periodEnd: null };
  }
  const subscription = await getActiveSubscription(userId, db);
  if (!subscription) return { limit: 0, consumed: 0, reserved: 0, remaining: 0, periodStart: null, periodEnd: null };
  const plan = getPlanByProductId(subscription.dodoProductId);
  if (!plan || !subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
    return { limit: plan?.videoLimit ?? 0, consumed: 0, reserved: 0, remaining: 0, periodStart: subscription.currentPeriodStart, periodEnd: subscription.currentPeriodEnd };
  }
  const reservations = await db.renderUsageReservation.findMany({
    where: {
      userId,
      billingPeriodStart: subscription.currentPeriodStart,
      billingPeriodEnd: subscription.currentPeriodEnd,
      status: { in: [RenderUsageStatus.RESERVED, RenderUsageStatus.CONSUMED] },
    },
    select: { requestedCount: true, consumedCount: true, status: true },
  });
  const consumed = reservations.reduce((total, item) => total + (item.status === RenderUsageStatus.CONSUMED ? item.consumedCount : 0), 0);
  const reserved = reservations.reduce((total, item) => total + (item.status === RenderUsageStatus.RESERVED ? item.requestedCount : 0), 0);
  return {
    limit: plan.videoLimit,
    consumed,
    reserved,
    remaining: Math.max(0, plan.videoLimit - consumed - reserved),
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
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
    if (input.role === 'ADMIN') return job;

    const subscription = await getActiveSubscription(input.userId, tx);
    const plan = subscription ? getPlanByProductId(subscription.dodoProductId) : null;
    if (!subscription || !plan) throw new ApiError(402, 'SUBSCRIPTION_REQUIRED', 'An active ContentLane subscription is required');
    if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
      throw new ApiError(409, 'BILLING_PERIOD_UNAVAILABLE', 'Your billing period is still syncing. Try again shortly.');
    }
    const usage = await getRenderUsage(input.userId, input.role, tx);
    if (usage.remaining === null || input.requestedCount > usage.remaining) {
      throw new ApiError(402, 'VIDEO_LIMIT_REACHED', `This render needs ${input.requestedCount} videos, but your ${plan.name} plan has ${usage.remaining ?? 0} remaining this billing period.`);
    }
    await tx.renderUsageReservation.create({
      data: {
        userId: input.userId,
        generationJobId: job.id,
        billingPeriodStart: subscription.currentPeriodStart,
        billingPeriodEnd: subscription.currentPeriodEnd,
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

import { Prisma, JobType, UsageStatus, UserRole } from '@prisma/client';
import prisma from './prisma';
import { ApiError } from './errors';

const limits: Record<string, number> = { campaign_analysis: 3, script_generation: 10, media_scene: 20 };
const unlimitedQuota = Number.MAX_SAFE_INTEGER;

export const quotaForJob = (type: JobType, units: number) => {
  if (type === JobType.CAMPAIGN_ANALYSIS) return { category: 'campaign_analysis', units: 1 };
  if (type === JobType.SCRIPT_GENERATION) return { category: 'script_generation', units: 1 };
  if (type === JobType.IMAGE_GENERATION || type === JobType.VIDEO_GENERATION) return { category: 'media_scene', units };
  return null;
};

const monthStart = () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

async function isAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === UserRole.ADMIN;
}

export async function reserveQuota(userId: string, jobId: string, category: string, units: number) {
  if (await isAdmin(userId)) return;
  const periodStart = monthStart();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.$transaction(async tx => {
        const aggregate = await tx.usageEvent.aggregate({ where: { userId, category, periodStart, status: { in: [UsageStatus.RESERVED, UsageStatus.CONSUMED] } }, _sum: { units: true } });
        if ((aggregate._sum.units ?? 0) + units > limits[category]) throw new ApiError(429, 'QUOTA_EXCEEDED', `Monthly ${category.replace('_', ' ')} allowance exceeded`);
        await tx.usageEvent.create({ data: { userId, jobId, category, units, periodStart } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return;
    } catch (error) {
      if (error instanceof ApiError || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 2) throw error;
    }
  }
}

export const settleQuota = (jobId: string, status: UsageStatus) => prisma.usageEvent.updateMany({ where: { jobId, status: UsageStatus.RESERVED }, data: { status } });

export async function getQuota(userId: string) {
  const periodStart = monthStart();
  const rows = await prisma.usageEvent.groupBy({ by: ['category'], where: { userId, periodStart, status: { in: [UsageStatus.RESERVED, UsageStatus.CONSUMED] } }, _sum: { units: true } });
  const admin = await isAdmin(userId);
  return Object.fromEntries(Object.entries(limits).map(([category, limit]) => {
    const used = rows.find(row => row.category === category)?._sum.units ?? 0;
    if (admin) return [category, { limit: unlimitedQuota, used, remaining: unlimitedQuota }];
    return [category, { limit, used, remaining: Math.max(0, limit - used) }];
  }));
}

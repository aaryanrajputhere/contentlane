import type { Prisma, UserRole } from '@prisma/client';
import prisma from './prisma';
import { ApiError } from './errors';
import { getPlan, getPlanByProductId, getRecognizedProductIds, type BillingPlan } from './billing-plans';

export const FREE_HOOK_SELECTION_LIMIT = 8;

type DbClient = Prisma.TransactionClient | typeof prisma;

export type EffectiveAccess =
  | { source: 'admin'; plan: null; subscription: null; complimentaryAccess: null }
  | { source: 'subscription'; plan: BillingPlan; subscription: { currentPeriodStart: Date | null; currentPeriodEnd: Date | null }; complimentaryAccess: null }
  | { source: 'complimentary'; plan: BillingPlan; subscription: null; complimentaryAccess: { startsAt: Date; expiresAt: Date | null } }
  | { source: 'none'; plan: null; subscription: null; complimentaryAccess: null };

export async function getEffectiveAccess(userId: string, role: UserRole, db: DbClient = prisma, now = new Date()): Promise<EffectiveAccess> {
  if (role === 'ADMIN') return { source: 'admin', plan: null, subscription: null, complimentaryAccess: null };
  const subscription = await db.subscription.findFirst({
    where: { userId, dodoProductId: { in: getRecognizedProductIds() }, status: 'active' },
    orderBy: [{ latestProviderEventAt: 'desc' }, { updatedAt: 'desc' }],
    select: { dodoProductId: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  const subscriptionPlan = subscription ? getPlanByProductId(subscription.dodoProductId) : null;
  if (subscription && subscriptionPlan) return { source: 'subscription', plan: subscriptionPlan, subscription, complimentaryAccess: null };

  const complimentaryRows = await db.$queryRaw<Array<{ planId: string; startsAt: Date; expiresAt: Date | null }>>`
    SELECT "planId", "startsAt", "expiresAt" FROM "ComplimentaryAccess"
    WHERE "userId" = ${userId} AND "revokedAt" IS NULL AND "startsAt" <= ${now}
      AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
    LIMIT 1
  `;
  const complimentaryAccess = complimentaryRows[0];
  if (complimentaryAccess && (complimentaryAccess.planId === 'starter' || complimentaryAccess.planId === 'pro')) {
    return { source: 'complimentary', plan: getPlan(complimentaryAccess.planId), subscription: null, complimentaryAccess };
  }
  return { source: 'none', plan: null, subscription: null, complimentaryAccess: null };
}

export async function hasFullAccess(userId: string, role: UserRole, db: DbClient = prisma) {
  return (await getEffectiveAccess(userId, role, db)).source !== 'none';
}

export async function hasPaidAccess(userId: string, role: UserRole, db: DbClient = prisma) {
  return hasFullAccess(userId, role, db);
}

export async function getFreeAccess(userId: string, db: DbClient = prisma) {
  const rows = await db.$queryRaw<Array<{
    freeHookLimit: number;
    freeAccessEndedAt: Date | null;
    projectId: string | null;
    generated: bigint;
    reviewed: bigint;
    selected: bigint;
  }>>`
    SELECT u."freeHookLimit", u."freeAccessEndedAt", p."id" AS "projectId",
      COUNT(h."id") AS generated,
      COUNT(h."id") FILTER (WHERE h."reviewDecision" IS NOT NULL) AS reviewed,
      COUNT(h."id") FILTER (WHERE h."reviewDecision" = 'LIKED') AS selected
    FROM "User" u
    LEFT JOIN "Project" p ON p."freeOnboardingOwnerId" = u."id"
    LEFT JOIN "HookDraft" h ON h."projectId" = p."id"
    WHERE u."id" = ${userId}
    GROUP BY u."id", p."id"
  `;
  const user = rows[0];
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
  const generated = Number(user.generated);
  const reviewed = Number(user.reviewed);
  const selected = Number(user.selected);
  const ended = user.freeHookLimit <= 0 || user.freeAccessEndedAt !== null;
  const conversionRequired = selected >= FREE_HOOK_SELECTION_LIMIT
    || (generated >= user.freeHookLimit && reviewed >= generated && generated > 0);
  return {
    projectId: user.projectId,
    limit: user.freeHookLimit,
    generated,
    reviewed,
    selected,
    remaining: Math.max(0, user.freeHookLimit - generated),
    conversionRequired,
    ended,
  };
}

export async function requirePaidAccess(userId: string, role: UserRole) {
  if (!await hasFullAccess(userId, role)) {
    throw new ApiError(402, 'UPGRADE_REQUIRED', 'Start a subscription to unlock this feature');
  }
}

export async function requireFreeProjectAccess(userId: string, projectId: string) {
  const access = await getFreeAccess(userId);
  if (access.projectId !== projectId) throw new ApiError(402, 'UPGRADE_REQUIRED', 'This project requires a subscription');
  return access;
}

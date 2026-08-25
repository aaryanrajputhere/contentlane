import type { Prisma, UserRole } from '@prisma/client';
import prisma from './prisma';
import { ApiError } from './errors';
import { getRecognizedProductIds } from './billing-plans';

export const FREE_HOOK_SELECTION_LIMIT = 8;

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function hasPaidAccess(userId: string, role: UserRole, db: DbClient = prisma) {
  if (role === 'ADMIN') return true;
  return Boolean(await db.subscription.findFirst({
    where: { userId, dodoProductId: { in: getRecognizedProductIds() }, status: 'active' },
    select: { id: true },
  }));
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
  if (!await hasPaidAccess(userId, role)) {
    throw new ApiError(402, 'UPGRADE_REQUIRED', 'Start a subscription to unlock this feature');
  }
}

export async function requireFreeProjectAccess(userId: string, projectId: string) {
  const access = await getFreeAccess(userId);
  if (access.projectId !== projectId) throw new ApiError(402, 'UPGRADE_REQUIRED', 'This project requires a subscription');
  return access;
}

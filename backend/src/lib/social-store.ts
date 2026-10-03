import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from './prisma';

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NEEDS_RECONNECTION';
export type PublicationStatus = 'VALIDATING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

export interface SocialProfileRow { id: string; userId: string; zernioProfileId: string; createdAt: Date; updatedAt: Date }
export interface SocialAccountRow {
  id: string; userId: string; socialProfileId: string; platform: 'TIKTOK'; zernioAccountId: string;
  username: string | null; displayName: string | null; avatarUrl: string | null; countryCode: string | null;
  connectionStatus: ConnectionStatus; metadata: unknown; connectedAt: Date; createdAt: Date; updatedAt: Date;
}
export interface SocialPublicationRow {
  id: string; requestKey: string; projectId: string; conceptId: string | null; renderJobId: string | null;
  socialAccountId: string; platform: 'TIKTOK'; sourceUrl: string; caption: string; music: unknown; settings: unknown;
  zernioPostId: string | null; platformPostId: string | null; platformPostUrl: string | null; status: PublicationStatus;
  errorCode: string | null; errorMessage: string | null; analytics: unknown; analyticsSyncedAt: Date | null;
  publishedAt: Date | null; createdAt: Date; updatedAt: Date;
}

export async function findSocialProfile(userId: string) {
  const rows = await prisma.$queryRaw<SocialProfileRow[]>`SELECT * FROM "SocialProfile" WHERE "userId" = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function createSocialProfile(userId: string, zernioProfileId: string) {
  const rows = await prisma.$queryRaw<SocialProfileRow[]>`
    INSERT INTO "SocialProfile" ("id", "userId", "zernioProfileId", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${zernioProfileId}, NOW(), NOW()) RETURNING *`;
  return rows[0];
}

export async function findSocialAccount(userId: string, id?: string) {
  const rows = id
    ? await prisma.$queryRaw<SocialAccountRow[]>`SELECT * FROM "SocialAccount" WHERE "userId" = ${userId} AND "id" = ${id} AND "platform" = 'TIKTOK' LIMIT 1`
    : await prisma.$queryRaw<SocialAccountRow[]>`SELECT * FROM "SocialAccount" WHERE "userId" = ${userId} AND "platform" = 'TIKTOK' LIMIT 1`;
  return rows[0] ?? null;
}

export async function upsertSocialAccount(input: Omit<SocialAccountRow, 'id' | 'platform' | 'connectedAt' | 'createdAt' | 'updatedAt'>) {
  const rows = await prisma.$queryRaw<SocialAccountRow[]>`
    INSERT INTO "SocialAccount" ("id", "userId", "socialProfileId", "platform", "zernioAccountId", "username", "displayName", "avatarUrl", "countryCode", "connectionStatus", "metadata", "connectedAt", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${input.userId}, ${input.socialProfileId}, 'TIKTOK', ${input.zernioAccountId}, ${input.username}, ${input.displayName}, ${input.avatarUrl}, ${input.countryCode}, ${input.connectionStatus}::"SocialConnectionStatus", ${JSON.stringify(input.metadata)}::jsonb, NOW(), NOW(), NOW())
    ON CONFLICT ("userId", "platform") DO UPDATE SET "socialProfileId" = EXCLUDED."socialProfileId", "zernioAccountId" = EXCLUDED."zernioAccountId", "username" = EXCLUDED."username", "displayName" = EXCLUDED."displayName", "avatarUrl" = EXCLUDED."avatarUrl", "countryCode" = EXCLUDED."countryCode", "connectionStatus" = EXCLUDED."connectionStatus", "metadata" = EXCLUDED."metadata", "connectedAt" = NOW(), "updatedAt" = NOW()
    RETURNING *`;
  return rows[0];
}

export async function setSocialAccountStatus(where: { userId?: string; id?: string; zernioAccountId?: string }, status: ConnectionStatus) {
  if (where.id) return prisma.$executeRaw`UPDATE "SocialAccount" SET "connectionStatus" = ${status}::"SocialConnectionStatus", "updatedAt" = NOW() WHERE "id" = ${where.id}`;
  if (where.zernioAccountId) return prisma.$executeRaw`UPDATE "SocialAccount" SET "connectionStatus" = ${status}::"SocialConnectionStatus", "updatedAt" = NOW() WHERE "zernioAccountId" = ${where.zernioAccountId}`;
  if (where.userId) return prisma.$executeRaw`UPDATE "SocialAccount" SET "connectionStatus" = ${status}::"SocialConnectionStatus", "updatedAt" = NOW() WHERE "userId" = ${where.userId} AND "platform" = 'TIKTOK'`;
  return 0;
}

export async function findPublicationByRequestKey(requestKey: string) {
  const rows = await prisma.$queryRaw<SocialPublicationRow[]>`SELECT * FROM "SocialPublication" WHERE "requestKey" = ${requestKey} LIMIT 1`;
  return rows[0] ?? null;
}

export async function createSocialPublication(input: {
  requestKey: string; projectId: string; conceptId: string; renderJobId: string; socialAccountId: string;
  sourceUrl: string; caption: string; music: unknown; settings: unknown;
}) {
  const rows = await prisma.$queryRaw<SocialPublicationRow[]>`
    INSERT INTO "SocialPublication" ("id", "requestKey", "projectId", "conceptId", "renderJobId", "socialAccountId", "platform", "sourceUrl", "caption", "music", "settings", "status", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${input.requestKey}, ${input.projectId}, ${input.conceptId}, ${input.renderJobId}, ${input.socialAccountId}, 'TIKTOK', ${input.sourceUrl}, ${input.caption}, ${input.music === null ? null : JSON.stringify(input.music)}::jsonb, ${JSON.stringify(input.settings)}::jsonb, 'VALIDATING', NOW(), NOW()) RETURNING *`;
  return rows[0];
}

export async function setPublicationPublishing(id: string) {
  await prisma.$executeRaw`UPDATE "SocialPublication" SET "status" = 'PUBLISHING', "updatedAt" = NOW() WHERE "id" = ${id}`;
}

export async function setPublicationProviderResult(id: string, input: { status: PublicationStatus; zernioPostId: string | null; platformPostId: string | null; platformPostUrl: string | null; errorMessage: string | null }) {
  const rows = await prisma.$queryRaw<SocialPublicationRow[]>`
    UPDATE "SocialPublication" SET "status" = ${input.status}::"SocialPublicationStatus", "zernioPostId" = ${input.zernioPostId}, "platformPostId" = ${input.platformPostId}, "platformPostUrl" = ${input.platformPostUrl}, "errorMessage" = ${input.errorMessage}, "publishedAt" = CASE WHEN ${input.status} = 'PUBLISHED' THEN NOW() ELSE NULL END, "updatedAt" = NOW()
    WHERE "id" = ${id} RETURNING *`;
  return rows[0];
}

export async function setPublicationFailed(id: string, errorCode: string, errorMessage: string) {
  await prisma.$executeRaw`UPDATE "SocialPublication" SET "status" = 'FAILED', "errorCode" = ${errorCode}, "errorMessage" = ${errorMessage}, "updatedAt" = NOW() WHERE "id" = ${id}`;
}

export async function listSocialPublications(projectId: string) {
  return prisma.$queryRaw<Array<SocialPublicationRow & { accountUsername: string | null; accountDisplayName: string | null }>>`
    SELECT p.*, a."username" AS "accountUsername", a."displayName" AS "accountDisplayName"
    FROM "SocialPublication" p JOIN "SocialAccount" a ON a."id" = p."socialAccountId"
    WHERE p."projectId" = ${projectId} ORDER BY p."createdAt" DESC`;
}

export async function findOwnedPublication(publicationId: string, userId: string) {
  const rows = await prisma.$queryRaw<SocialPublicationRow[]>`
    SELECT p.* FROM "SocialPublication" p JOIN "Project" project ON project."id" = p."projectId"
    WHERE p."id" = ${publicationId} AND project."userId" = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function updatePublicationAnalytics(id: string, analytics: unknown) {
  const rows = await prisma.$queryRaw<SocialPublicationRow[]>`
    UPDATE "SocialPublication" SET "analytics" = ${JSON.stringify(analytics)}::jsonb, "analyticsSyncedAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" = ${id} RETURNING *`;
  return rows[0];
}

export async function insertWebhookEvent(eventId: string, eventType: string, payload: unknown) {
  const rows = await prisma.$queryRaw<Array<{ eventId: string }>>`
    INSERT INTO "SocialWebhookEvent" ("eventId", "eventType", "payload", "createdAt") VALUES (${eventId}, ${eventType}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT ("eventId") DO NOTHING RETURNING "eventId"`;
  return rows.length === 1;
}

export async function markWebhookProcessed(eventId: string) {
  await prisma.$executeRaw`UPDATE "SocialWebhookEvent" SET "processedAt" = NOW() WHERE "eventId" = ${eventId}`;
}

export async function deleteWebhookEvent(eventId: string) {
  await prisma.$executeRaw`DELETE FROM "SocialWebhookEvent" WHERE "eventId" = ${eventId} AND "processedAt" IS NULL`;
}

export async function updatePublicationFromWebhook(identifier: { zernioPostId: string | null; requestKey: string | null }, input: { status?: PublicationStatus; platformPostId?: string | null; platformPostUrl?: string | null; errorCode?: string | null; errorMessage?: string | null; analytics?: unknown }) {
  const analyticsJson = input.analytics === undefined ? null : JSON.stringify(input.analytics);
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "SocialPublication" SET
      "status" = COALESCE(${input.status ?? null}::"SocialPublicationStatus", "status"),
      "platformPostId" = COALESCE(${input.platformPostId ?? null}, "platformPostId"),
      "platformPostUrl" = COALESCE(${input.platformPostUrl ?? null}, "platformPostUrl"),
      "errorCode" = COALESCE(${input.errorCode ?? null}, "errorCode"),
      "errorMessage" = COALESCE(${input.errorMessage ?? null}, "errorMessage"),
      "analytics" = CASE WHEN ${analyticsJson}::text IS NULL THEN "analytics" ELSE ${analyticsJson}::jsonb END,
      "analyticsSyncedAt" = CASE WHEN ${analyticsJson}::text IS NULL THEN "analyticsSyncedAt" ELSE NOW() END,
      "publishedAt" = CASE WHEN ${input.status ?? null} = 'PUBLISHED' THEN COALESCE("publishedAt", NOW()) ELSE "publishedAt" END,
      "updatedAt" = NOW()
    WHERE (${identifier.zernioPostId}::text IS NOT NULL AND "zernioPostId" = ${identifier.zernioPostId})
       OR (${identifier.requestKey}::text IS NOT NULL AND "requestKey" = ${identifier.requestKey})`);
}

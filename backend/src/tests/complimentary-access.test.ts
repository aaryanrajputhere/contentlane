import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import './test-env';
import { hasFullAccess } from '../lib/access';
import prisma from '../lib/prisma';
import { createReservedRenderJob, getRenderUsage } from '../lib/render-quota';

test('complimentary Pro access grants full product access and a calendar-month render quota', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({ data: { email: `complimentary-${suffix}@example.com` } });
  try {
    const project = await prisma.project.create({ data: { userId: user.id, website: 'https://gift.example.com', normalizedWebsite: `gift-${suffix}.example.com` } });
    await prisma.$executeRaw`INSERT INTO "ComplimentaryAccess" ("id", "userId", "planId", "startsAt", "expiresAt", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${user.id}, 'pro', ${new Date(Date.now() - 60_000)}, ${new Date(Date.now() + 86_400_000)}, NOW(), NOW())`;

    assert.equal(await hasFullAccess(user.id, 'USER'), true);
    const usage = await getRenderUsage(user.id, 'USER');
    assert.equal(usage.limit, 100);
    assert.equal(usage.remaining, 100);
    assert.equal(usage.periodStart?.getUTCDate(), 1);

    await createReservedRenderJob({ userId: user.id, role: 'USER', projectId: project.id, renderInput: {}, requestedCount: 4 });
    assert.equal((await getRenderUsage(user.id, 'USER')).remaining, 96);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('expired and revoked complimentary grants do not provide access', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({ data: { email: `expired-gift-${suffix}@example.com` } });
  try {
    await prisma.$executeRaw`INSERT INTO "ComplimentaryAccess" ("id", "userId", "planId", "startsAt", "expiresAt", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${user.id}, 'starter', ${new Date(Date.now() - 120_000)}, ${new Date(Date.now() - 60_000)}, NOW(), NOW())`;
    assert.equal(await hasFullAccess(user.id, 'USER'), false);

    await prisma.$executeRaw`UPDATE "ComplimentaryAccess" SET "expiresAt" = NULL, "revokedAt" = NOW() WHERE "userId" = ${user.id}`;
    assert.equal(await hasFullAccess(user.id, 'USER'), false);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});

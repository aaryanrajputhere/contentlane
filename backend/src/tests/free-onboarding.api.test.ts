import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { AddressInfo } from 'node:net';
import test, { after, afterEach, before } from 'node:test';
import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma';
import { grantTestSubscription, loginAndGetCookie } from './test-helpers';

process.env.NODE_ENV = 'test';

let createApp: typeof import('../app.js').createApp;
const userIds: string[] = [];

before(async () => { ({ createApp } = await import('../app.js')); });
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } }); });
after(async () => {
  const { renderConnection, renderQueue } = await import('../lib/render-queue.js');
  await renderQueue.close();
  renderConnection.disconnect();
  await prisma.$disconnect();
});

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createApp().listen(0);
  const port = (server.address() as AddressInfo).port;
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

async function seedFreeProject() {
  const suffix = randomUUID();
  const password = 'password123';
  const user = await prisma.user.create({ data: { email: `free-api-${suffix}@example.com`, passwordHash: await bcrypt.hash(password, 12) } });
  userIds.push(user.id);
  const project = await prisma.project.create({ data: { userId: user.id, website: 'https://free-api.example.com', normalizedWebsite: `https://free-api-${suffix}.example.com`, status: 'HOOKS_READY' } });
  await prisma.$executeRaw`UPDATE "Project" SET "freeOnboardingOwnerId" = ${user.id} WHERE "id" = ${project.id}`;
  await prisma.hookConcept.createMany({
    data: Array.from({ length: 9 }, (_, sortOrder) => ({
      projectId: project.id,
      angle: `Angle ${sortOrder}`,
      hookText: `Hook ${sortOrder}`,
      hookImagePrompt: 'Product close-up',
      demoOverlayText: 'Try it today',
      videoDirection: 'Creator talks to camera',
      targetDurationLabel: '4-5s',
      targetDurationSeconds: 5,
      score: 80,
      scoreLabel: 'Strong',
      rationale: 'Test hook',
      sortOrder,
    })),
  });
  return { user, project, password };
}

const confirmationPayload = {
  brandName: 'Edited Brand',
  productSummary: 'A focused product summary',
  targetAudience: 'Growth teams',
  customerProblems: ['Slow creative testing'],
  keyBenefits: ['Faster hook iteration'],
  proofPoints: ['Used by growing teams'],
  claimConstraints: ['Do not promise guaranteed results'],
};

async function seedPendingConfirmation(paid: boolean) {
  const suffix = randomUUID();
  const password = 'password123';
  const user = await prisma.user.create({ data: { email: `brand-confirm-${suffix}@example.com`, passwordHash: await bcrypt.hash(password, 12) } });
  userIds.push(user.id);
  if (paid) await grantTestSubscription(user.id);
  const project = await prisma.project.create({ data: { userId: user.id, website: 'https://brand-confirm.example.com', normalizedWebsite: `https://brand-confirm-${suffix}.example.com`, status: 'READY' } });
  if (!paid) await prisma.$executeRaw`UPDATE "Project" SET "freeOnboardingOwnerId" = ${user.id} WHERE "id" = ${project.id}`;
  await prisma.brandProfile.create({ data: { projectId: project.id, ...confirmationPayload, brandName: 'Analyzed Brand' } });
  return { user, project, password };
}

test('free onboarding exposes only its scoped project and locks at eight selections', async () => {
  await withServer(async (baseUrl) => {
    const { user, project, password } = await seedFreeProject();
    const cookie = await loginAndGetCookie(baseUrl, { email: user.email, password });
    const headers = { cookie, 'content-type': 'application/json' };

    const billingResponse = await fetch(`${baseUrl}/api/v1/billing/status`, { headers });
    assert.equal(billingResponse.status, 200);
    const billing = await billingResponse.json() as { hasAccess: boolean; accessTier: string; freeAccess: { projectId: string; limit: number; generated: number } };
    assert.deepEqual({ hasAccess: billing.hasAccess, accessTier: billing.accessTier, projectId: billing.freeAccess.projectId, limit: billing.freeAccess.limit, generated: billing.freeAccess.generated }, { hasAccess: false, accessTier: 'free', projectId: project.id, limit: 24, generated: 9 });

    assert.equal((await fetch(`${baseUrl}/api/v1/projects/${project.id}`, { headers })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/v1/projects`, { headers })).status, 402);
    assert.equal((await fetch(`${baseUrl}/api/v1/projects/${project.id}/brand-profile`, { method: 'PATCH', headers, body: '{}' })).status, 402);
    await prisma.brandProfile.create({ data: { projectId: project.id, ...confirmationPayload } });
    const lateConfirmation = await fetch(`${baseUrl}/api/v1/projects/${project.id}/brand-profile/confirm`, { method: 'POST', headers, body: JSON.stringify(confirmationPayload) });
    assert.equal(lateConfirmation.status, 409);
    assert.equal(((await lateConfirmation.json()) as { error: { code: string } }).error.code, 'HOOKS_ALREADY_GENERATED');

    const concepts = await prisma.hookConcept.findMany({ where: { projectId: project.id }, orderBy: { sortOrder: 'asc' } });
    for (const concept of concepts.slice(0, 8)) {
      const response = await fetch(`${baseUrl}/api/v1/projects/${project.id}/concepts/${concept.id}/review`, { method: 'PATCH', headers, body: JSON.stringify({ decision: 'LIKED' }) });
      assert.equal(response.status, 200);
    }
    const blocked = await fetch(`${baseUrl}/api/v1/projects/${project.id}/concepts/${concepts[8]!.id}/review`, { method: 'PATCH', headers, body: JSON.stringify({ decision: 'REJECTED' }) });
    assert.equal(blocked.status, 402);
    assert.equal(((await blocked.json()) as { error: { code: string } }).error.code, 'UPGRADE_REQUIRED');

    const secondClaim = await fetch(`${baseUrl}/api/v1/projects`, { method: 'POST', headers, body: JSON.stringify({ website: 'https://second.example.com' }) });
    assert.equal(secondClaim.status, 200);
    assert.equal(((await secondClaim.json()) as { project: { id: string } }).project.id, project.id);
  });
});

for (const paid of [false, true]) {
  test(`${paid ? 'subscribed' : 'free'} users must confirm the analyzed brand before hook generation`, async () => {
    await withServer(async (baseUrl) => {
      const { user, project, password } = await seedPendingConfirmation(paid);
      const cookie = await loginAndGetCookie(baseUrl, { email: user.email, password });
      const headers = { cookie, 'content-type': 'application/json' };

      const blocked = await fetch(`${baseUrl}/api/v1/projects/${project.id}/concepts`, { method: 'POST', headers, body: JSON.stringify({ count: 8 }) });
      assert.equal(blocked.status, 409);
      assert.equal(((await blocked.json()) as { error: { code: string } }).error.code, 'BRAND_PROFILE_CONFIRMATION_REQUIRED');

      const invalid = await fetch(`${baseUrl}/api/v1/projects/${project.id}/brand-profile/confirm`, { method: 'POST', headers, body: JSON.stringify({ ...confirmationPayload, customerProblems: [] }) });
      assert.equal(invalid.status, 400);

      if (!paid) {
        const foreign = await seedPendingConfirmation(false);
        const foreignAttempt = await fetch(`${baseUrl}/api/v1/projects/${foreign.project.id}/brand-profile/confirm`, { method: 'POST', headers, body: JSON.stringify(confirmationPayload) });
        assert.equal(foreignAttempt.status, 404);
      }

      const confirmed = await fetch(`${baseUrl}/api/v1/projects/${project.id}/brand-profile/confirm`, { method: 'POST', headers, body: JSON.stringify(confirmationPayload) });
      assert.equal(confirmed.status, 200);
      const payload = await confirmed.json() as { project: { brandProfileConfirmedAt: string | null; brandProfile: { brandName: string } } };
      assert.ok(payload.project.brandProfileConfirmedAt);
      assert.equal(payload.project.brandProfile.brandName, 'Edited Brand');

      const repeated = await fetch(`${baseUrl}/api/v1/projects/${project.id}/brand-profile/confirm`, { method: 'POST', headers, body: JSON.stringify(confirmationPayload) });
      assert.equal(repeated.status, 409);
      assert.equal(((await repeated.json()) as { error: { code: string } }).error.code, 'BRAND_PROFILE_ALREADY_CONFIRMED');
    });
  });
}

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import test, { after, afterEach, before } from 'node:test';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { grantTestSubscription, loginAndGetCookie } from './test-helpers';

process.env.NODE_ENV = 'test';

let createApp: typeof import('../app.js').createApp;
const userIds: string[] = [];
const creatorIds: string[] = [];

before(async () => { ({ createApp } = await import('../app.js')); });
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await prisma.creator.deleteMany({ where: { id: { in: creatorIds.splice(0) } } });
});
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

async function seedEditableProject(paid: boolean, persistCreatorSelection = true) {
  const suffix = randomUUID();
  const password = 'password123';
  const user = await prisma.user.create({
    data: { email: `concept-edit-${suffix}@example.com`, passwordHash: await bcrypt.hash(password, 12) },
  });
  userIds.push(user.id);
  if (paid) await grantTestSubscription(user.id);

  const creator = await prisma.creator.create({
    data: {
      name: `Concept Edit Creator ${suffix}`,
      baseImageUrl: 'https://example.com/creator.jpg',
      baseImageProvider: 'test',
      clips: {
        create: [
          { title: 'Desk clip', url: 'https://example.com/desk.mp4', provider: 'test', tags: ['desk'] },
          { title: 'Outside clip', url: 'https://example.com/outside.mp4', provider: 'test', tags: ['outside'] },
        ],
      },
    },
    include: { clips: true },
  });
  creatorIds.push(creator.id);
  const character = {
    id: creator.id,
    source: 'preset',
    name: creator.name,
    persona: 'Product creator',
    appearance: 'Casual creator',
    voice: 'Conversational',
    prompt: 'A creator demonstrating a product',
    baseImageUrl: creator.baseImageUrl,
  };
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      website: `https://concept-edit-${suffix}.example.com`,
      normalizedWebsite: `https://concept-edit-${suffix}.example.com`,
      status: 'HOOKS_READY',
      ...(persistCreatorSelection ? { creatorSelection: { mode: 'single', characters: [character] } as Prisma.InputJsonValue } : {}),
    },
  });
  if (!paid) {
    await prisma.$executeRaw`UPDATE "Project" SET "freeOnboardingOwnerId" = ${user.id} WHERE "id" = ${project.id}`;
  }
  const concept = await prisma.hookConcept.create({
    data: {
      projectId: project.id,
      angle: 'Faster editing',
      hookText: 'Original hook',
      hookImagePrompt: 'Product close-up',
      demoOverlayText: 'Original demo',
      videoDirection: 'Creator talks to camera',
      targetDurationLabel: '4-5s',
      targetDurationSeconds: 5,
      score: 92,
      scoreLabel: 'Strong',
      rationale: 'Clear pain point',
    },
  });
  const demo = await prisma.mediaAsset.create({
    data: {
      projectId: project.id,
      type: 'VIDEO',
      provider: 'test',
      providerId: `demo-${suffix}`,
      url: 'https://example.com/demo.mp4',
      mimeType: 'video/mp4',
      metadata: { kind: 'brand-demo', displayName: 'Main demo' },
    },
  });
  await prisma.project.update({ where: { id: project.id }, data: { defaultBrandDemoAssetId: demo.id } });
  return { user, password, project, concept, creator, demo };
}

function editRequest(baseUrl: string, cookie: string, projectId: string, conceptId: string, body: unknown) {
  return fetch(`${baseUrl}/api/v1/projects/${projectId}/concepts/${conceptId}`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('active free users can atomically edit an unreviewed hook and selected creator clip', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedEditableProject(false, false);
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    const selectedClip = seeded.creator.clips[1]!;
    const response = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, {
      hookText: 'Edited hook text',
      demoOverlayText: seeded.concept.demoOverlayText,
      creatorId: seeded.creator.id,
      clipId: selectedClip.id,
    });
    assert.equal(response.status, 200);
    const saved = await prisma.hookConcept.findUniqueOrThrow({ where: { id: seeded.concept.id } });
    assert.deepEqual(
      { hookText: saved.hookText, creatorId: saved.assignedCreatorId, clipId: saved.assignedClipId },
      { hookText: 'Edited hook text', creatorId: seeded.creator.id, clipId: selectedClip.id },
    );

    await prisma.hookConcept.update({ where: { id: seeded.concept.id }, data: { reviewDecision: 'REJECTED' } });
    const reviewedResponse = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, {
      hookText: 'Too late', demoOverlayText: 'Demo', creatorId: seeded.creator.id, clipId: selectedClip.id,
    });
    assert.equal(reviewedResponse.status, 409);
  });
});

test('clip edits reject creators outside the project roster and expired free access', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedEditableProject(false);
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    const outsider = await prisma.creator.create({
      data: {
        name: `Concept Edit Outsider ${randomUUID()}`,
        baseImageUrl: 'https://example.com/outsider.jpg',
        baseImageProvider: 'test',
        clips: { create: { url: 'https://example.com/outsider.mp4', provider: 'test', tags: [] } },
      },
      include: { clips: true },
    });
    creatorIds.push(outsider.id);
    const invalidRoster = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, {
      hookText: 'Edited hook', demoOverlayText: 'Demo', creatorId: outsider.id, clipId: outsider.clips[0]!.id,
    });
    assert.equal(invalidRoster.status, 400);

    await prisma.user.update({ where: { id: seeded.user.id }, data: { freeAccessEndedAt: new Date() } });
    const expired = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, {
      hookText: 'Edited hook', demoOverlayText: 'Demo', creatorId: seeded.creator.id, clipId: seeded.creator.clips[0]!.id,
    });
    assert.equal(expired.status, 402);
  });
});

test('subscribers can edit reviewed hooks but cannot use a clip from the wrong creator', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedEditableProject(true);
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    await prisma.hookConcept.update({ where: { id: seeded.concept.id }, data: { reviewDecision: 'LIKED' } });
    const valid = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, {
      hookText: 'Subscriber edit', demoOverlayText: 'Demo', creatorId: seeded.creator.id, clipId: seeded.creator.clips[0]!.id,
    });
    assert.equal(valid.status, 200);

    const mismatched = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, {
      hookText: 'Subscriber edit', demoOverlayText: 'Demo', creatorId: seeded.creator.id, clipId: 'cm00000000000000000000009',
    });
    assert.equal(mismatched.status, 400);
  });
});

test('concept demo overrides can be set, preserved when omitted, and cleared', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedEditableProject(true);
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    const common = {
      hookText: 'Demo-specific hook',
      demoOverlayText: seeded.concept.demoOverlayText,
      creatorId: seeded.creator.id,
      clipId: seeded.creator.clips[0]!.id,
    };
    const assigned = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, { ...common, brandDemoAssetId: seeded.demo.id });
    assert.equal(assigned.status, 200);
    assert.equal((await prisma.hookConcept.findUniqueOrThrow({ where: { id: seeded.concept.id } })).assignedBrandDemoAssetId, seeded.demo.id);

    const preserved = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, { ...common, hookText: 'Copy only' });
    assert.equal(preserved.status, 200);
    assert.equal((await prisma.hookConcept.findUniqueOrThrow({ where: { id: seeded.concept.id } })).assignedBrandDemoAssetId, seeded.demo.id);

    const cleared = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, { ...common, brandDemoAssetId: null });
    assert.equal(cleared.status, 200);
    assert.equal((await prisma.hookConcept.findUniqueOrThrow({ where: { id: seeded.concept.id } })).assignedBrandDemoAssetId, null);
  });
});

test('concept demo overrides reject assets from another project', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedEditableProject(true);
    const other = await seedEditableProject(true);
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    const response = await editRequest(baseUrl, cookie, seeded.project.id, seeded.concept.id, {
      hookText: 'Wrong project demo',
      demoOverlayText: seeded.concept.demoOverlayText,
      creatorId: seeded.creator.id,
      clipId: seeded.creator.clips[0]!.id,
      brandDemoAssetId: other.demo.id,
    });
    assert.equal(response.status, 400);
  });
});

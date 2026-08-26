import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import test, { after, afterEach, before } from 'node:test';
import bcrypt from 'bcryptjs';
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

async function seedLibrary() {
  const suffix = randomUUID();
  const password = 'password123';
  const user = await prisma.user.create({ data: { email: `brand-demos-${suffix}@example.com`, passwordHash: await bcrypt.hash(password, 12) } });
  userIds.push(user.id);
  await grantTestSubscription(user.id);
  const project = await prisma.project.create({ data: { userId: user.id, website: `https://${suffix}.example.com`, normalizedWebsite: `https://${suffix}.example.com`, status: 'HOOKS_READY' } });
  const older = await prisma.mediaAsset.create({ data: { projectId: project.id, type: 'VIDEO', provider: 'test', providerId: `older-${suffix}`, url: 'https://example.com/older.mp4', mimeType: 'video/mp4', metadata: { kind: 'brand-demo', displayName: 'Older demo' }, createdAt: new Date('2026-01-01T00:00:00Z') } });
  const newer = await prisma.mediaAsset.create({ data: { projectId: project.id, type: 'VIDEO', provider: 'test', providerId: `newer-${suffix}`, url: 'https://example.com/newer.mp4', mimeType: 'video/mp4', metadata: { kind: 'brand-demo', displayName: 'Newer demo' }, createdAt: new Date('2026-02-01T00:00:00Z') } });
  await prisma.project.update({ where: { id: project.id }, data: { defaultBrandDemoAssetId: older.id } });
  const concept = await prisma.hookConcept.create({ data: { projectId: project.id, angle: 'Demo', hookText: 'Hook', hookImagePrompt: 'Prompt', demoOverlayText: 'Overlay', videoDirection: 'Direction', targetDurationLabel: '4-5s', targetDurationSeconds: 5, score: 90, scoreLabel: 'Strong', rationale: 'Reason', assignedBrandDemoAssetId: older.id } });
  return { user, password, project, older, newer, concept };
}

function request(baseUrl: string, cookie: string, path: string, method: string, body?: unknown) {
  return fetch(`${baseUrl}/api/v1${path}`, { method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
}

test('demo library supports rename, default changes, and deletion fallback', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedLibrary();
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    const renamed = await request(baseUrl, cookie, `/projects/${seeded.project.id}/brand-demos/${seeded.newer.id}`, 'PATCH', { name: 'Checkout flow' });
    assert.equal(renamed.status, 200);
    assert.equal(((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: seeded.newer.id } })).metadata as { displayName?: string }).displayName, 'Checkout flow');

    const madeDefault = await request(baseUrl, cookie, `/projects/${seeded.project.id}/brand-demos/${seeded.newer.id}/default`, 'PUT');
    assert.equal(madeDefault.status, 200);
    assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: seeded.project.id } })).defaultBrandDemoAssetId, seeded.newer.id);

    const restored = await request(baseUrl, cookie, `/projects/${seeded.project.id}/brand-demos/${seeded.older.id}/default`, 'PUT');
    assert.equal(restored.status, 200);
    const deleted = await request(baseUrl, cookie, `/projects/${seeded.project.id}/brand-demos/${seeded.older.id}`, 'DELETE');
    assert.equal(deleted.status, 200);
    assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: seeded.project.id } })).defaultBrandDemoAssetId, seeded.newer.id);
    assert.equal((await prisma.hookConcept.findUniqueOrThrow({ where: { id: seeded.concept.id } })).assignedBrandDemoAssetId, null);
  });
});

test('demo mutations are project-scoped and active render snapshots block deletion', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedLibrary();
    const other = await seedLibrary();
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    const crossProject = await request(baseUrl, cookie, `/projects/${seeded.project.id}/brand-demos/${other.older.id}`, 'PATCH', { name: 'Nope' });
    assert.equal(crossProject.status, 404);

    await prisma.generationJob.create({ data: { projectId: seeded.project.id, type: 'RENDER_REELS', status: 'ACTIVE', input: { assignments: [{ conceptId: seeded.concept.id, demoAssetId: seeded.older.id, demoUrl: seeded.older.url, demoName: 'Older demo' }] } } });
    const blocked = await request(baseUrl, cookie, `/projects/${seeded.project.id}/brand-demos/${seeded.older.id}`, 'DELETE');
    assert.equal(blocked.status, 409);
    assert.ok(await prisma.mediaAsset.findUnique({ where: { id: seeded.older.id } }));
  });
});

test('multi-upload enforces the ten-demo cap before storing files', async () => {
  await withServer(async (baseUrl) => {
    const seeded = await seedLibrary();
    const cookie = await loginAndGetCookie(baseUrl, { email: seeded.user.email, password: seeded.password });
    await prisma.mediaAsset.createMany({
      data: Array.from({ length: 8 }, (_, index) => ({ projectId: seeded.project.id, type: 'VIDEO' as const, provider: 'test', providerId: `extra-${index}-${randomUUID()}`, url: `https://example.com/${index}.mp4`, mimeType: 'video/mp4', metadata: { kind: 'brand-demo', displayName: `Extra ${index}` } })),
    });
    const body = new FormData();
    body.append('demos', new Blob(['video'], { type: 'video/mp4' }), 'eleventh.mp4');
    const response = await fetch(`${baseUrl}/api/v1/projects/${seeded.project.id}/brand-demos`, { method: 'POST', headers: { cookie }, body });
    assert.equal(response.status, 400);
    assert.equal(await prisma.mediaAsset.count({ where: { projectId: seeded.project.id } }), 10);
  });
});

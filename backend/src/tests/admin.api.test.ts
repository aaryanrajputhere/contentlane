import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import test, { before, beforeEach } from 'node:test';
import prisma from '../lib/prisma';
import { createUserAccount, loginAndGetCookie } from './test-helpers';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://ContentLane:ContentLane@localhost:5432/ContentLane?schema=public';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-at-least-32-characters-long';

let createApp: typeof import('../app.js').createApp;
before(async () => { ({ createApp } = await import('../app.js')); });
beforeEach(async () => {
  await prisma.project.deleteMany({ where: { website: { contains: 'admin-test' } } });
  await prisma.allowedEmail.deleteMany({ where: { email: { startsWith: 'admin-test-' } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'admin-test-' } } });
});

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createApp().listen(0);
  const port = (server.address() as AddressInfo).port;
  try { await run(`http://127.0.0.1:${port}`); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('admin observability is protected and exposes user project pipeline context', async () => {
  await withServer(async (baseUrl) => {
    const admin = await createUserAccount({ email: 'admin-test-admin@example.com', password: 'password123', name: 'Admin', role: 'ADMIN' });
    const member = await createUserAccount({ email: 'admin-test-member@example.com', password: 'password123', name: 'Member' });
    const project = await prisma.project.create({ data: { userId: member.id, website: 'https://admin-test.example.com', normalizedWebsite: 'admin-test.example.com', status: 'FAILED' } });
    await prisma.generationJob.create({ data: { projectId: project.id, type: 'ANALYZE_WEBSITE', status: 'FAILED', progress: 100, input: { website: project.website }, errorMessage: 'Test failure' } });
    const concept = await prisma.hookConcept.create({ data: {
      projectId: project.id,
      angle: 'Admin test angle',
      hookText: 'Admin test hook',
      hookImagePrompt: 'A product screen',
      demoOverlayText: 'Try it now',
      videoDirection: 'Direct to camera',
      targetDurationLabel: '15 seconds',
      targetDurationSeconds: 15,
      score: 92,
      scoreLabel: 'Top rank',
      rationale: 'Testing admin media inspection',
      sortOrder: 0,
    } });
    const olderDemo = await prisma.mediaAsset.create({ data: { projectId: project.id, conceptId: null, type: 'VIDEO', provider: 'test', url: 'https://cdn.example.com/demo-older.mp4', mimeType: 'video/mp4', metadata: { kind: 'brand-demo', displayName: 'Older demo' } } });
    const defaultDemo = await prisma.mediaAsset.create({ data: { projectId: project.id, conceptId: null, type: 'VIDEO', provider: 'test', url: 'https://cdn.example.com/demo-default.mp4', mimeType: 'video/mp4', metadata: { kind: 'brand-demo', displayName: 'Default demo' } } });
    await prisma.project.update({ where: { id: project.id }, data: { defaultBrandDemoAssetId: defaultDemo.id } });

    const reel = (url: string, demoId: string, demoName: string) => ({
      conceptId: concept.id,
      creatorName: 'Test creator',
      demoAssetId: demoId,
      demoName,
      sortOrder: 0,
      url,
      mimeType: 'video/mp4',
      format: 'mp4',
    });
    const olderRender = await prisma.generationJob.create({ data: { projectId: project.id, type: 'RENDER_REELS', status: 'COMPLETED', progress: 100, input: {}, result: { reels: [reel('https://cdn.example.com/reel-older.mp4', olderDemo.id, 'Older demo')] }, updatedAt: new Date('2026-08-01T10:00:00.000Z') } });
    const newerRender = await prisma.generationJob.create({ data: { projectId: project.id, type: 'RENDER_REELS', status: 'COMPLETED', progress: 100, input: {}, result: { reels: [reel('https://cdn.example.com/reel-newer.mp4', defaultDemo.id, 'Default demo')] }, updatedAt: new Date('2026-08-02T10:00:00.000Z') } });
    await prisma.generationJob.create({ data: { projectId: project.id, type: 'RENDER_REELS', status: 'COMPLETED', progress: 100, input: {}, result: { reels: [{ conceptId: concept.id }] } } });
    await prisma.generationJob.create({ data: { projectId: project.id, type: 'RENDER_REELS', status: 'FAILED', progress: 100, input: {}, result: { reels: [reel('https://cdn.example.com/reel-failed.mp4', defaultDemo.id, 'Default demo')] } } });
    await prisma.generationJob.create({ data: { projectId: project.id, type: 'RENDER_REELS', status: 'ACTIVE', progress: 50, input: {}, result: { reels: [reel('https://cdn.example.com/reel-active.mp4', defaultDemo.id, 'Default demo')] } } });
    await prisma.generationJob.create({ data: { projectId: project.id, type: 'GENERATE_CONCEPTS', status: 'COMPLETED', progress: 100, input: {}, result: { reels: [reel('https://cdn.example.com/reel-wrong-job.mp4', defaultDemo.id, 'Default demo')] } } });
    const adminCookie = await loginAndGetCookie(baseUrl, { email: admin.email, password: 'password123' });
    const memberCookie = await loginAndGetCookie(baseUrl, { email: member.email, password: 'password123' });

    const denied = await fetch(`${baseUrl}/api/v1/admin/users`, { headers: { cookie: memberCookie } });
    assert.equal(denied.status, 403);
    const overview = await fetch(`${baseUrl}/api/v1/admin/overview`, { headers: { cookie: adminCookie } });
    assert.equal(overview.status, 200);
    const overviewJson = await overview.json() as { metrics: { users: number }; projectStatuses: Record<string, number> };
    assert.ok(overviewJson.metrics.users >= 2);
    assert.equal(overviewJson.projectStatuses.FAILED, 1);

    const users = await fetch(`${baseUrl}/api/v1/admin/users?search=admin-test-member`, { headers: { cookie: adminCookie } });
    assert.equal(users.status, 200);
    const usersJson = await users.json() as { users: Array<{ id: string; _count: { projects: number } }> };
    assert.equal(usersJson.users.length, 1);
    assert.equal(usersJson.users[0]?._count.projects, 1);

    const projects = await fetch(`${baseUrl}/api/v1/admin/projects?search=admin-test.example.com`, { headers: { cookie: adminCookie } });
    assert.equal(projects.status, 200);
    const projectsJson = await projects.json() as { projects: Array<{ id: string; user: { email: string } }> };
    assert.equal(projectsJson.projects[0]?.id, project.id);
    assert.equal(projectsJson.projects[0]?.user.email, member.email);

    const detail = await fetch(`${baseUrl}/api/v1/admin/projects/${project.id}`, { headers: { cookie: adminCookie } });
    assert.equal(detail.status, 200);
    const detailJson = await detail.json() as { project: {
      website: string;
      defaultBrandDemoAssetId: string | null;
      mediaAssets: Array<{ id: string; metadata: Record<string, unknown> | null }>;
      jobs: Array<{ status: string; errorMessage: string | null }>;
      renderBatches: Array<{ id: string; completedAt: string; reels: Array<{ url: string }> }>;
    } };
    assert.equal(detailJson.project.website, project.website);
    assert.ok(detailJson.project.jobs.some((job) => job.errorMessage === 'Test failure'));
    assert.equal(detailJson.project.defaultBrandDemoAssetId, defaultDemo.id);
    assert.equal(detailJson.project.mediaAssets.find((asset) => asset.id === defaultDemo.id)?.metadata?.displayName, 'Default demo');
    assert.deepEqual(detailJson.project.renderBatches.map((batch) => batch.id), [newerRender.id, olderRender.id]);
    assert.deepEqual(detailJson.project.renderBatches.map((batch) => batch.reels[0]?.url), ['https://cdn.example.com/reel-newer.mp4', 'https://cdn.example.com/reel-older.mp4']);
  });
});

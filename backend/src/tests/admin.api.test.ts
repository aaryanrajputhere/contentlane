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
    const detailJson = await detail.json() as { project: { website: string; jobs: Array<{ status: string; errorMessage: string | null }> } };
    assert.equal(detailJson.project.website, project.website);
    assert.equal(detailJson.project.jobs[0]?.errorMessage, 'Test failure');
  });
});

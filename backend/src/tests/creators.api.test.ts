import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import test, { before, beforeEach } from 'node:test';
import prisma from '../lib/prisma';
import { createUserAccount, loginAndGetCookie } from './test-helpers';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://reelswarm:reelswarm@localhost:5432/reelswarm?schema=public';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-at-least-32-characters-long';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';

let createApp: typeof import('../app.js').createApp;

before(async () => {
  ({ createApp } = await import('../app.js'));
});

const testCreatorName = 'Test Creator';

beforeEach(async () => {
  await prisma.creator.deleteMany({ where: { name: testCreatorName } });
  await prisma.allowedEmail.deleteMany({ where: { email: { contains: '@example.com' } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@example.com' } } });
});

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function blob(mimeType: string, content: string) {
  return new Blob([content], { type: mimeType });
}

test('creator library requires auth for reads and admin rights for writes', async () => {
  await withServer(async (baseUrl) => {
    await createUserAccount({ email: 'admin@example.com', password: 'password123', name: 'Admin', role: 'ADMIN' });
    await createUserAccount({ email: 'member@example.com', password: 'password123', name: 'Member' });
    const adminCookie = await loginAndGetCookie(baseUrl, { email: 'admin@example.com', password: 'password123' });
    const memberCookie = await loginAndGetCookie(baseUrl, { email: 'member@example.com', password: 'password123' });

    const creatorForm = new FormData();
    creatorForm.append('name', testCreatorName);
    creatorForm.append('description', 'Creator profile for upload smoke tests');
    creatorForm.append('sortOrder', '0');
    creatorForm.append('baseImage', blob('image/png', 'creator-image'), 'creator.png');

    const memberCreateResponse = await fetch(`${baseUrl}/api/v1/creators`, {
      method: 'POST',
      headers: { cookie: memberCookie },
      body: creatorForm,
    });
    assert.equal(memberCreateResponse.status, 403);

    const createResponse = await fetch(`${baseUrl}/api/v1/creators`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: creatorForm,
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { creator: { id: string; name: string; clipCount: number; baseImageUrl: string } };
    assert.equal(created.creator.name, 'Test Creator');
    assert.equal(created.creator.clipCount, 0);
    assert.ok(created.creator.baseImageUrl.length > 0);

    const clipForm = new FormData();
    clipForm.append('title', 'Launch clip');
    clipForm.append('tags', 'Hook, Founder, Test');
    clipForm.append('sortOrder', '0');
    clipForm.append('clip', blob('video/mp4', 'clip-video'), 'clip.mp4');

    const clipCreateResponse = await fetch(`${baseUrl}/api/v1/creators/${created.creator.id}/clips`, {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: clipForm,
    });
    assert.equal(clipCreateResponse.status, 201);
    const clipCreated = await clipCreateResponse.json() as { clip: { id: string; tags: string[]; title: string | null } };
    assert.equal(clipCreated.clip.title, 'Launch clip');
    assert.deepEqual(clipCreated.clip.tags, ['hook', 'founder', 'test']);

    const anonymousListResponse = await fetch(`${baseUrl}/api/v1/creators`);
    assert.equal(anonymousListResponse.status, 401);

    const listResponse = await fetch(`${baseUrl}/api/v1/creators`, { headers: { cookie: memberCookie } });
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as { creators: Array<{ id: string; clipCount: number; clips: Array<{ id: string; tags: string[] }> }> };
    const listedCreator = list.creators.find((creator) => creator.id === created.creator.id);
    assert.ok(listedCreator);
    assert.equal(listedCreator.clipCount, 1);
    assert.deepEqual(listedCreator.clips[0]?.tags, ['hook', 'founder', 'test']);

    const memberUpdateResponse = await fetch(`${baseUrl}/api/v1/clips/${clipCreated.clip.id}`, {
      method: 'PATCH',
      headers: { cookie: memberCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated launch clip', tags: ['founder', 'demo', 'founder'] }),
    });
    assert.equal(memberUpdateResponse.status, 403);

    const clipUpdateResponse = await fetch(`${baseUrl}/api/v1/clips/${clipCreated.clip.id}`, {
      method: 'PATCH',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated launch clip', tags: ['founder', 'demo', 'founder'] }),
    });
    assert.equal(clipUpdateResponse.status, 200);
    const updatedClip = await clipUpdateResponse.json() as { clip: { title: string | null; tags: string[] } };
    assert.equal(updatedClip.clip.title, 'Updated launch clip');
    assert.deepEqual(updatedClip.clip.tags, ['founder', 'demo']);

    const deleteResponse = await fetch(`${baseUrl}/api/v1/clips/${clipCreated.clip.id}`, { method: 'DELETE', headers: { cookie: adminCookie } });
    assert.equal(deleteResponse.status, 204);

    const afterDelete = await fetch(`${baseUrl}/api/v1/creators`, { headers: { cookie: memberCookie } });
    const afterDeleteJson = await afterDelete.json() as { creators: Array<{ id: string; clipCount: number }> };
    const creatorAfterDelete = afterDeleteJson.creators.find((creator) => creator.id === created.creator.id);
    assert.ok(creatorAfterDelete);
    assert.equal(creatorAfterDelete.clipCount, 0);
  });
});

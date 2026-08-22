import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma';
import { getFreeAccess } from '../lib/access';

const createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
});
after(async () => { await prisma.$disconnect(); });

async function createFreeUser() {
  const suffix = randomUUID();
  const user = await prisma.user.create({ data: { email: `free-access-${suffix}@example.com` } });
  createdUserIds.push(user.id);
  return user;
}

async function claimProject(userId: string) {
  const project = await prisma.project.create({
    data: { userId, website: 'https://free.example.com', normalizedWebsite: `https://free-${randomUUID()}.example.com` },
  });
  await prisma.$executeRaw`UPDATE "Project" SET "freeOnboardingOwnerId" = ${userId} WHERE "id" = ${project.id}`;
  return project;
}

function hook(projectId: string, sortOrder: number, reviewDecision: 'LIKED' | 'REJECTED' | null = null) {
  return {
    projectId,
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
    reviewDecision,
  } as const;
}

test('new users receive 24 hooks while a backfilled existing user receives none', async () => {
  const newUser = await createFreeUser();
  assert.equal((await getFreeAccess(newUser.id)).limit, 24);

  const existingUser = await createFreeUser();
  await prisma.$executeRaw`UPDATE "User" SET "freeHookLimit" = 0 WHERE "id" = ${existingUser.id}`;
  const existingAccess = await getFreeAccess(existingUser.id);
  assert.equal(existingAccess.limit, 0);
  assert.equal(existingAccess.ended, true);
});

test('free access requires conversion at eight selections or after all 24 reviews', async () => {
  const selectedUser = await createFreeUser();
  const selectedProject = await claimProject(selectedUser.id);
  await prisma.hookConcept.createMany({ data: Array.from({ length: 8 }, (_, index) => hook(selectedProject.id, index, 'LIKED')) });
  const selectedAccess = await getFreeAccess(selectedUser.id);
  assert.equal(selectedAccess.selected, 8);
  assert.equal(selectedAccess.conversionRequired, true);

  const reviewedUser = await createFreeUser();
  const reviewedProject = await claimProject(reviewedUser.id);
  await prisma.hookConcept.createMany({ data: Array.from({ length: 24 }, (_, index) => hook(reviewedProject.id, index, index < 3 ? 'LIKED' : 'REJECTED')) });
  const reviewedAccess = await getFreeAccess(reviewedUser.id);
  assert.deepEqual({ generated: reviewedAccess.generated, reviewed: reviewedAccess.reviewed, selected: reviewedAccess.selected, remaining: reviewedAccess.remaining }, { generated: 24, reviewed: 24, selected: 3, remaining: 0 });
  assert.equal(reviewedAccess.conversionRequired, true);
});

test('ending free access is permanent state independent of remaining hooks', async () => {
  const user = await createFreeUser();
  await prisma.$executeRaw`UPDATE "User" SET "freeAccessEndedAt" = NOW() WHERE "id" = ${user.id}`;
  const access = await getFreeAccess(user.id);
  assert.equal(access.ended, true);
  assert.equal(access.remaining, 24);
});

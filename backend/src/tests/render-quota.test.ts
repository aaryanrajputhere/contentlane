import assert from 'node:assert/strict';
import test from 'node:test';
import './test-env';
import prisma from '../lib/prisma';
import { consumeRenderReservation, createReservedRenderJob, getRenderUsage, releaseRenderReservation } from '../lib/render-quota';

test('Starter reservations enforce concurrent limits and release or consume capacity', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({ data: { email: `quota-${suffix}@example.com` } });
  try {
    const project = await prisma.project.create({ data: { userId: user.id, website: 'https://quota.example.com', normalizedWebsite: `quota-${suffix}.example.com` } });
    const periodStart = new Date('2026-08-01T00:00:00.000Z');
    const periodEnd = new Date('2026-09-01T00:00:00.000Z');
    await prisma.subscription.create({ data: {
      userId: user.id,
      dodoCustomerId: `cus_${suffix}`,
      dodoSubscriptionId: `sub_${suffix}`,
      dodoProductId: 'pdt_test_starter',
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      latestProviderEventAt: new Date(),
    } });

    assert.deepEqual(await getRenderUsage(user.id, 'USER'), { limit: 30, consumed: 0, reserved: 0, remaining: 30, periodStart, periodEnd });
    const attempts = await Promise.allSettled([20, 20].map((requestedCount) => createReservedRenderJob({
      userId: user.id,
      role: 'USER',
      projectId: project.id,
      renderInput: { projectId: project.id, conceptIds: [], assignments: [] },
      requestedCount,
    })));
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
    const reservedJob = attempts.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createReservedRenderJob>>> => result.status === 'fulfilled')!.value;
    assert.equal((await getRenderUsage(user.id, 'USER')).remaining, 10);

    await releaseRenderReservation(reservedJob.id);
    assert.equal((await getRenderUsage(user.id, 'USER')).remaining, 30);

    const completedJob = await createReservedRenderJob({ userId: user.id, role: 'USER', projectId: project.id, renderInput: {}, requestedCount: 3 });
    await consumeRenderReservation(completedJob.id, 2);
    const usage = await getRenderUsage(user.id, 'USER');
    assert.deepEqual({ consumed: usage.consumed, reserved: usage.reserved, remaining: usage.remaining }, { consumed: 2, reserved: 0, remaining: 28 });
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});

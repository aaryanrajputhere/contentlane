import './load-env';
import { Worker, type Job } from 'bullmq';
import { JobStatus, Prisma } from '@prisma/client';
import prisma from './lib/prisma';
import { renderConnection } from './lib/render-queue';
import { renderReel } from './lib/reel-renderer';
import { composeDemoOverlayText } from './lib/render-overlay';
import type { RenderJobInput } from './lib/render-queue';
import { consumeRenderReservation, releaseRenderReservation } from './lib/render-quota';

function captionStyleForSortOrder(sortOrder: number): 'SNAPCHAT' | 'STANDARD' {
  return sortOrder % 2 === 0 ? 'SNAPCHAT' : 'STANDARD';
}

const worker = new Worker<RenderJobInput>('contentlane-render-reels', async (job: Job<RenderJobInput>) => {
  const input = job.data;
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { concepts: { orderBy: { sortOrder: 'asc' } }, mediaAssets: true, brandProfile: true, websiteAnalysis: true },
  });
  if (!project) {
    await prisma.$transaction(async (tx) => {
      await tx.generationJob.update({ where: { id: job.id }, data: { status: JobStatus.FAILED, progress: 100, progressMessage: 'Reel render failed', errorMessage: 'Project no longer exists' } });
      await releaseRenderReservation(job.id!, tx);
    });
    throw new Error('Project no longer exists');
  }
  const demo = project.mediaAssets.find((asset) => asset.conceptId === null && asset.type === 'VIDEO' && typeof asset.metadata === 'object' && asset.metadata !== null && (asset.metadata as Record<string, unknown>).kind === 'brand-demo');
  if (!demo) {
    await prisma.$transaction(async (tx) => {
      await tx.generationJob.update({ where: { id: job.id }, data: { status: JobStatus.FAILED, progress: 100, progressMessage: 'Reel render failed', errorMessage: 'Brand demo is missing' } });
      await releaseRenderReservation(job.id!, tx);
    });
    throw new Error('Brand demo is missing');
  }
  await prisma.generationJob.update({ where: { id: job.id }, data: { status: JobStatus.ACTIVE, progress: 1, progressMessage: `Rendering 0 of ${input.conceptIds.length} Reels` } });
  const outputs: Array<Record<string, unknown>> = [];
  try {
    for (const [index, assignment] of input.assignments.entries()) {
      const concept = project.concepts.find((item) => item.id === assignment.conceptId);
      if (!concept) throw new Error(`Concept ${assignment.conceptId} no longer exists`);
      const hookAsset = project.mediaAssets.find((asset) => asset.conceptId === concept.id && asset.type === 'VIDEO');
      const hookUrl = assignment.clipUrl || hookAsset?.url;
      if (!hookUrl) throw new Error(`Creator clip is missing for Reel ${index + 1}`);
      await prisma.generationJob.update({ where: { id: job.id }, data: { progress: Math.round((index / input.assignments.length) * 90) + 5, progressMessage: `Rendering Reel ${index + 1} of ${input.assignments.length}` } });
      const demoOverlay = composeDemoOverlayText(concept.demoOverlayText, concept.sortOrder, project.brandProfile?.brandName, project.websiteAnalysis?.rootDomain ?? null, project.website);
      const output = await renderReel({ hookUrl, demoUrl: demo.url, hookOverlay: concept.hookText, demoOverlay, captionStyle: captionStyleForSortOrder(concept.sortOrder), outputId: `${project.id}-${job.id}-reel-${index + 1}`, folder: `ContentLane/projects/${project.id}/renders` });
      outputs.push({ conceptId: concept.id, clipId: assignment.clipId, creatorName: assignment.creatorName, sortOrder: concept.sortOrder, url: output.url, provider: output.provider, providerId: output.providerId, mimeType: output.mimeType, format: output.format });
    }
    const result = { format: 'mp4', reels: outputs };
    await prisma.$transaction(async (tx) => {
      await tx.generationJob.update({ where: { id: job.id }, data: { status: JobStatus.COMPLETED, progress: 100, progressMessage: `Rendered ${outputs.length} Reels`, result: result as unknown as Prisma.InputJsonValue } });
      await consumeRenderReservation(job.id!, outputs.length, tx);
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render failed';
    await prisma.$transaction(async (tx) => {
      await tx.generationJob.update({ where: { id: job.id }, data: { status: JobStatus.FAILED, progress: 100, progressMessage: 'Reel render failed', errorMessage: message } });
      await releaseRenderReservation(job.id!, tx);
    });
    throw error;
  }
}, { connection: renderConnection, concurrency: 1 });

worker.on('failed', (job, error) => console.error(`[render-worker] job=${job?.id ?? 'unknown'} failed`, error));

async function shutdown() {
  await worker.close();
  await renderConnection.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

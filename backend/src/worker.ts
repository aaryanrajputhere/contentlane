import "dotenv/config";
import { JobStatus, JobType, Prisma, UsageStatus } from "@prisma/client";
import { Worker, type Job } from "bullmq";
import prisma from "./lib/prisma";
import { redis } from "./lib/redis";
import { logger } from "./lib/logger";
import { settleQuota } from "./lib/quota";
import {
  analyzeWebsite,
  generateSceneImage,
  generateSceneVideo,
  generateScripts,
  parseScenes,
  stableKey,
} from "./services/providers";
import type { ScriptHookInput } from "./domain/schemas";

class CancelledError extends Error {}

async function updateJob(
  id: string,
  progress: number,
  progressMessage: string,
  data: Prisma.GenerationJobUpdateInput = {},
) {
  await prisma.generationJob.update({
    where: { id },
    data: { progress, progressMessage, ...data },
  });
}

async function assertNotCancelled(id: string) {
  const state = await prisma.generationJob.findUnique({
    where: { id },
    select: { cancelRequestedAt: true, status: true },
  });
  if (!state || state.cancelRequestedAt || state.status === JobStatus.CANCELLED)
    throw new CancelledError("Job cancelled");
}

const productKey = (product: { url: string | null; name: string }) =>
  stableKey(product.url || product.name.trim().toLowerCase());

async function processGeneration(job: Job<{ generationJobId: string }>) {
  const dbJob = await prisma.generationJob.findUnique({
    where: { id: job.data.generationJobId },
  });
  if (!dbJob || dbJob.status === JobStatus.CANCELLED) return;
  await prisma.generationJob.update({
    where: { id: dbJob.id },
    data: {
      status: JobStatus.ACTIVE,
      startedAt: dbJob.startedAt ?? new Date(),
      attempts: { increment: 1 },
      progressMessage: "Starting",
    },
  });
  const input = dbJob.input as Record<string, unknown>;
  let result: Prisma.InputJsonValue = {};
  try {
    await assertNotCancelled(dbJob.id);
    if (dbJob.type === JobType.CAMPAIGN_ANALYSIS) {
      await updateJob(dbJob.id, 10, "Discovering website pages");
      const { analysis, brand } = await analyzeWebsite(String(input.website));
      await assertNotCancelled(dbJob.id);
      await updateJob(dbJob.id, 65, "Saving brand profile and products");
      const isRegeneration = input.forceRegenerate === true;
      await prisma.$transaction(async (tx) => {
        if (isRegeneration) {
          await tx.scriptGeneration.deleteMany({
            where: { campaignId: dbJob.campaignId! },
          });
          await tx.product.deleteMany({
            where: { campaignId: dbJob.campaignId! },
          });
        }
        await tx.brandContext.upsert({
          where: { campaignId: dbJob.campaignId! },
          update: { ...brand, hooks: Prisma.DbNull },
          create: { campaignId: dbJob.campaignId!, ...brand },
        });
        for (const product of analysis.products.slice(0, 100)) {
          const sourceKey = productKey(product);
          await tx.product.upsert({
            where: {
              campaignId_sourceKey: {
                campaignId: dbJob.campaignId!,
                sourceKey,
              },
            },
            update: {
              name: product.name,
              description: product.description,
              imageUrls: product.imageUrls,
              url: product.url,
            },
            create: {
              campaignId: dbJob.campaignId!,
              sourceKey,
              name: product.name,
              description: product.description,
              imageUrls: product.imageUrls,
              url: product.url,
            },
          });
        }
        await tx.campaign.update({
          where: { id: dbJob.campaignId! },
          data: { status: "COMPLETED" },
        });
      });
      const campaign = await prisma.campaign.findUnique({
        where: { id: dbJob.campaignId! },
        include: { brandContext: true, products: true },
      });
      result = {
        campaignId: campaign!.id,
        brandContext: campaign!.brandContext as Prisma.InputJsonValue,
        products: campaign!.products as unknown as Prisma.InputJsonValue,
        totalProductsFound: analysis.totalProductsFound,
      };
    } else if (dbJob.type === JobType.HOOK_GENERATION) {
      throw new Error("AI hook generation is disabled. Use admin-created hooks.");
    } else if (dbJob.type === JobType.SCRIPT_GENERATION) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: dbJob.campaignId! },
        include: { brandContext: true },
      });
      const product = await prisma.product.findUnique({
        where: { id: String(input.productId) },
      });
      if (!campaign?.brandContext || !product)
        throw new Error("Campaign data is incomplete");
      await updateJob(dbJob.id, 20, "Writing visual scripts");
      const scripts = await generateScripts(
        campaign.brandContext,
        product,
        input.hooks as ScriptHookInput[],
        input.character as string | null,
        input.productImageUrl as string | null,
        input.characterImageUrl as string | null,
      );
      const saved = [];
      for (const script of scripts)
        saved.push(
          await prisma.scriptGeneration.create({
            data: {
              campaignId: campaign.id,
              productId: product.id,
              hook: script.hook,
              scenes: script.scenes,
              templateType: script.templateType,
              cta: script.cta,
              durationSeconds: script.durationSeconds,
            },
          }),
        );
      result = { scripts: saved as unknown as Prisma.InputJsonValue };
    } else if (
      dbJob.type === JobType.IMAGE_GENERATION ||
      dbJob.type === JobType.VIDEO_GENERATION
    ) {
      const script = await prisma.scriptGeneration.findUnique({
        where: { id: dbJob.scriptId! },
      });
      if (!script) throw new Error("Script not found");
      const scenes = parseScenes(script.scenes);
      for (let index = 0; index < scenes.length; index += 1) {
        await assertNotCancelled(dbJob.id);
        await updateJob(
          dbJob.id,
          Math.round((index / scenes.length) * 90),
          `${dbJob.type === JobType.IMAGE_GENERATION ? "Generating image" : "Generating video"} ${index + 1} of ${scenes.length}`,
        );
        try {
          if (dbJob.type === JobType.IMAGE_GENERATION)
            scenes[index].generatedImageUrl = await generateSceneImage(
              scenes[index],
              index,
              input.characterImageUrl as string | undefined,
              input.productImageUrl as string | undefined,
            );
          else
            scenes[index].generatedVideoUrl = await generateSceneVideo(
              scenes[index],
              index,
            );
          delete scenes[index].error;
        } catch (error) {
          scenes[index].error =
            error instanceof Error
              ? error.message.slice(0, 300)
              : "Scene generation failed";
        }
        await prisma.scriptGeneration.update({
          where: { id: script.id },
          data: { scenes },
        });
      }
      result = { scriptId: script.id, scenes } as Prisma.InputJsonValue;
    }
    await prisma.generationJob.update({
      where: { id: dbJob.id },
      data: {
        status: JobStatus.COMPLETED,
        progress: 100,
        progressMessage: "Completed",
        result,
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    await settleQuota(dbJob.id, UsageStatus.CONSUMED);
    return result;
  } catch (error) {
    if (error instanceof CancelledError) {
      await prisma.generationJob.update({
        where: { id: dbJob.id },
        data: {
          status: JobStatus.CANCELLED,
          progressMessage: "Cancelled",
          completedAt: new Date(),
        },
      });
      await settleQuota(dbJob.id, UsageStatus.RELEASED);
      return;
    }
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const providerMessage =
      error instanceof Error
        ? error.message.slice(0, 500)
        : "Unknown generation error";
    await prisma.generationJob.update({
      where: { id: dbJob.id },
      data: {
        status: finalAttempt ? JobStatus.FAILED : JobStatus.QUEUED,
        errorCode: "GENERATION_FAILED",
        errorMessage: "Generation failed: " + providerMessage,
        progressMessage: finalAttempt ? "Failed" : "Retrying",
      },
    });
    if (dbJob.type === JobType.CAMPAIGN_ANALYSIS && finalAttempt)
      await prisma.campaign.update({
        where: { id: dbJob.campaignId! },
        data: { status: "FAILED" },
      });
    if (finalAttempt) await settleQuota(dbJob.id, UsageStatus.RELEASED);
    logger.error(
      {
        err: error,
        jobId: dbJob.id,
        userId: dbJob.userId,
        campaignId: dbJob.campaignId,
      },
      "generation job failed",
    );
    throw error;
  }
}

const worker = new Worker("generation", processGeneration, {
  connection: redis,
  concurrency: 2,
  lockDuration: 10 * 60_000,
});
worker.on("completed", (job) =>
  logger.info({ jobId: job.id }, "generation job completed"),
);
worker.on("failed", (job, error) =>
  logger.error({ jobId: job?.id, err: error }, "queue attempt failed"),
);

async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutting down");
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

import type { RequestHandler } from "express";
import { JobStatus, JobType, Prisma, ProjectStatus, ReviewDecision } from "@prisma/client";
import prisma from "../lib/prisma";
import { ApiError } from "../lib/errors";
import type { BrandProfile, CreatorCharacter, HookPreferenceExample } from "../domain/schemas";
import {
  characterSelectionSchema,
  conceptSelectionSchema,
  conceptStageInputSchema,
  conceptReviewParamsSchema,
  conceptReviewResetSchema,
  conceptReviewSchema,
  creatorCharacterSchema,
  exportPayloadSchema,
  hookPreferencesSchema,
  jobIdParamsSchema,
  mediaStageInputSchema,
  projectCreatorSelectionSchema,
  projectIdParamsSchema,
  renderRequestSchema,
  websiteInputSchema,
} from "../domain/schemas";
import {
  buildConceptCards,
  buildExportState,
  buildWebsiteAnalysisStorageData,
  clearGeneratedContent,
  generateCharacterImageAssetForConcept,
  generateCharacterMediaForConcept,
  generateCharacterVideoAssetForConcept,
  loadProjectSnapshot,
  normalizeWebsiteInput,
  projectSnapshotInclude,
  type ConceptBlueprint,
} from "../lib/workflow";
import { runWebsiteIntelligencePipeline } from "../lib/website-intelligence/pipeline";
import { generateHooksFromLLM } from "../lib/website-intelligence/hooks";
import { withLLMTelemetry } from "../lib/website-intelligence/llm";
import { deleteStoredAsset, storeUploadedAsset } from "../lib/asset-storage";
import { createAnalysisJsonRecorder, errorJson } from "../lib/analysis-json";
import { creatorToCharacter } from "../lib/creator-library";
import { renderQueue, type RenderJobInput } from "../lib/render-queue";

function toBrandProfilePrismaData(
  profile: Omit<BrandProfile, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
) {
  return profile;
}

function asBrandProfile(prismaProfile: {
  id: string;
  projectId: string;
  brandName: string;
  [key: string]: unknown;
}): BrandProfile {
  return prismaProfile as unknown as BrandProfile;
}

type HookPreferencePayload = {
  liked: HookPreferenceExample[];
  rejected: HookPreferenceExample[];
  updatedAt: Date;
};

function normalizeHookPreferences(value: unknown): HookPreferencePayload | null {
  const parsed = hookPreferencesSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.examples?.length) {
    return { liked: parsed.data.examples, rejected: [], updatedAt: parsed.data.updatedAt };
  }
  return parsed.data;
}

async function createJob(
  projectId: string,
  type: JobType,
  input: Prisma.InputJsonValue,
) {
  return prisma.generationJob.create({
    data: { projectId, type, input, status: JobStatus.QUEUED, progress: 0 },
  });
}

async function updateJob(id: string, data: Prisma.GenerationJobUpdateInput) {
  return prisma.generationJob.update({ where: { id }, data });
}

async function runStage<T>(
  projectId: string,
  type: JobType,
  input: Prisma.InputJsonValue,
  label: string,
  fn: (job: { id: string; createdAt: Date }) => Promise<T>,
  existingJob?: { id: string; createdAt: Date },
) {
  const job = existingJob ?? await createJob(projectId, type, input);
  await updateJob(job.id, {
    status: JobStatus.ACTIVE,
    progress: 10,
    progressMessage: label,
  });
  try {
    const { result, telemetry } = await withLLMTelemetry(() => fn(job));
    await updateJob(job.id, {
      status: JobStatus.COMPLETED,
      progress: 100,
      progressMessage: `${label} complete`,
      result: { data: result, llmTelemetry: telemetry } as unknown as Prisma.InputJsonValue,
    });
    return { jobId: job.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateJob(job.id, {
      status: JobStatus.FAILED,
      progress: 100,
      progressMessage: `${label} failed`,
      errorMessage: message,
    });
    throw error;
  }
}

function assertProject(value: Awaited<ReturnType<typeof loadProjectSnapshot>>) {
  if (!value) throw new ApiError(404, "NOT_FOUND", "Project not found");
  return value;
}

function requireUserId(req: Express.Request) {
  if (!req.user)
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to continue");
  return req.user.id;
}

async function getProjectOrFail(id: string, userId: string) {
  return assertProject(await loadProjectSnapshot(id, userId));
}

function resolveSelectedCharacter(
  project: Awaited<ReturnType<typeof getProjectOrFail>>,
  concept?: { id: string; sortOrder: number } | null,
) {
  if (project.creatorSelection) {
    const parsed = projectCreatorSelectionSchema.safeParse(project.creatorSelection);
    if (parsed.success) {
      const characters = parsed.data.characters;
      if (parsed.data.mode === "mix" && concept) {
        const conceptIndex = project.concepts.findIndex((item) => item.id === concept.id);
        return characters[(conceptIndex >= 0 ? conceptIndex : concept.sortOrder) % characters.length] ?? null;
      }
      return characters[0] ?? null;
    }
  }
  if (!project.selectedCharacter) return null;
  return creatorCharacterSchema.parse(project.selectedCharacter);
}

async function clearCreativeArtifacts(projectId: string) {
  const project = await loadProjectSnapshot(projectId);
  const preserveIds =
    project?.mediaAssets.filter(isBrandDemoAsset).map((asset) => asset.id) ??
    [];
  const mediaDelete =
    preserveIds.length > 0
      ? prisma.mediaAsset.deleteMany({
          where: { projectId, NOT: { id: { in: preserveIds } } },
        })
      : prisma.mediaAsset.deleteMany({ where: { projectId } });
  await prisma.$transaction([
    mediaDelete,
    prisma.projectExport.deleteMany({ where: { projectId } }),
    prisma.hookConcept.updateMany({
      where: { projectId },
      data: { generatedImageUrl: null, generatedVideoUrl: null },
    }),
  ]);
}

async function resetProjectForNewFlow(projectId: string) {
  const project = await loadProjectSnapshot(projectId);
  if (!project) return;
  await Promise.all(
    project.mediaAssets.map((asset) =>
      deleteStoredAsset({
        provider: asset.provider,
        providerId: asset.providerId,
        mimeType: asset.mimeType,
      }),
    ),
  );
  await prisma.$transaction([
    prisma.mediaAsset.deleteMany({ where: { projectId } }),
    prisma.hookConcept.deleteMany({ where: { projectId } }),
    prisma.projectExport.deleteMany({ where: { projectId } }),
    prisma.websiteAnalysis.deleteMany({ where: { projectId } }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        status: "DRAFT",
        selectedConceptId: null,
        selectedCharacterId: null,
        selectedCharacter: Prisma.JsonNull,
        creatorSelection: Prisma.JsonNull,
      },
    }),
  ]);
  await prisma.$executeRaw`
    UPDATE "Project"
    SET "hookPreferences" = NULL
    WHERE "id" = ${projectId}
  `;
}

function isBrandDemoAsset(asset: {
  conceptId: string | null;
  type: string;
  metadata: Prisma.JsonValue | null;
}) {
  if (
    asset.conceptId !== null ||
    asset.type !== "VIDEO" ||
    !asset.metadata ||
    typeof asset.metadata !== "object"
  ) {
    return false;
  }
  return (asset.metadata as Record<string, unknown>).kind === "brand-demo";
}

function requireVideoFile(
  file: Express.Multer.File | undefined,
  message: string,
) {
  if (!file) throw new ApiError(400, "FILE_REQUIRED", message);
  if (!file.mimetype.startsWith("video/"))
    throw new ApiError(400, "INVALID_FILE_TYPE", message);
  return file;
}

function conceptOrFail(
  project: Awaited<ReturnType<typeof getProjectOrFail>>,
  conceptId?: string | null,
) {
  const resolvedId = conceptId ?? project.selectedConceptId;
  if (!resolvedId)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Select a concept before generating media",
    );
  const concept = project.concepts.find((item) => item.id === resolvedId);
  if (!concept)
    throw new ApiError(
      404,
      "CONCEPT_NOT_FOUND",
      "Concept not found for this project",
    );
  return concept;
}

async function selectConceptForProject(
  projectId: string,
  conceptId: string | null,
  userId: string,
) {
  const project = await getProjectOrFail(projectId, userId);
  if (
    conceptId &&
    !project.concepts.some((concept) => concept.id === conceptId)
  ) {
    throw new ApiError(
      404,
      "CONCEPT_NOT_FOUND",
      "Concept not found for this project",
    );
  }
  const selectionChanged = project.selectedConceptId !== conceptId;
  if (selectionChanged) {
    await clearCreativeArtifacts(project.id);
    await prisma.project.update({
      where: { id: project.id },
      data: {
        selectedConceptId: conceptId,
        ...(conceptId ? {} : { status: "READY" }),
      },
    });
  } else if (!project.selectedConceptId && conceptId === null) {
    await prisma.project.update({
      where: { id: project.id },
      data: { selectedConceptId: null },
    });
  }
  return assertProject(await loadProjectSnapshot(project.id, userId));
}

async function analyzeProjectById(
  projectId: string,
  userId: string,
  options: { forceRegenerate: boolean; existingJob?: { id: string; createdAt: Date } },
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: projectSnapshotInclude,
  });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  if (project.brandProfile && !options.forceRegenerate) {
    return { project, cached: true };
  }
  await prisma.project.update({
    where: { id: project.id },
    data: { status: "ANALYZING" },
  });
  await clearGeneratedContent(project.id);
  try {
    const { jobId, result } = await runStage(
      project.id,
      JobType.ANALYZE_WEBSITE,
      { website: project.website, forceRegenerate: options.forceRegenerate },
      "Analyzing website",
      async (analysisJob) => {
        const recorder = createAnalysisJsonRecorder({
          website: project.normalizedWebsite,
          projectId: project.id,
          analysisJobId: analysisJob.id,
          startedAt: analysisJob.createdAt,
        });
        await recorder.write('analysis-request', {
          projectId: project.id,
          website: project.website,
          normalizedWebsite: project.normalizedWebsite,
          forceRegenerate: options.forceRegenerate,
          analysisJobId: analysisJob.id,
          startedAt: analysisJob.createdAt,
        });
        try {
          const analysisResult = await runWebsiteIntelligencePipeline(
            project.website,
            recorder,
          );
          await prisma.$transaction([
            prisma.brandProfile.upsert({
              where: { projectId: project.id },
              update: toBrandProfilePrismaData(analysisResult.brandProfile),
              create: { projectId: project.id, ...toBrandProfilePrismaData(analysisResult.brandProfile) },
            }),
            prisma.websiteAnalysis.upsert({
              where: { projectId: project.id },
              update: buildWebsiteAnalysisStorageData(analysisResult.analysis),
              create: {
                projectId: project.id,
                ...buildWebsiteAnalysisStorageData(analysisResult.analysis),
              },
            }),
            prisma.project.update({
              where: { id: project.id },
              data: { status: "READY" },
            }),
          ]);
          const snapshot = await loadProjectSnapshot(project.id, userId);
          await recorder.write('analysis-project-snapshot', snapshot);
          return analysisResult;
        } catch (error) {
          await recorder.write('analysis-error', errorJson(error));
          throw error;
        }
      },
      options.existingJob,
    );
    const next = assertProject(await loadProjectSnapshot(project.id, userId));
    return {
      project: next,
      job: await prisma.generationJob.findUnique({ where: { id: jobId } }),
      brandProfile: result.brandProfile,
      analysis: result.analysis,
      cached: false,
    };
  } catch (error) {
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

async function writeConceptAsset(
  projectId: string,
  conceptId: string,
  type: "IMAGE" | "VIDEO",
  asset: {
    provider: string;
    providerId: string | null;
    url: string;
    mimeType: string | null;
    metadata: Prisma.InputJsonValue;
  },
) {
  await prisma.mediaAsset.deleteMany({ where: { projectId, conceptId, type } });
  await prisma.mediaAsset.create({
    data: {
      projectId,
      conceptId,
      type,
      provider: asset.provider,
      providerId: asset.providerId,
      url: asset.url,
      mimeType: asset.mimeType,
      metadata: asset.metadata,
    },
  });
}

export const createProject: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { website } = websiteInputSchema.parse(req.body);
  const normalizedWebsite = normalizeWebsiteInput(website);
  const existingProject = await prisma.project.findFirst({
    where: { userId, normalizedWebsite },
  });

  if (existingProject) {
    const project = await prisma.project.update({
      where: { id: existingProject.id },
      data: { website: website.trim(), normalizedWebsite },
    });
    const snapshot = assertProject(await loadProjectSnapshot(project.id, userId));
    if (snapshot.brandProfile) {
      res.status(200).json({ project: snapshot, cached: true });
      return;
    }
    const analysisJob = await createJob(project.id, JobType.ANALYZE_WEBSITE, {
      website: project.website,
      forceRegenerate: false,
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: ProjectStatus.ANALYZING } });
    void analyzeProjectById(project.id, userId, { forceRegenerate: false, existingJob: analysisJob }).catch((error) => {
      console.error(`[projects] background analysis failed project=${project.id}:`, error);
    });
    res.status(200).json({ project: assertProject(await loadProjectSnapshot(project.id, userId)), job: analysisJob, cached: false });
    return;
  }

  const project = await prisma.project.create({
    data: {
      userId,
      website: website.trim(),
      normalizedWebsite,
      status: "DRAFT",
    },
  });

  const analysisJob = await createJob(project.id, JobType.ANALYZE_WEBSITE, {
    website: project.website,
    forceRegenerate: false,
  });
  await prisma.project.update({ where: { id: project.id }, data: { status: ProjectStatus.ANALYZING } });
  void analyzeProjectById(project.id, userId, { forceRegenerate: false, existingJob: analysisJob }).catch((error) => {
    console.error(`[projects] background analysis failed project=${project.id}:`, error);
  });
  res.status(201).json({ project: assertProject(await loadProjectSnapshot(project.id, userId)), job: analysisJob, cached: false });
};

export const analyzeProject: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { forceRegenerate } = req.body as { forceRegenerate?: boolean };
  const project = await getProjectOrFail(id, userId);
  if (project.brandProfile && !forceRegenerate) {
    res.json({ project, cached: true });
    return;
  }
  const analysisJob = await createJob(id, JobType.ANALYZE_WEBSITE, {
    website: project.website,
    forceRegenerate: Boolean(forceRegenerate),
  });
  await prisma.project.update({ where: { id }, data: { status: ProjectStatus.ANALYZING } });
  void analyzeProjectById(id, userId, { forceRegenerate: Boolean(forceRegenerate), existingJob: analysisJob }).catch((error) => {
    console.error(`[projects] background analysis failed project=${id}:`, error);
  });
  res.json({ project: assertProject(await loadProjectSnapshot(id, userId)), job: analysisJob, cached: false });
};

export const uploadBrandDemo: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const project = await getProjectOrFail(id, userId);
  const demoFile = requireVideoFile(
    req.file,
    "Upload a video file for the brand demo",
  );
  const existingDemoAssets = project.mediaAssets.filter(isBrandDemoAsset);
  const stored = await storeUploadedAsset(demoFile.buffer, {
    folder: `ContentLane/projects/${project.id}/brand-demo`,
    publicId: `${project.id}-${Date.now()}-${demoFile.originalname}`,
    mimeType: demoFile.mimetype,
  });
  try {
    await prisma.$transaction([
      prisma.mediaAsset.deleteMany({
        where: {
          projectId: project.id,
          id: { in: existingDemoAssets.map((asset) => asset.id) },
        },
      }),
      prisma.mediaAsset.create({
        data: {
          projectId: project.id,
          conceptId: null,
          type: "VIDEO",
          provider: stored.provider,
          providerId: stored.providerId,
          url: stored.url,
          mimeType: stored.mimeType,
          metadata: {
            ...(stored.metadata as Record<string, unknown>),
            kind: "brand-demo",
            originalName: demoFile.originalname,
            uploadedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      }),
    ]);
  } catch (error) {
    await deleteStoredAsset({
      provider: stored.provider,
      providerId: stored.providerId,
      mimeType: stored.mimeType,
    }).catch(() => undefined);
    throw error;
  }
  await Promise.allSettled(
    existingDemoAssets.map((asset) =>
      deleteStoredAsset({
        provider: asset.provider,
        providerId: asset.providerId,
        mimeType: asset.mimeType,
      }),
    ),
  );
  res
    .status(201)
    .json({
      project: assertProject(await loadProjectSnapshot(project.id, userId)),
    });
};

export const getProject: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const project = await getProjectOrFail(id, userId);
  res.json({ project });
};

export const selectConcept: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptId } = conceptSelectionSchema.parse(req.body);
  const project = await selectConceptForProject(id, conceptId, userId);
  res.json({ project });
};

export const saveHookPreferences: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const selection = req.body as {
    likedConceptIds: string[];
    rejectedConceptIds: string[];
    legacy: boolean;
  };
  const likedConceptIds = selection.likedConceptIds;
  const rejectedConceptIds = selection.legacy ? [] : selection.rejectedConceptIds;
  const project = await getProjectOrFail(id, userId);
  const findExample = (conceptId: string) => {
    const concept = project.concepts.find((item) => item.id === conceptId);
    if (!concept) {
      throw new ApiError(404, "CONCEPT_NOT_FOUND", "One or more selected hooks do not belong to this project");
    }
    return {
      hookText: concept.hookText,
      demoOverlayText: concept.demoOverlayText,
      angle: concept.angle,
      score: concept.score,
      selectedAt: new Date(),
    };
  };
  const preferences: HookPreferencePayload = {
    liked: likedConceptIds.map(findExample),
    rejected: rejectedConceptIds.map(findExample),
    updatedAt: new Date(),
  };
  await prisma.$executeRaw`
    UPDATE "Project"
    SET "hookPreferences" = ${JSON.stringify(preferences)}::jsonb
    WHERE "id" = ${id}
  `;
  res.json({ project: assertProject(await loadProjectSnapshot(id, userId)) });
};

export const reviewConcept: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id, conceptId } = conceptReviewParamsSchema.parse(req.params);
  const { decision } = conceptReviewSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    const concept = await tx.hookConcept.findFirst({
      where: { id: conceptId, projectId: id, project: { userId } },
      select: { id: true, reviewDecision: true },
    });
    if (!concept) throw new ApiError(404, "CONCEPT_NOT_FOUND", "Hook not found for this project");
    if (concept.reviewDecision !== null) {
      if (concept.reviewDecision === decision) return;
      throw new ApiError(409, "REVIEW_ALREADY_SAVED", "This hook has already been reviewed");
    }
    if (decision === ReviewDecision.LIKED) {
      const likedCount = await tx.hookConcept.count({ where: { projectId: id, reviewDecision: ReviewDecision.LIKED } });
      if (likedCount >= 8) throw new ApiError(409, "HOOK_SELECTION_COMPLETE", "Eight hooks are already selected");
    }
    await tx.hookConcept.update({ where: { id: concept.id }, data: { reviewDecision: decision } });
  });
  res.json({ project: assertProject(await loadProjectSnapshot(id, userId)) });
};

export const resetConceptReviews: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { clearDependentOutputs } = conceptReviewResetSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  const hasDependentOutputs = Boolean(
    project.exportState
    || project.mediaAssets.some((asset) => !isBrandDemoAsset(asset))
    || project.concepts.some((concept) => concept.generatedImageUrl || concept.generatedVideoUrl),
  );
  if (hasDependentOutputs && !clearDependentOutputs) {
    throw new ApiError(409, "DEPENDENT_OUTPUTS_EXIST", "Generated media and renders must be cleared before reviewing again");
  }
  if (hasDependentOutputs) await clearCreativeArtifacts(project.id);
  await prisma.hookConcept.updateMany({ where: { projectId: project.id }, data: { reviewDecision: null } });
  res.json({ project: assertProject(await loadProjectSnapshot(id, userId)) });
};

export const selectCharacter: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const input = characterSelectionSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  let nextSelection: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  let nextCharacter: CreatorCharacter | null = null;

  if ('selection' in input) {
    const creatorInclude = {
      clips: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
    };
    if (input.selection.mode === 'mix') {
      const creators = await prisma.creator.findMany({
        where: { clips: { some: {} } },
        include: creatorInclude,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      if (creators.length < 2) {
        throw new ApiError(409, 'MIX_UNAVAILABLE', 'Add clips to at least two creators before using Mix');
      }
      const characters = creators.map(creatorToCharacter);
      nextCharacter = characters[0] ?? null;
      nextSelection = projectCreatorSelectionSchema.parse({ mode: 'mix', characters }) as Prisma.InputJsonValue;
    } else {
      const creator = await prisma.creator.findUnique({
        where: { id: input.selection.creatorId },
        include: creatorInclude,
      });
      if (!creator) throw new ApiError(404, 'NOT_FOUND', 'Creator not found');
      if (creator.clips.length === 0) {
        throw new ApiError(409, 'CREATOR_HAS_NO_CLIPS', 'Add at least one clip before selecting this creator');
      }
      nextCharacter = creatorToCharacter(creator);
      nextSelection = projectCreatorSelectionSchema.parse({
        mode: 'single',
        characters: [nextCharacter],
      }) as Prisma.InputJsonValue;
    }
  } else {
    nextCharacter = input.character ? creatorCharacterSchema.parse(input.character) : null;
    nextSelection = nextCharacter
      ? (projectCreatorSelectionSchema.parse({
          mode: 'single',
          characters: [nextCharacter],
        }) as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  const comparableNextSelection = nextSelection === Prisma.JsonNull ? null : nextSelection;
  const selectionChanged = JSON.stringify(project.creatorSelection) !== JSON.stringify(comparableNextSelection);
  if (!selectionChanged) {
    res.json({ project });
    return;
  }
  await clearCreativeArtifacts(project.id);
  await prisma.project.update({
    where: { id: project.id },
    data: {
      selectedCharacterId: nextCharacter?.id ?? null,
      selectedCharacter: nextCharacter
        ? (nextCharacter as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      creatorSelection: nextSelection,
      status: project.concepts.length > 0 ? ProjectStatus.HOOKS_READY : ProjectStatus.READY,
    },
  });
  res.json({
    project: assertProject(await loadProjectSnapshot(project.id, userId)),
  });
};

export const generateConcepts: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { count, forceRegenerate, useHookPreferences, append } = conceptStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Analyze the website before generating concepts",
    );
  const profile = asBrandProfile(project.brandProfile);
  if (append && forceRegenerate) throw new ApiError(400, "INVALID_GENERATION_MODE", "Append and replacement modes cannot be combined");
  const likedConcepts = project.concepts.filter((concept) => concept.reviewDecision === ReviewDecision.LIKED);
  const rejectedReviewedConcepts = project.concepts.filter((concept) => concept.reviewDecision === ReviewDecision.REJECTED);
  const unreviewedConcepts = project.concepts.filter((concept) => concept.reviewDecision === null);
  if (append) {
    if (likedConcepts.length >= 8) throw new ApiError(409, "HOOK_SELECTION_COMPLETE", "Eight hooks are already selected");
    if (unreviewedConcepts.length > 0) throw new ApiError(409, "HOOKS_PENDING_REVIEW", "Review the remaining hooks before generating another batch");
    const activeGeneration = project.jobs.some((job) => job.type === JobType.GENERATE_CONCEPTS && (job.status === JobStatus.QUEUED || job.status === JobStatus.ACTIVE));
    if (activeGeneration) throw new ApiError(409, "GENERATION_IN_PROGRESS", "Another hook batch is already being generated");
  }
  if (project.concepts.length > 0 && !forceRegenerate && !append) {
    res.json({
      project: assertProject(await loadProjectSnapshot(project.id, userId)),
      cached: true,
    });
    return;
  }
  const staleAssets = append ? [] : project.mediaAssets.filter((asset) => !isBrandDemoAsset(asset));
  const latestAnalysisJob = await prisma.generationJob.findFirst({
    where: {
      projectId: project.id,
      type: JobType.ANALYZE_WEBSITE,
      status: JobStatus.COMPLETED,
    },
    orderBy: { createdAt: 'desc' },
  });
  const recorder = latestAnalysisJob
    ? createAnalysisJsonRecorder({
        website: project.normalizedWebsite,
        projectId: project.id,
        analysisJobId: latestAnalysisJob.id,
        startedAt: latestAnalysisJob.createdAt,
      })
    : null;
  const reservedAppendJob = append
    ? await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${project.id}))`;
        const active = await tx.generationJob.findFirst({
          where: { projectId: project.id, type: JobType.GENERATE_CONCEPTS, status: { in: [JobStatus.QUEUED, JobStatus.ACTIVE] } },
        });
        if (active) throw new ApiError(409, "GENERATION_IN_PROGRESS", "Another hook batch is already being generated");
        return tx.generationJob.create({
          data: { projectId: project.id, type: JobType.GENERATE_CONCEPTS, input: { count, forceRegenerate, append }, status: JobStatus.QUEUED, progress: 0 },
        });
      })
    : undefined;
  try {
    await runStage(
      project.id,
      JobType.GENERATE_CONCEPTS,
      { count, forceRegenerate, append },
      "Generating hooks",
      async (generationJob) => {
        const savedPreferences = useHookPreferences && project.hookPreferences
          ? normalizeHookPreferences(project.hookPreferences)
          : null;
        const preferredConcepts = append
          ? likedConcepts.map(({ hookText, demoOverlayText, angle }) => ({ hookText, demoOverlayText, angle }))
          : savedPreferences?.liked.map(({ hookText, demoOverlayText, angle }) => ({ hookText, demoOverlayText, angle })) ?? [];
        const rejectedConcepts = append
          ? rejectedReviewedConcepts.map(({ hookText, demoOverlayText, angle }) => ({ hookText, demoOverlayText, angle }))
          : savedPreferences?.rejected.map(({ hookText, demoOverlayText, angle }) => ({ hookText, demoOverlayText, angle })) ?? [];
        const allPriorConcepts = project.concepts.map(({ hookText, demoOverlayText, angle }) => ({ hookText, demoOverlayText, angle }));
        const previousConcepts = append ? preferredConcepts : [
          ...(forceRegenerate ? allPriorConcepts : []),
          ...preferredConcepts,
        ];
        await recorder?.write('hooks-request', {
          projectId: project.id,
          generationJobId: generationJob.id,
          analysisJobId: latestAnalysisJob?.id ?? null,
          count,
          forceRegenerate,
          brandProfile: profile,
          previousConcepts,
          preferredConcepts,
          rejectedConcepts,
        });
        let source: 'llm' | 'fallback' = 'llm';
        let concepts: ConceptBlueprint[];
        try {
          concepts = await generateHooksFromLLM(
            profile,
            count,
            previousConcepts,
            rejectedConcepts,
            recorder ?? undefined,
            append ? allPriorConcepts : previousConcepts,
          );
        } catch (error) {
          if (forceRegenerate) throw error;
          source = 'fallback';
          concepts = buildConceptCards(profile, count);
        }
        await recorder?.write('hooks', { source, concepts });
        await prisma.$transaction(async (tx) => {
          if (!append) await tx.mediaAsset.deleteMany({
            where: { projectId: project.id, id: { in: staleAssets.map((asset) => asset.id) } },
          });
          if (!append) await tx.projectExport.deleteMany({ where: { projectId: project.id } });
          if (!append) await tx.project.update({
            where: { id: project.id },
            data: { selectedConceptId: null },
          });
          if (!append) await tx.hookConcept.deleteMany({ where: { projectId: project.id } });
          const sortOrderOffset = append
            ? project.concepts.reduce((maximum, concept) => Math.max(maximum, concept.sortOrder), -1) + 1
            : 0;
          await tx.hookConcept.createMany({
            data: concepts.map((concept) => ({
              projectId: project.id,
              angle: concept.angle,
              hookText: concept.hookText,
              hookImagePrompt: concept.hookImagePrompt,
              demoOverlayText: concept.demoOverlayText,
              videoDirection: concept.videoDirection,
              targetDurationLabel: concept.targetDurationLabel,
              targetDurationSeconds: concept.targetDurationSeconds,
              score: concept.score,
              scoreLabel: concept.scoreLabel,
              rationale: concept.rationale,
              generatedImageUrl: null,
              generatedVideoUrl: null,
              sortOrder: sortOrderOffset + concept.sortOrder,
            })),
          });
          await tx.project.update({
            where: { id: project.id },
            data: { status: "HOOKS_READY" },
          });
        });
        await Promise.allSettled(staleAssets.map((asset) => deleteStoredAsset({
          provider: asset.provider,
          providerId: asset.providerId,
          mimeType: asset.mimeType,
        })));
        return concepts;
      },
      reservedAppendJob,
    );
    const snapshot = assertProject(await loadProjectSnapshot(project.id, userId));
    await recorder?.write('project-snapshot', snapshot);
    res.json({ project: snapshot, cached: false });
  } catch (error) {
    await recorder?.write('hooks-error', errorJson(error));
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      "HOOK_GENERATION_FAILED",
      error instanceof Error ? error.message : "Hook generation failed",
    );
  }
};

export const generateConceptImageAsset: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptId, forceRegenerate } = mediaStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Analyze the website before generating media",
    );
  const concept = conceptOrFail(project, conceptId);
  const selectedCharacter = resolveSelectedCharacter(project, concept);
  if (!selectedCharacter)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Select a character before generating media",
    );
  const selectedChanged = project.selectedConceptId !== concept.id;
  const hasImage = project.mediaAssets.some(
    (asset) => asset.conceptId === concept.id && asset.type === "IMAGE",
  );
  if (hasImage && !forceRegenerate && !selectedChanged) {
    res.json({ project, cached: true });
    return;
  }
  if (selectedChanged) {
    await selectConceptForProject(project.id, concept.id, userId);
  }
  const { jobId } = await runStage(
    project.id,
    JobType.GENERATE_MEDIA,
    { conceptId: concept.id, forceRegenerate, mode: "IMAGE" },
    "Generating preview image",
    async () => {
      const latestProject = assertProject(
        await loadProjectSnapshot(project.id, userId),
      );
      const selectedConcept = conceptOrFail(latestProject, concept.id);
      const activeCharacter = resolveSelectedCharacter(latestProject, selectedConcept);
      if (!activeCharacter)
        throw new ApiError(
          409,
          "PROJECT_INCOMPLETE",
          "Select a character before generating media",
        );
      const asset = await generateCharacterImageAssetForConcept(
        project,
        asBrandProfile(latestProject.brandProfile!),
        selectedConcept,
        activeCharacter,
      );
      await writeConceptAsset(project.id, selectedConcept.id, "IMAGE", {
        provider: asset.provider,
        providerId: asset.providerId,
        url: asset.url,
        mimeType: asset.mimeType,
        metadata: asset.metadata as Prisma.InputJsonValue,
      });
      await prisma.hookConcept.update({
        where: { id: selectedConcept.id },
        data: { generatedImageUrl: asset.url },
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "MEDIA_READY", selectedConceptId: selectedConcept.id },
      });
      return asset;
    },
  );
  res.json({
    project: assertProject(await loadProjectSnapshot(project.id, userId)),
    cached: false,
    job: await prisma.generationJob.findUnique({ where: { id: jobId } }),
  });
};

export const generateConceptVideoAsset: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptId, forceRegenerate } = mediaStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Analyze the website before generating media",
    );
  const concept = conceptOrFail(project, conceptId);
  const selectedCharacter = resolveSelectedCharacter(project, concept);
  if (!selectedCharacter)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Select a character before generating media",
    );
  const selectedChanged = project.selectedConceptId !== concept.id;
  const hasImage = project.mediaAssets.some(
    (asset) => asset.conceptId === concept.id && asset.type === "IMAGE",
  );
  const hasVideo = project.mediaAssets.some(
    (asset) => asset.conceptId === concept.id && asset.type === "VIDEO",
  );
  if (!hasImage) {
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Generate the preview image before creating the demo video",
    );
  }
  if (hasVideo && !forceRegenerate && !selectedChanged) {
    res.json({ project, cached: true });
    return;
  }
  if (selectedChanged) {
    await selectConceptForProject(project.id, concept.id, userId);
  }
  const { jobId } = await runStage(
    project.id,
    JobType.GENERATE_MEDIA,
    { conceptId: concept.id, forceRegenerate, mode: "VIDEO" },
    "Generating 4 second demo video",
    async () => {
      const latestProject = assertProject(
        await loadProjectSnapshot(project.id, userId),
      );
      const selectedConcept = conceptOrFail(latestProject, concept.id);
      const activeCharacter = resolveSelectedCharacter(latestProject, selectedConcept);
      if (!activeCharacter)
        throw new ApiError(
          409,
          "PROJECT_INCOMPLETE",
          "Select a character before generating media",
        );
      const asset = await generateCharacterVideoAssetForConcept(
        project,
        asBrandProfile(latestProject.brandProfile!),
        selectedConcept,
        activeCharacter,
        selectedConcept.sortOrder,
      );
      await writeConceptAsset(project.id, selectedConcept.id, "VIDEO", {
        provider: asset.provider,
        providerId: asset.providerId,
        url: asset.url,
        mimeType: asset.mimeType,
        metadata: asset.metadata as Prisma.InputJsonValue,
      });
      await prisma.hookConcept.update({
        where: { id: selectedConcept.id },
        data: { generatedVideoUrl: asset.url },
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "MEDIA_READY", selectedConceptId: selectedConcept.id },
      });
      return asset;
    },
  );
  res.json({
    project: assertProject(await loadProjectSnapshot(project.id, userId)),
    cached: false,
    job: await prisma.generationJob.findUnique({ where: { id: jobId } }),
  });
};

export const generateMedia: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptId, forceRegenerate } = mediaStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Analyze the website before generating media",
    );
  const concept = conceptOrFail(project, conceptId);
  const selectedCharacter = resolveSelectedCharacter(project, concept);
  if (!selectedCharacter)
    throw new ApiError(
      409,
      "PROJECT_INCOMPLETE",
      "Select a character before generating media",
    );
  const selectedChanged = project.selectedConceptId !== concept.id;
  if (project.mediaAssets.length > 0 && !forceRegenerate && !selectedChanged) {
    res.json({ project, cached: true });
    return;
  }
  if (selectedChanged) {
    await selectConceptForProject(project.id, concept.id, userId);
  }
  const preserveIds = project.mediaAssets
    .filter(isBrandDemoAsset)
    .map((asset) => asset.id);
  if (preserveIds.length > 0) {
    await prisma.mediaAsset.deleteMany({
      where: { projectId: project.id, NOT: { id: { in: preserveIds } } },
    });
  } else {
    await prisma.mediaAsset.deleteMany({ where: { projectId: project.id } });
  }
  const { jobId } = await runStage(
    project.id,
    JobType.GENERATE_MEDIA,
    { conceptId: concept.id, forceRegenerate, mode: "BOTH" },
    "Generating concept image and demo video",
    async () => {
      const latestProject = assertProject(
        await loadProjectSnapshot(project.id, userId),
      );
      const selectedConcept = conceptOrFail(latestProject, concept.id);
      const activeCharacter = resolveSelectedCharacter(latestProject, selectedConcept);
      if (!activeCharacter)
        throw new ApiError(
          409,
          "PROJECT_INCOMPLETE",
          "Select a character before generating media",
        );
      const assets = await generateCharacterMediaForConcept(
        project,
        asBrandProfile(latestProject.brandProfile!),
        selectedConcept,
        activeCharacter,
        selectedConcept.sortOrder,
      );
      await prisma.mediaAsset.createMany({
        data: assets.map((asset) => ({
          ...asset,
          metadata: asset.metadata as Prisma.InputJsonValue,
        })),
      });
      await prisma.hookConcept.update({
        where: { id: selectedConcept.id },
        data: {
          generatedImageUrl: assets[0].url,
          generatedVideoUrl: assets[1].url,
        },
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "MEDIA_READY", selectedConceptId: selectedConcept.id },
      });
      return assets;
    },
  );
  res.json({
    project: assertProject(await loadProjectSnapshot(project.id, userId)),
    cached: false,
    job: await prisma.generationJob.findUnique({ where: { id: jobId } }),
  });
};

export const saveExportState: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { settings } = exportPayloadSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  const concept = conceptOrFail(project, settings.selectedConceptId ?? null);
  const selectedCharacter = resolveSelectedCharacter(project, concept);
  const selectedImage =
    project.mediaAssets.find(
      (asset) => asset.conceptId === concept.id && asset.type === "IMAGE",
    ) ?? null;
  const selectedVideo =
    project.mediaAssets.find(
      (asset) => asset.conceptId === concept.id && asset.type === "VIDEO",
    ) ?? null;
  const exportState = buildExportState(
    project,
    concept,
    selectedCharacter,
    selectedImage?.id ?? null,
    selectedVideo?.id ?? null,
  );
  const merged = {
    ...exportState,
    ...settings,
    selectedConceptId: concept.id,
    selectedCharacterId: selectedCharacter?.id ?? null,
    selectedCharacterName: selectedCharacter?.name ?? null,
    selectedCharacterSource: selectedCharacter?.source ?? null,
    selectedImageId: settings.selectedImageId ?? selectedImage?.id ?? null,
    selectedVideoId: settings.selectedVideoId ?? selectedVideo?.id ?? null,
  };
  await runStage(
    project.id,
    JobType.SAVE_EXPORT,
    { settings: merged },
    "Saving export settings",
    async () => {
      await prisma.projectExport.upsert({
        where: { projectId: project.id },
        update: { settings: merged as Prisma.InputJsonValue },
        create: {
          projectId: project.id,
          settings: merged as Prisma.InputJsonValue,
        },
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "EXPORT_READY" },
      });
      return merged;
    },
  );
  res.json({
    project: assertProject(await loadProjectSnapshot(project.id, userId)),
  });
};

export const renderProject: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptIds, assignments: requestedAssignments } = renderRequestSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  const likedConcepts = project.concepts.filter((concept) => concept.reviewDecision === ReviewDecision.LIKED);
  if (likedConcepts.length !== 8) throw new ApiError(409, 'HOOK_REVIEW_INCOMPLETE', 'Select exactly eight hooks before rendering');
  if (conceptIds?.some((conceptId) => !likedConcepts.some((concept) => concept.id === conceptId))) {
    throw new ApiError(409, 'HOOK_NOT_SELECTED', 'Only selected hooks can be rendered');
  }
  const concepts = (conceptIds?.length ? likedConcepts.filter((concept) => conceptIds.includes(concept.id)) : likedConcepts)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (concepts.length !== 8) throw new ApiError(409, 'HOOK_SELECTION_MISMATCH', 'Render all eight selected hooks together');
  const demo = project.mediaAssets.find(isBrandDemoAsset);
  if (!demo) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Upload a product demo before rendering');
  const selection = project.creatorSelection && projectCreatorSelectionSchema.safeParse(project.creatorSelection).success
    ? projectCreatorSelectionSchema.parse(project.creatorSelection)
    : project.selectedCharacter
      ? { mode: 'single' as const, characters: [creatorCharacterSchema.parse(project.selectedCharacter)] }
      : null;
  if (!selection) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a creator before rendering');
  const creators = await prisma.creator.findMany({
    where: { id: { in: selection.characters.map((character) => character.id) } },
    include: { clips: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  });
  const byId = new Map(creators.map((creator) => [creator.id, creator]));
  const requestedClipByConcept = new Map((requestedAssignments ?? []).map((assignment) => [assignment.conceptId, assignment.clipId]));
  const assignments = concepts.map((concept, index) => {
    const character = selection.characters[selection.mode === 'mix' ? index % selection.characters.length : 0];
    const creator = character ? byId.get(character.id) : undefined;
    const requestedClipId = requestedClipByConcept.get(concept.id);
    const clip = requestedClipId
      ? creator?.clips.find((item) => item.id === requestedClipId)
      : creator?.clips[index % (creator.clips.length || 1)];
    if (!creator || !clip) throw new ApiError(409, 'PROJECT_INCOMPLETE', `Creator clip missing for Reel ${index + 1}`);
    return { conceptId: concept.id, clipUrl: clip.url, clipId: clip.id, creatorName: creator.name };
  });
  const input: RenderJobInput = { projectId: project.id, conceptIds: concepts.map((concept) => concept.id), assignments };
  const job = await createJob(project.id, JobType.RENDER_REELS, input as unknown as Prisma.InputJsonValue);
  await renderQueue.add('render-reels', input, { jobId: job.id, removeOnComplete: 100, removeOnFail: 100 });
  res.status(202).json({ job: await prisma.generationJob.findUnique({ where: { id: job.id } }) });
};

export const getJob: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = jobIdParamsSchema.parse(req.params);
  const job = await prisma.generationJob.findFirst({
    where: { id, project: { userId } },
  });
  if (!job) throw new ApiError(404, "NOT_FOUND", "Job not found");
  res.json({ job });
};

import type { RequestHandler } from 'express';
import { JobStatus, JobType, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { characterSelectionSchema, conceptSelectionSchema, conceptStageInputSchema, creatorCharacterSchema, exportPayloadSchema, jobIdParamsSchema, mediaStageInputSchema, projectIdParamsSchema, websiteInputSchema } from '../domain/schemas';
import { buildBrandProfile, buildConceptCards, buildExportState, clearGeneratedContent, generateCharacterImageAssetForConcept, generateCharacterMediaForConcept, generateCharacterVideoAssetForConcept, loadProjectSnapshot, normalizeWebsiteInput, projectSnapshotInclude } from '../lib/workflow';
import { deleteStoredAsset, storeUploadedAsset } from '../lib/asset-storage';

async function createJob(projectId: string, type: JobType, input: Prisma.InputJsonValue) {
  return prisma.generationJob.create({ data: { projectId, type, input, status: JobStatus.QUEUED, progress: 0 } });
}

async function updateJob(id: string, data: Prisma.GenerationJobUpdateInput) {
  return prisma.generationJob.update({ where: { id }, data });
}

async function runStage<T>(projectId: string, type: JobType, input: Prisma.InputJsonValue, label: string, fn: () => Promise<T>) {
  const job = await createJob(projectId, type, input);
  await updateJob(job.id, { status: JobStatus.ACTIVE, progress: 10, progressMessage: label });
  try {
    const result = await fn();
    await updateJob(job.id, { status: JobStatus.COMPLETED, progress: 100, progressMessage: `${label} complete`, result: result as Prisma.InputJsonValue });
    return { jobId: job.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updateJob(job.id, { status: JobStatus.FAILED, progress: 100, progressMessage: `${label} failed`, errorMessage: message });
    throw error;
  }
}

function assertProject(value: Awaited<ReturnType<typeof loadProjectSnapshot>>) {
  if (!value) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  return value;
}

function requireUserId(req: Express.Request) {
  if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
  return req.user.id;
}

async function getProjectOrFail(id: string, userId: string) {
  return assertProject(await loadProjectSnapshot(id, userId));
}

function resolveSelectedCharacter(project: Awaited<ReturnType<typeof getProjectOrFail>>) {
  if (!project.selectedCharacter) return null;
  return creatorCharacterSchema.parse(project.selectedCharacter);
}

async function clearCreativeArtifacts(projectId: string) {
  const project = await loadProjectSnapshot(projectId);
  const preserveIds = project?.mediaAssets.filter(isBrandDemoAsset).map((asset) => asset.id) ?? [];
  const mediaDelete = preserveIds.length > 0
    ? prisma.mediaAsset.deleteMany({ where: { projectId, NOT: { id: { in: preserveIds } } } })
    : prisma.mediaAsset.deleteMany({ where: { projectId } });
  await prisma.$transaction([
    mediaDelete,
    prisma.projectExport.deleteMany({ where: { projectId } }),
    prisma.hookConcept.updateMany({ where: { projectId }, data: { generatedImageUrl: null, generatedVideoUrl: null } }),
  ]);
}

async function resetProjectForNewFlow(projectId: string) {
  const project = await loadProjectSnapshot(projectId);
  if (!project) return;
  await Promise.all(
    project.mediaAssets.map((asset) => deleteStoredAsset({ provider: asset.provider, providerId: asset.providerId, mimeType: asset.mimeType })),
  );
  await prisma.$transaction([
    prisma.mediaAsset.deleteMany({ where: { projectId } }),
    prisma.hookConcept.deleteMany({ where: { projectId } }),
    prisma.projectExport.deleteMany({ where: { projectId } }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'DRAFT',
        selectedConceptId: null,
        selectedCharacterId: null,
        selectedCharacter: Prisma.JsonNull,
      },
    }),
  ]);
}

function isBrandDemoAsset(asset: { conceptId: string | null; type: string; metadata: Prisma.JsonValue | null }) {
  if (asset.conceptId !== null || asset.type !== 'VIDEO' || !asset.metadata || typeof asset.metadata !== 'object') {
    return false;
  }
  return (asset.metadata as Record<string, unknown>).kind === 'brand-demo';
}

function requireVideoFile(file: Express.Multer.File | undefined, message: string) {
  if (!file) throw new ApiError(400, 'FILE_REQUIRED', message);
  if (!file.mimetype.startsWith('video/')) throw new ApiError(400, 'INVALID_FILE_TYPE', message);
  return file;
}

function conceptOrFail(project: Awaited<ReturnType<typeof getProjectOrFail>>, conceptId?: string | null) {
  const resolvedId = conceptId ?? project.selectedConceptId;
  if (!resolvedId) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a concept before generating media');
  const concept = project.concepts.find((item) => item.id === resolvedId);
  if (!concept) throw new ApiError(404, 'CONCEPT_NOT_FOUND', 'Concept not found for this project');
  return concept;
}

async function selectConceptForProject(projectId: string, conceptId: string | null, userId: string) {
  const project = await getProjectOrFail(projectId, userId);
  if (conceptId && !project.concepts.some((concept) => concept.id === conceptId)) {
    throw new ApiError(404, 'CONCEPT_NOT_FOUND', 'Concept not found for this project');
  }
  const selectionChanged = project.selectedConceptId !== conceptId;
  if (selectionChanged) {
    await clearCreativeArtifacts(project.id);
    await prisma.project.update({ where: { id: project.id }, data: { selectedConceptId: conceptId, ...(conceptId ? {} : { status: 'READY' }) } });
  } else if (!project.selectedConceptId && conceptId === null) {
    await prisma.project.update({ where: { id: project.id }, data: { selectedConceptId: null } });
  }
  return assertProject(await loadProjectSnapshot(project.id, userId));
}

async function analyzeProjectById(projectId: string, userId: string, options: { forceRegenerate: boolean }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId }, include: projectSnapshotInclude });
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  if (project.brandProfile && !options.forceRegenerate) {
    return { project, cached: true };
  }
  await clearGeneratedContent(project.id);
  const { jobId, result } = await runStage(project.id, JobType.ANALYZE_WEBSITE, { website: project.website, forceRegenerate: options.forceRegenerate }, 'Analyzing website', async () => {
    const profile = buildBrandProfile(project.website);
    await prisma.brandProfile.upsert({
      where: { projectId: project.id },
      update: profile,
      create: { projectId: project.id, ...profile },
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: 'READY' } });
    return profile;
  });
  const next = assertProject(await loadProjectSnapshot(project.id, userId));
  return { project: next, job: await prisma.generationJob.findUnique({ where: { id: jobId } }), brandProfile: result, cached: false };
}

async function writeConceptAsset(projectId: string, conceptId: string, type: 'IMAGE' | 'VIDEO', asset: { provider: string; providerId: string | null; url: string; mimeType: string | null; metadata: Prisma.InputJsonValue }) {
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
  const existingProject = await prisma.project.findFirst({ where: { userId, normalizedWebsite } });
  const project = existingProject
    ? await prisma.project.update({ where: { id: existingProject.id }, data: { website: website.trim(), normalizedWebsite } })
    : await prisma.project.create({ data: { userId, website: website.trim(), normalizedWebsite, status: 'DRAFT' } });
  await resetProjectForNewFlow(project.id);
  const analyzed = await analyzeProjectById(project.id, userId, { forceRegenerate: true });
  res.status(201).json(analyzed);
};

export const analyzeProject: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { forceRegenerate } = req.body as { forceRegenerate?: boolean };
  const payload = await analyzeProjectById(id, userId, { forceRegenerate: Boolean(forceRegenerate) });
  res.json(payload);
};

export const uploadBrandDemo: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const project = await getProjectOrFail(id, userId);
  const demoFile = requireVideoFile(req.file, 'Upload a video file for the brand demo');
  const existingDemoAssets = project.mediaAssets.filter(isBrandDemoAsset);
  await Promise.all(existingDemoAssets.map((asset) => deleteStoredAsset({ provider: asset.provider, providerId: asset.providerId, mimeType: asset.mimeType })));
  await clearGeneratedContent(project.id);
  if (existingDemoAssets.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { projectId: project.id, id: { in: existingDemoAssets.map((asset) => asset.id) } } });
  }
  const stored = await storeUploadedAsset(demoFile.buffer, {
    folder: `reelswarm/projects/${project.id}/brand-demo`,
    publicId: `${project.id}-${Date.now()}-${demoFile.originalname}`,
    mimeType: demoFile.mimetype,
  });
  await prisma.mediaAsset.create({
    data: {
      projectId: project.id,
      conceptId: null,
      type: 'VIDEO',
      provider: stored.provider,
      providerId: stored.providerId,
      url: stored.url,
      mimeType: stored.mimeType,
      metadata: {
        ...(stored.metadata as Record<string, unknown>),
        kind: 'brand-demo',
        originalName: demoFile.originalname,
        uploadedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
  await prisma.project.update({ where: { id: project.id }, data: { status: 'HOOKS_READY' } });
  res.status(201).json({ project: assertProject(await loadProjectSnapshot(project.id, userId)) });
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

export const selectCharacter: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { character } = characterSelectionSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  const nextCharacter = character ? creatorCharacterSchema.parse(character) : null;
  const current = project.selectedCharacter ? creatorCharacterSchema.parse(project.selectedCharacter) : null;
  const selectionChanged = JSON.stringify(current) !== JSON.stringify(nextCharacter);
  if (!selectionChanged) {
    res.json({ project });
    return;
  }
  await clearCreativeArtifacts(project.id);
  await prisma.project.update({
    where: { id: project.id },
    data: {
      selectedCharacterId: nextCharacter?.id ?? null,
      selectedCharacter: nextCharacter ? (nextCharacter as Prisma.InputJsonValue) : Prisma.JsonNull,
      status: 'READY',
    },
  });
  res.json({ project: assertProject(await loadProjectSnapshot(project.id, userId)) });
};

export const generateConcepts: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { count, forceRegenerate } = conceptStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Analyze the website before generating concepts');
  if (!project.mediaAssets.some(isBrandDemoAsset)) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Upload a brand demo before generating hooks');
  if (project.concepts.length > 0 && !forceRegenerate) {
    res.json({ project, cached: true });
    return;
  }
  await clearGeneratedContent(project.id);
  await runStage(project.id, JobType.GENERATE_CONCEPTS, { count, forceRegenerate }, 'Generating concept cards', async () => {
    const concepts = buildConceptCards(project.brandProfile!, count);
    await prisma.hookConcept.createMany({
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
        generatedImageUrl: concept.generatedImageUrl,
        generatedVideoUrl: concept.generatedVideoUrl,
        sortOrder: concept.sortOrder,
      })),
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: 'HOOKS_READY' } });
    return concepts;
  });
  res.json({ project: assertProject(await loadProjectSnapshot(project.id, userId)), cached: false });
};

export const generateConceptImageAsset: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptId, forceRegenerate } = mediaStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Analyze the website before generating media');
  const concept = conceptOrFail(project, conceptId);
  const selectedCharacter = resolveSelectedCharacter(project);
  if (!selectedCharacter) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a character before generating media');
  const selectedChanged = project.selectedConceptId !== concept.id;
  const hasImage = project.mediaAssets.some((asset) => asset.conceptId === concept.id && asset.type === 'IMAGE');
  if (hasImage && !forceRegenerate && !selectedChanged) {
    res.json({ project, cached: true });
    return;
  }
  if (selectedChanged) {
    await selectConceptForProject(project.id, concept.id, userId);
  }
  const { jobId } = await runStage(project.id, JobType.GENERATE_MEDIA, { conceptId: concept.id, forceRegenerate, mode: 'IMAGE' }, 'Generating preview image', async () => {
    const latestProject = assertProject(await loadProjectSnapshot(project.id, userId));
    const selectedConcept = conceptOrFail(latestProject, concept.id);
    const activeCharacter = resolveSelectedCharacter(latestProject);
    if (!activeCharacter) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a character before generating media');
    const asset = await generateCharacterImageAssetForConcept(project, latestProject.brandProfile!, selectedConcept, activeCharacter);
    await writeConceptAsset(project.id, selectedConcept.id, 'IMAGE', {
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
    await prisma.project.update({ where: { id: project.id }, data: { status: 'MEDIA_READY', selectedConceptId: selectedConcept.id } });
    return asset;
  });
  res.json({ project: assertProject(await loadProjectSnapshot(project.id, userId)), cached: false, job: await prisma.generationJob.findUnique({ where: { id: jobId } }) });
};

export const generateConceptVideoAsset: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptId, forceRegenerate } = mediaStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Analyze the website before generating media');
  const concept = conceptOrFail(project, conceptId);
  const selectedCharacter = resolveSelectedCharacter(project);
  if (!selectedCharacter) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a character before generating media');
  const selectedChanged = project.selectedConceptId !== concept.id;
  const hasImage = project.mediaAssets.some((asset) => asset.conceptId === concept.id && asset.type === 'IMAGE');
  const hasVideo = project.mediaAssets.some((asset) => asset.conceptId === concept.id && asset.type === 'VIDEO');
  if (!hasImage) {
    throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Generate the preview image before creating the demo video');
  }
  if (hasVideo && !forceRegenerate && !selectedChanged) {
    res.json({ project, cached: true });
    return;
  }
  if (selectedChanged) {
    await selectConceptForProject(project.id, concept.id, userId);
  }
  const { jobId } = await runStage(project.id, JobType.GENERATE_MEDIA, { conceptId: concept.id, forceRegenerate, mode: 'VIDEO' }, 'Generating 4 second demo video', async () => {
    const latestProject = assertProject(await loadProjectSnapshot(project.id, userId));
    const selectedConcept = conceptOrFail(latestProject, concept.id);
    const activeCharacter = resolveSelectedCharacter(latestProject);
    if (!activeCharacter) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a character before generating media');
    const asset = await generateCharacterVideoAssetForConcept(project, latestProject.brandProfile!, selectedConcept, activeCharacter, selectedConcept.sortOrder);
    await writeConceptAsset(project.id, selectedConcept.id, 'VIDEO', {
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
    await prisma.project.update({ where: { id: project.id }, data: { status: 'MEDIA_READY', selectedConceptId: selectedConcept.id } });
    return asset;
  });
  res.json({ project: assertProject(await loadProjectSnapshot(project.id, userId)), cached: false, job: await prisma.generationJob.findUnique({ where: { id: jobId } }) });
};

export const generateMedia: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { conceptId, forceRegenerate } = mediaStageInputSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  if (!project.brandProfile) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Analyze the website before generating media');
  const concept = conceptOrFail(project, conceptId);
  const selectedCharacter = resolveSelectedCharacter(project);
  if (!selectedCharacter) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a character before generating media');
  const selectedChanged = project.selectedConceptId !== concept.id;
  if (project.mediaAssets.length > 0 && !forceRegenerate && !selectedChanged) {
    res.json({ project, cached: true });
    return;
  }
  if (selectedChanged) {
    await selectConceptForProject(project.id, concept.id, userId);
  }
  const preserveIds = project.mediaAssets.filter(isBrandDemoAsset).map((asset) => asset.id);
  if (preserveIds.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { projectId: project.id, NOT: { id: { in: preserveIds } } } });
  } else {
    await prisma.mediaAsset.deleteMany({ where: { projectId: project.id } });
  }
  const { jobId } = await runStage(project.id, JobType.GENERATE_MEDIA, { conceptId: concept.id, forceRegenerate, mode: 'BOTH' }, 'Generating concept image and demo video', async () => {
    const latestProject = assertProject(await loadProjectSnapshot(project.id, userId));
    const selectedConcept = conceptOrFail(latestProject, concept.id);
    const activeCharacter = resolveSelectedCharacter(latestProject);
    if (!activeCharacter) throw new ApiError(409, 'PROJECT_INCOMPLETE', 'Select a character before generating media');
    const assets = await generateCharacterMediaForConcept(project, latestProject.brandProfile!, selectedConcept, activeCharacter, selectedConcept.sortOrder);
    await prisma.mediaAsset.createMany({
      data: assets.map((asset) => ({
        ...asset,
        metadata: asset.metadata as Prisma.InputJsonValue,
      })),
    });
    await prisma.hookConcept.update({
      where: { id: selectedConcept.id },
      data: { generatedImageUrl: assets[0].url, generatedVideoUrl: assets[1].url },
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: 'MEDIA_READY', selectedConceptId: selectedConcept.id } });
    return assets;
  });
  res.json({ project: assertProject(await loadProjectSnapshot(project.id, userId)), cached: false, job: await prisma.generationJob.findUnique({ where: { id: jobId } }) });
};

export const saveExportState: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = projectIdParamsSchema.parse(req.params);
  const { settings } = exportPayloadSchema.parse(req.body);
  const project = await getProjectOrFail(id, userId);
  const concept = conceptOrFail(project, settings.selectedConceptId ?? null);
  const selectedCharacter = resolveSelectedCharacter(project);
  const selectedImage = project.mediaAssets.find((asset) => asset.conceptId === concept.id && asset.type === 'IMAGE') ?? null;
  const selectedVideo = project.mediaAssets.find((asset) => asset.conceptId === concept.id && asset.type === 'VIDEO') ?? null;
  const exportState = buildExportState(project, concept, selectedCharacter, selectedImage?.id ?? null, selectedVideo?.id ?? null);
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
  await runStage(project.id, JobType.SAVE_EXPORT, { settings: merged }, 'Saving export settings', async () => {
    await prisma.projectExport.upsert({
      where: { projectId: project.id },
      update: { settings: merged as Prisma.InputJsonValue },
      create: { projectId: project.id, settings: merged as Prisma.InputJsonValue },
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: 'EXPORT_READY' } });
    return merged;
  });
  res.json({ project: assertProject(await loadProjectSnapshot(project.id, userId)) });
};

export const getJob: RequestHandler = async (req, res) => {
  const userId = requireUserId(req);
  const { id } = jobIdParamsSchema.parse(req.params);
  const job = await prisma.generationJob.findFirst({ where: { id, project: { userId } } });
  if (!job) throw new ApiError(404, 'NOT_FOUND', 'Job not found');
  res.json({ job });
};

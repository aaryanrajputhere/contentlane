import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import {
  creatorClipParamsSchema,
  creatorClipUpdateSchema,
  creatorListQuerySchema,
  creatorMutationSchema,
  creatorClipMutationSchema,
  creatorParamsSchema,
} from '../domain/schemas';
import { creatorToCharacter, parseCreatorTags } from '../lib/creator-library';
import { deleteStoredAsset, storeUploadedAsset } from '../lib/asset-storage';

const creatorInclude = {
  clips: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.CreatorInclude;

type CreatorWithClips = Prisma.CreatorGetPayload<{ include: typeof creatorInclude }>;

function mapCreator(creator: CreatorWithClips) {
  const clips = creator.clips.map((clip) => ({
    id: clip.id,
    creatorId: clip.creatorId,
    title: clip.title,
    url: clip.url,
    provider: clip.provider,
    providerId: clip.providerId,
    mimeType: clip.mimeType,
    metadata: clip.metadata,
    tags: clip.tags,
    sortOrder: clip.sortOrder,
    createdAt: clip.createdAt,
    updatedAt: clip.updatedAt,
  }));
  return {
    id: creator.id,
    name: creator.name,
    description: creator.description,
    baseImageUrl: creator.baseImageUrl,
    baseImageProvider: creator.baseImageProvider,
    baseImageProviderId: creator.baseImageProviderId,
    baseImageMimeType: creator.baseImageMimeType,
    baseImageMetadata: creator.baseImageMetadata,
    sortOrder: creator.sortOrder,
    createdAt: creator.createdAt,
    updatedAt: creator.updatedAt,
    clipCount: clips.length,
    clips,
    character: creatorToCharacter(creator),
  };
}

async function getCreatorOrFail(id: string) {
  const creator = await prisma.creator.findUnique({ where: { id }, include: creatorInclude });
  if (!creator) throw new ApiError(404, 'NOT_FOUND', 'Creator not found');
  return creator;
}

function requireFile(file: Express.Multer.File | undefined, message: string) {
  if (!file) throw new ApiError(400, 'FILE_REQUIRED', message);
  return file;
}

export const getCreators: RequestHandler = async (req, res) => {
  const { search, tag } = creatorListQuerySchema.parse(req.query);
  const creators = await prisma.creator.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { clips: { some: { tags: { has: search.toLowerCase() } } } },
              ],
            }
          : undefined,
        tag ? { clips: { some: { tags: { has: tag.toLowerCase() } } } } : undefined,
      ].filter(Boolean) as Prisma.CreatorWhereInput[],
    },
    include: creatorInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ creators: creators.map(mapCreator) });
};

export const createCreator: RequestHandler = async (req, res) => {
  const { name, description, sortOrder } = creatorMutationSchema.parse(req.body);
  const baseImage = requireFile(req.file, 'Upload a base image for the creator');
  const asset = await storeUploadedAsset(baseImage.buffer, {
    folder: 'reelswarm/creators/base-images',
    publicId: `${Date.now()}-${baseImage.originalname}`,
    mimeType: baseImage.mimetype,
  });
  const creator = await prisma.creator.create({
    data: {
      name,
      description: description?.trim() || null,
      sortOrder: sortOrder ?? (await prisma.creator.count()),
      baseImageUrl: asset.url,
      baseImageProvider: asset.provider,
      baseImageProviderId: asset.providerId,
      baseImageMimeType: asset.mimeType,
      baseImageMetadata: asset.metadata,
    },
    include: creatorInclude,
  });
  res.status(201).json({ creator: mapCreator(creator) });
};

export const updateCreator: RequestHandler = async (req, res) => {
  const { id } = creatorParamsSchema.parse(req.params);
  const { name, description, sortOrder } = creatorMutationSchema.partial().parse(req.body);
  const existing = await getCreatorOrFail(id);
  const baseImage = req.file ? await storeUploadedAsset(req.file.buffer, {
    folder: 'reelswarm/creators/base-images',
    publicId: `${existing.id}-${Date.now()}-${req.file.originalname}`,
    mimeType: req.file.mimetype,
  }) : null;
  if (baseImage) {
    await deleteStoredAsset({ provider: existing.baseImageProvider, providerId: existing.baseImageProviderId, mimeType: existing.baseImageMimeType });
  }
  const creator = await prisma.creator.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(baseImage ? {
        baseImageUrl: baseImage.url,
        baseImageProvider: baseImage.provider,
        baseImageProviderId: baseImage.providerId,
        baseImageMimeType: baseImage.mimeType,
        baseImageMetadata: baseImage.metadata,
      } : {}),
    },
    include: creatorInclude,
  });
  res.json({ creator: mapCreator(creator) });
};

export const deleteCreator: RequestHandler = async (req, res) => {
  const { id } = creatorParamsSchema.parse(req.params);
  const creator = await getCreatorOrFail(id);
  await Promise.allSettled([
    deleteStoredAsset({ provider: creator.baseImageProvider, providerId: creator.baseImageProviderId, mimeType: creator.baseImageMimeType }),
    ...creator.clips.map((clip) => deleteStoredAsset({ provider: clip.provider, providerId: clip.providerId, mimeType: clip.mimeType })),
  ]);
  await prisma.creator.delete({ where: { id } });
  res.status(204).end();
};

export const createCreatorClip: RequestHandler = async (req, res) => {
  const { id } = creatorParamsSchema.parse(req.params);
  const creator = await getCreatorOrFail(id);
  const { title, tags, sortOrder } = creatorClipMutationSchema.parse(req.body);
  const clipFile = requireFile(req.file, 'Upload a clip file');
  const asset = await storeUploadedAsset(clipFile.buffer, {
    folder: 'reelswarm/creators/clips',
    publicId: `${creator.id}-${Date.now()}-${clipFile.originalname}`,
    mimeType: clipFile.mimetype,
  });
  const clip = await prisma.creatorClip.create({
    data: {
      creatorId: creator.id,
      title: title?.trim() || null,
      tags: parseCreatorTags(tags),
      sortOrder: sortOrder ?? creator.clips.length,
      url: asset.url,
      provider: asset.provider,
      providerId: asset.providerId,
      mimeType: asset.mimeType,
      metadata: asset.metadata,
    },
  });
  res.status(201).json({ clip });
};

export const updateCreatorClip: RequestHandler = async (req, res) => {
  const { clipId } = creatorClipParamsSchema.parse(req.params);
  const { title, tags, sortOrder } = creatorClipUpdateSchema.parse(req.body);
  const clip = await prisma.creatorClip.findUnique({ where: { id: clipId } });
  if (!clip) throw new ApiError(404, 'NOT_FOUND', 'Clip not found');
  const updated = await prisma.creatorClip.update({
    where: { id: clipId },
    data: {
      ...(title !== undefined ? { title: title?.trim() || null } : {}),
      ...(tags !== undefined ? { tags: parseCreatorTags(tags) } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    },
  });
  res.json({ clip: updated });
};

export const deleteCreatorClip: RequestHandler = async (req, res) => {
  const { clipId } = creatorClipParamsSchema.parse(req.params);
  const clip = await prisma.creatorClip.findUnique({ where: { id: clipId } });
  if (!clip) throw new ApiError(404, 'NOT_FOUND', 'Clip not found');
  await deleteStoredAsset({ provider: clip.provider, providerId: clip.providerId, mimeType: clip.mimeType });
  await prisma.creatorClip.delete({ where: { id: clipId } });
  res.status(204).end();
};

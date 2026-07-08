import { v2 as cloudinary } from 'cloudinary';
import type { Prisma } from '@prisma/client';

export interface StoredAsset {
  provider: string;
  providerId: string | null;
  url: string;
  mimeType: string | null;
  metadata: Prisma.InputJsonValue;
}

function hasCloudinaryCredentials() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function resourceTypeForMimeType(mimeType?: string | null) {
  if (mimeType?.startsWith('image/')) return 'image' as const;
  if (mimeType?.startsWith('video/')) return 'video' as const;
  return 'raw' as const;
}

function dataUrlFromBuffer(buffer: Buffer, mimeType: string | null) {
  const resolvedMimeType = mimeType ?? 'application/octet-stream';
  return `data:${resolvedMimeType};base64,${buffer.toString('base64')}`;
}

async function uploadBufferToCloudinary(buffer: Buffer, options: { folder: string; publicId: string; mimeType: string | null }) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const resourceType = resourceTypeForMimeType(options.mimeType);
  return await new Promise<StoredAsset>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: options.folder, public_id: options.publicId, resource_type: resourceType },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url && !result?.url) {
          reject(new Error('Upload completed without a URL'));
          return;
        }
        resolve({
          provider: 'cloudinary',
          providerId: result?.public_id ?? null,
          url: result?.secure_url ?? result?.url ?? '',
          mimeType: options.mimeType,
          metadata: {
            assetId: result?.asset_id ?? null,
            bytes: result?.bytes ?? null,
            format: result?.format ?? null,
            width: result?.width ?? null,
            height: result?.height ?? null,
            resourceType: result?.resource_type ?? null,
          },
        });
      },
    );
    stream.end(buffer);
  });
}

export async function storeUploadedAsset(buffer: Buffer, options: { folder: string; publicId: string; mimeType: string | null }) {
  if (hasCloudinaryCredentials()) {
    return await uploadBufferToCloudinary(buffer, options);
  }
  return {
    provider: 'inline-data-url',
    providerId: null,
    url: dataUrlFromBuffer(buffer, options.mimeType),
    mimeType: options.mimeType,
    metadata: {
      storage: 'inline-data-url',
      byteLength: buffer.length,
    },
  } satisfies StoredAsset;
}

export async function deleteStoredAsset(asset: { provider: string; providerId: string | null; mimeType: string | null }) {
  if (asset.provider !== 'cloudinary' || !asset.providerId) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  await cloudinary.uploader.destroy(asset.providerId, { resource_type: resourceTypeForMimeType(asset.mimeType) });
}

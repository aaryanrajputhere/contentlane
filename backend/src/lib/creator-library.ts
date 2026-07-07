import type { Creator, CreatorClip } from '@prisma/client';
import type { CreatorCharacter } from '../domain/schemas';

const characterLimits = {
  persona: 160,
  appearance: 240,
  voice: 160,
  prompt: 800,
} as const;

function limitText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength - 3).trimEnd() + '...';
}

export function normalizeCreatorTags(tags: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag?.trim().toLowerCase())
        .filter((tag): tag is string => Boolean(tag)),
    ),
  );
}

export function parseCreatorTags(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeCreatorTags(value.map((item) => (typeof item === 'string' ? item : String(item))));
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeCreatorTags(parsed.map((item) => (typeof item === 'string' ? item : String(item))));
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }
  return normalizeCreatorTags(trimmed.split(/[,\n]/g));
}

export function buildCreatorPrompt(creator: Pick<Creator, 'name' | 'description' | 'baseImageUrl'>, clipCount: number, tags: string[]) {
  const parts = [
    `Character: ${creator.name}.`,
    creator.description ? `Description: ${creator.description}.` : null,
    `Base image: ${creator.baseImageUrl}.`,
    clipCount > 0 ? `Clip library: ${clipCount} clips tagged ${tags.slice(0, 6).join(', ')}.` : 'Clip library: no clips uploaded yet.',
    'Keep the look premium, creator-led, and ready for short-form marketing.',
  ].filter(Boolean);
  return limitText(parts.join(' '), characterLimits.prompt);
}

export function creatorToCharacter(
  creator: Pick<Creator, 'id' | 'name' | 'description' | 'baseImageUrl' | 'baseImageProvider' | 'baseImageMimeType'> & { clips?: Array<Pick<CreatorClip, 'tags'>> },
): CreatorCharacter {
  const clipTags = normalizeCreatorTags((creator.clips ?? []).flatMap((clip) => clip.tags));
  return {
    id: creator.id,
    source: 'preset',
    name: creator.name,
    persona: limitText(creator.description?.trim() || 'Creator library profile.', characterLimits.persona),
    appearance: limitText(`Base image: ${creator.baseImageMimeType ?? 'uploaded image'} on ${creator.baseImageProvider}.`, characterLimits.appearance),
    voice: limitText(clipTags.length > 0 ? `Clip tags: ${clipTags.slice(0, 4).join(', ')}.` : 'Built for creator-led short-form marketing.', characterLimits.voice),
    prompt: buildCreatorPrompt(creator, creator.clips?.length ?? 0, clipTags),
    baseImageUrl: creator.baseImageUrl,
    baseImageProvider: creator.baseImageProvider,
    baseImageMimeType: creator.baseImageMimeType,
    clipCount: creator.clips?.length ?? 0,
    clipTags,
  };
}

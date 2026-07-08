import type { CreatorCharacter, CreatorRecord } from '../types/domain';

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

function summarizeTags(tags: string[]) {
  if (tags.length === 0) return 'creator-led, short-form marketing';
  if (tags.length === 1) return tags[0];
  return `${tags.slice(0, 2).join(', ')}${tags.length > 2 ? `, +${tags.length - 2} more` : ''}`;
}

export function creatorToCharacter(creator: Pick<CreatorRecord, 'id' | 'name' | 'description' | 'baseImageUrl' | 'baseImageProvider' | 'baseImageMimeType' | 'clips'>): CreatorCharacter {
  const clipTags = Array.from(new Set(creator.clips.flatMap((clip) => clip.tags.map((tag) => tag.trim().toLowerCase())).filter(Boolean)));
  return {
    id: creator.id,
    source: 'preset',
    name: creator.name,
    persona: limitText(creator.description ?? 'Creator library profile.', characterLimits.persona),
    appearance: limitText(`Base image: ${creator.baseImageMimeType ?? 'uploaded image'} on ${creator.baseImageProvider}.`, characterLimits.appearance),
    voice: limitText(summarizeTags(clipTags), characterLimits.voice),
    prompt: limitText([
      `Character: ${creator.name}.`,
      creator.description ? `Description: ${creator.description}.` : null,
      `Base image: ${creator.baseImageUrl}.`,
      clipTags.length > 0 ? `Clip library: ${creator.clips.length} clips tagged ${clipTags.slice(0, 6).join(', ')}.` : 'Clip library: no clips uploaded yet.',
      'Keep the look premium, creator-led, and ready for short-form marketing.',
    ].filter(Boolean).join(' '), characterLimits.prompt),
    baseImageUrl: creator.baseImageUrl,
    baseImageProvider: creator.baseImageProvider,
    baseImageMimeType: creator.baseImageMimeType,
    clipCount: creator.clips.length,
    clipTags,
  };
}

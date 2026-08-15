import type { CreatorClipRecord, ProjectSnapshot } from '../types/domain';
import { calculateTfIdfCosineSimilarity } from './similarity';

function conceptTagsFromDirection(value: string) {
  return value
    .split(/[,.]/g)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function selectMatchedClips(
  concepts: ProjectSnapshot['concepts'],
  clips: CreatorClipRecord[],
  initiallyUsedClipIds: Iterable<string> = [],
) {
  const usedClipIds = new Set(initiallyUsedClipIds);

  return concepts.map((concept, index) => {
    if (clips.length === 0) return null;

    const queryTags = conceptTagsFromDirection(concept.videoDirection);
    const scores = calculateTfIdfCosineSimilarity(queryTags, clips.map((clip) => clip.tags));

    let bestIndex = -1;
    let bestScore = 0;

    scores.forEach((score, clipIndex) => {
      const clip = clips[clipIndex];
      if (!clip || usedClipIds.has(clip.id)) return;
      if (bestIndex === -1 || score > bestScore) {
        bestIndex = clipIndex;
        bestScore = score;
      }
    });

    if (bestIndex === -1 || bestScore === 0) {
      bestIndex = clips.findIndex((clip, offset) => !usedClipIds.has(clip.id) && offset >= index % clips.length);
      if (bestIndex === -1) bestIndex = clips.findIndex((clip) => !usedClipIds.has(clip.id));
      if (bestIndex === -1) bestIndex = index % clips.length;
    }

    const matchedClip = clips[bestIndex] ?? clips[index % clips.length];
    if (matchedClip) usedClipIds.add(matchedClip.id);
    return matchedClip ?? null;
  });
}

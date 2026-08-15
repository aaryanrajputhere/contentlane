import type { ConceptCard, CreatorRecord, CreatorSelection, ProjectSnapshot } from '../types/domain';
import { selectMatchedClips } from './clipMatching';

export interface CreatorAssignment {
  concept: ConceptCard;
  creator: CreatorRecord;
  clip: CreatorRecord['clips'][number] | null;
}

export function eligibleCreators(creators: CreatorRecord[]) {
  return creators.filter((creator) => creator.clips.length > 0);
}

export function effectiveCreatorSelection(
  project: Pick<ProjectSnapshot, 'creatorSelection' | 'selectedCharacter'>,
  creators: CreatorRecord[],
): CreatorSelection | null {
  const available = eligibleCreators(creators);
  if (project.creatorSelection) return project.creatorSelection;
  if (project.selectedCharacter) {
    return { mode: 'single', characters: [project.selectedCharacter] };
  }
  if (available.length === 0) return null;
  return {
    mode: available.length >= 2 ? 'mix' : 'single',
    characters: available.map((creator) => creator.character),
  };
}

export function assignCreatorsToConcepts(
  concepts: ConceptCard[],
  creators: CreatorRecord[],
  selection: CreatorSelection | null,
): CreatorAssignment[] {
  if (!selection || selection.characters.length === 0) return [];

  const creatorsById = new Map(creators.map((creator) => [creator.id, creator]));
  const roster = selection.characters
    .map((character) => creatorsById.get(character.id))
    .filter((creator): creator is CreatorRecord => Boolean(creator?.clips.length));
  if (roster.length === 0) return [];

  const persisted = new Map<string, CreatorAssignment>();
  const persistedClipIdsByCreator = new Map<string, Set<string>>();
  [...concepts].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).forEach((concept) => {
    if (!concept.assignedCreatorId || !concept.assignedClipId) return;
    const creator = roster.find((candidate) => candidate.id === concept.assignedCreatorId);
    const clip = creator?.clips.find((candidate) => candidate.id === concept.assignedClipId);
    if (!creator || !clip) return;
    const usedClipIds = persistedClipIdsByCreator.get(creator.id) ?? new Set<string>();
    if (usedClipIds.has(clip.id)) return;
    usedClipIds.add(clip.id);
    persistedClipIdsByCreator.set(creator.id, usedClipIds);
    persisted.set(concept.id, { concept, creator, clip });
  });
  const fallbackConcepts = concepts
    .filter((concept) => !persisted.has(concept.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  if (fallbackConcepts.length === 0) return concepts.flatMap((concept) => {
    const assignment = persisted.get(concept.id);
    return assignment ? [assignment] : [];
  });

  const creatorByConcept = fallbackConcepts.map((concept) =>
    selection.mode === 'mix' ? roster[concept.sortOrder % roster.length] : roster[0],
  );
  const clipsByConcept = new Map<string, CreatorRecord['clips'][number] | null>();

  roster.forEach((creator) => {
    const creatorConcepts = fallbackConcepts.filter((_, index) => creatorByConcept[index]?.id === creator.id);
    const matchedClips = selectMatchedClips(creatorConcepts, creator.clips, persistedClipIdsByCreator.get(creator.id));
    creatorConcepts.forEach((concept, index) => clipsByConcept.set(concept.id, matchedClips[index] ?? null));
  });

  const fallbackAssignments = new Map<string, CreatorAssignment>();
  fallbackConcepts.forEach((concept, index) => {
    const creator = creatorByConcept[index];
    if (creator) fallbackAssignments.set(concept.id, { concept, creator, clip: clipsByConcept.get(concept.id) ?? null });
  });
  return concepts.flatMap((concept) => {
    const assignment = persisted.get(concept.id) ?? fallbackAssignments.get(concept.id);
    if (!assignment) return [];
    return [assignment];
  });
}

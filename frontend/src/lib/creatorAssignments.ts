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

  const creatorByConcept = concepts.map((_, index) =>
    selection.mode === 'mix' ? roster[index % roster.length] : roster[0],
  );
  const clipsByConcept = new Map<string, CreatorRecord['clips'][number] | null>();

  roster.forEach((creator) => {
    const creatorConcepts = concepts.filter((_, index) => creatorByConcept[index]?.id === creator.id);
    const matchedClips = selectMatchedClips(creatorConcepts, creator.clips);
    creatorConcepts.forEach((concept, index) => clipsByConcept.set(concept.id, matchedClips[index] ?? null));
  });

  return concepts.flatMap((concept, index) => {
    const creator = creatorByConcept[index];
    return creator ? [{ concept, creator, clip: clipsByConcept.get(concept.id) ?? null }] : [];
  });
}

type MatchConcept = {
  id: string;
  sortOrder: number;
  videoDirection: string;
  assignedCreatorId?: string | null;
  assignedClipId?: string | null;
};

type MatchClip = {
  id: string;
  url: string;
  tags: string[];
};

type MatchCreator = {
  id: string;
  name: string;
  clips: MatchClip[];
};

type CreatorSelection = {
  mode: 'single' | 'mix';
  characters: Array<{ id: string }>;
};

export type ResolvedCreatorClipAssignment = {
  conceptId: string;
  creatorId: string;
  clipId: string;
  clipUrl: string;
  creatorName: string;
};

export function resolveStoredCreatorClipAssignments(
  concepts: MatchConcept[],
  creators: MatchCreator[],
): ResolvedCreatorClipAssignment[] {
  const creatorsById = new Map(creators.map((creator) => [creator.id, creator]));
  const usedClipIds = new Set<string>();
  const assignments: ResolvedCreatorClipAssignment[] = [];

  for (const concept of concepts) {
    if (!concept.assignedCreatorId || !concept.assignedClipId) return [];
    const creator = creatorsById.get(concept.assignedCreatorId);
    const clip = creator?.clips.find((candidate) => candidate.id === concept.assignedClipId);
    if (!creator || !clip || usedClipIds.has(clip.id)) return [];
    usedClipIds.add(clip.id);
    assignments.push({ conceptId: concept.id, creatorId: creator.id, clipId: clip.id, clipUrl: clip.url, creatorName: creator.name });
  }

  return assignments;
}

function normalizeTags(tags: string[]) {
  return tags.flatMap((tag) => tag.toLowerCase().split(/[\s_-]+/)).filter(Boolean);
}

function similarity(queryTags: string[], docsTags: string[][]) {
  const queryTokens = normalizeTags(queryTags);
  const docsTokens = docsTags.map(normalizeTags);
  if (queryTokens.length === 0) return docsTokens.map(() => 0);

  const documentFrequency = new Map<string, number>();
  const allDocuments = [queryTokens, ...docsTokens];
  for (const tokens of allDocuments) {
    for (const token of new Set(tokens)) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }

  const idf = new Map<string, number>();
  for (const [token, frequency] of documentFrequency) idf.set(token, Math.log(allDocuments.length / (1 + frequency)) + 1);

  const vector = (tokens: string[]) => {
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    const result = new Map<string, number>();
    for (const [token, count] of counts) result.set(token, (count / tokens.length) * (idf.get(token) ?? 0));
    return result;
  };

  const queryVector = vector(queryTokens);
  return docsTokens.map((tokens) => {
    const docVector = vector(tokens);
    let dot = 0;
    let queryNorm = 0;
    let docNorm = 0;
    const keys = new Set([...queryVector.keys(), ...docVector.keys()]);
    for (const key of keys) {
      const queryValue = queryVector.get(key) ?? 0;
      const docValue = docVector.get(key) ?? 0;
      dot += queryValue * docValue;
      queryNorm += queryValue * queryValue;
      docNorm += docValue * docValue;
    }
    return queryNorm === 0 || docNorm === 0 ? 0 : dot / (Math.sqrt(queryNorm) * Math.sqrt(docNorm));
  });
}

function conceptTags(videoDirection: string) {
  return videoDirection.split(/[,.]/g).map((tag) => tag.trim()).filter(Boolean);
}

function matchClips(concepts: MatchConcept[], clips: MatchClip[], initiallyUsedClipIds: Iterable<string> = []) {
  const usedClipIds = new Set(initiallyUsedClipIds);
  return concepts.map((concept, index) => {
    const scores = similarity(conceptTags(concept.videoDirection), clips.map((clip) => clip.tags));
    let bestIndex = -1;
    let bestScore = 0;
    scores.forEach((score, clipIndex) => {
      if (usedClipIds.has(clips[clipIndex]?.id ?? '')) return;
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

    const clip = clips[bestIndex] ?? clips[index % clips.length];
    if (clip) usedClipIds.add(clip.id);
    return clip ?? null;
  });
}

export function resolveCreatorClipAssignments(
  concepts: MatchConcept[],
  creators: MatchCreator[],
  selection: CreatorSelection,
): ResolvedCreatorClipAssignment[] {
  const creatorsById = new Map(creators.map((creator) => [creator.id, creator]));
  const roster = selection.characters.map((character) => creatorsById.get(character.id)).filter((creator): creator is MatchCreator => Boolean(creator?.clips.length));
  if (roster.length === 0) return [];

  const persisted = new Map<string, ResolvedCreatorClipAssignment>();
  const persistedClipIdsByCreator = new Map<string, Set<string>>();
  [...concepts].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).forEach((concept) => {
    if (!concept.assignedCreatorId || !concept.assignedClipId) return;
    const creator = roster.find((candidate) => candidate.id === concept.assignedCreatorId);
    const clip = creator?.clips.find((candidate) => candidate.id === concept.assignedClipId);
    if (!creator || !clip) return;
    const usedClipIds = persistedClipIdsByCreator.get(creator.id) ?? new Set<string>();
    usedClipIds.add(clip.id);
    persistedClipIdsByCreator.set(creator.id, usedClipIds);
    persisted.set(concept.id, { conceptId: concept.id, creatorId: creator.id, clipId: clip.id, clipUrl: clip.url, creatorName: creator.name });
  });
  const fallbackConcepts = concepts
    .filter((concept) => !persisted.has(concept.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const fallbackAssignments = new Map<string, ResolvedCreatorClipAssignment>();

  const creatorByConcept = fallbackConcepts.map((concept) => selection.mode === 'mix' ? roster[concept.sortOrder % roster.length] : roster[0]);
  const clipsByConcept = new Map<string, MatchClip | null>();
  roster.forEach((creator) => {
    const creatorConcepts = fallbackConcepts.filter((_, index) => creatorByConcept[index]?.id === creator.id);
    const matchedClips = matchClips(creatorConcepts, creator.clips, persistedClipIdsByCreator.get(creator.id));
    creatorConcepts.forEach((concept, index) => clipsByConcept.set(concept.id, matchedClips[index] ?? null));
  });

  fallbackConcepts.forEach((concept, index) => {
    const creator = creatorByConcept[index];
    const clip = clipsByConcept.get(concept.id);
    if (creator && clip) fallbackAssignments.set(concept.id, { conceptId: concept.id, creatorId: creator.id, clipId: clip.id, clipUrl: clip.url, creatorName: creator.name });
  });

  return concepts.flatMap((concept) => {
    const assignment = persisted.get(concept.id) ?? fallbackAssignments.get(concept.id);
    return assignment ? [assignment] : [];
  });
}

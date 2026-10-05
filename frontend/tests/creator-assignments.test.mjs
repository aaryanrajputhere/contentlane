import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Run the production TypeScript helpers with the existing Node test runner.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 },
}).outputText).toString('base64')}`;
const similarityUrl = moduleUrl(await readFile(new URL('../src/lib/similarity.ts', import.meta.url), 'utf8'));
const matchingSource = await readFile(new URL('../src/lib/clipMatching.ts', import.meta.url), 'utf8');
const matchingUrl = moduleUrl(matchingSource.replace("'./similarity'", JSON.stringify(similarityUrl)));
const assignmentSource = await readFile(new URL('../src/lib/creatorAssignments.ts', import.meta.url), 'utf8');
const { assignCreatorsToConcepts } = await import(moduleUrl(assignmentSource.replace("'./clipMatching'", JSON.stringify(matchingUrl))));
const creator = (id, clipIds) => ({ id, clips: clipIds.map((clipId) => ({ id: clipId, tags: [] })) });
const concepts = [
  { id: 'manual', sortOrder: 0, videoDirection: '', assignedCreatorId: 'new', assignedClipId: 'new-clip' },
  { id: 'automatic', sortOrder: 1, videoDirection: '' },
];
const selection = { mode: 'single', characters: [{ id: 'original' }] };

test('manual selections from new creators survive preview while fallback keeps the generation roster', () => {
  const creators = [creator('original', ['old-clip']), creator('new', ['new-clip'])];
  assert.deepEqual(assignCreatorsToConcepts(concepts, creators, selection).map((item) => item.clip.id), ['new-clip', 'old-clip']);
});

test('saved selections survive an unavailable or absent generation roster', () => {
  const creators = [creator('new', ['new-clip'])];
  for (const roster of [selection, null]) {
    assert.deepEqual(assignCreatorsToConcepts(concepts, creators, roster).map((item) => item.clip.id), ['new-clip']);
  }
});

test('refreshing the library preserves saved clips when a new clip is uploaded', () => {
  const saved = [{ ...concepts[0], assignedCreatorId: 'original', assignedClipId: 'old-clip' }];
  assert.equal(assignCreatorsToConcepts(saved, [creator('original', ['old-clip', 'later-clip'])], selection)[0].clip.id, 'old-clip');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCreatorClipAssignments, resolveStoredCreatorClipAssignments } from '../lib/creator-clip-matching';

const creator = (id: string, clips: Array<{ id: string; tags: string[] }>) => ({
  id,
  name: id,
  clips: clips.map((clip) => ({ ...clip, url: `https://cdn.test/${clip.id}.mp4` })),
});

const concept = (id: string, videoDirection: string, sortOrder = Number(id.match(/\d+$/)?.[0] ?? 0) - 1) => ({ id, videoDirection, sortOrder });

test('matches exact and partial video-direction tags before falling back', () => {
  const result = resolveCreatorClipAssignments(
    [concept('hook-1', 'talking head, office'), concept('hook-2', 'walking outdoors'), concept('hook-3', 'unknown')],
    [creator('creator-1', [
      { id: 'clip-office', tags: ['talking head', 'office'] },
      { id: 'clip-outdoors', tags: ['outdoors', 'walking'] },
      { id: 'clip-default', tags: ['product'] },
    ])],
    { mode: 'single', characters: [{ id: 'creator-1' }] },
  );

  assert.deepEqual(result.map((item) => item.clipId), ['clip-office', 'clip-outdoors', 'clip-default']);
});

test('assigns mixed creator hooks using each creator\'s own clips', () => {
  const result = resolveCreatorClipAssignments(
    [concept('hook-1', 'kitchen'), concept('hook-2', 'gym'), concept('hook-3', 'kitchen'), concept('hook-4', 'gym')],
    [
      creator('creator-a', [{ id: 'a-kitchen', tags: ['kitchen'] }, { id: 'a-default', tags: ['default'] }]),
      creator('creator-b', [{ id: 'b-gym', tags: ['gym'] }, { id: 'b-default', tags: ['default'] }]),
    ],
    { mode: 'mix', characters: [{ id: 'creator-a' }, { id: 'creator-b' }] },
  );

  assert.deepEqual(result.map((item) => item.clipId), ['a-kitchen', 'b-gym', 'a-default', 'b-default']);
});

test('reuses a clip only after every available clip has been used', () => {
  const result = resolveCreatorClipAssignments(
    [concept('hook-1', 'one'), concept('hook-2', 'two'), concept('hook-3', 'three')],
    [creator('creator-1', [{ id: 'clip-1', tags: ['one'] }, { id: 'clip-2', tags: ['two'] }])],
    { mode: 'single', characters: [{ id: 'creator-1' }] },
  );

  assert.deepEqual(result.map((item) => item.clipId), ['clip-1', 'clip-2', 'clip-1']);
});

test('returns no assignments when selected creators have no clips', () => {
  const result = resolveCreatorClipAssignments(
    [concept('hook-1', 'talking head')],
    [creator('creator-1', [])],
    { mode: 'single', characters: [{ id: 'creator-1' }] },
  );

  assert.equal(result.length, 0);
});

test('uses hook sort order rather than database id order for mixed creators', () => {
  const result = resolveCreatorClipAssignments(
    [concept('z-hook', 'first', 0), concept('a-hook', 'second', 1)],
    [
      creator('creator-a', [{ id: 'a-first', tags: ['first'] }]),
      creator('creator-b', [{ id: 'b-second', tags: ['second'] }]),
    ],
    { mode: 'mix', characters: [{ id: 'creator-a' }, { id: 'creator-b' }] },
  );

  assert.deepEqual(result.map((item) => item.clipId), ['a-first', 'b-second']);
});

test('keeps duplicate persisted clips authoritative after an explicit edit', () => {
  const result = resolveCreatorClipAssignments(
    [
      { ...concept('hook-1', 'surprised'), assignedCreatorId: 'creator-1', assignedClipId: 'clip-1' },
      { ...concept('hook-2', 'frustrated'), assignedCreatorId: 'creator-1', assignedClipId: 'clip-1' },
    ],
    [creator('creator-1', [
      { id: 'clip-1', tags: ['surprised'] },
      { id: 'clip-2', tags: ['frustrated'] },
    ])],
    { mode: 'single', characters: [{ id: 'creator-1' }] },
  );

  assert.deepEqual(result.map((item) => item.clipId), ['clip-1', 'clip-1']);
});

test('keeps valid persisted creator and clip assignments authoritative', () => {
  const concepts = [
    { ...concept('hook-1', 'office'), assignedCreatorId: 'creator-1', assignedClipId: 'clip-office' },
    { ...concept('hook-2', 'outdoors'), assignedCreatorId: 'creator-1', assignedClipId: 'clip-outdoors' },
  ];
  const creators = [creator('creator-1', [
    { id: 'clip-office', tags: ['office'] },
    { id: 'clip-outdoors', tags: ['outdoors'] },
    { id: 'clip-other', tags: ['other'] },
  ])];

  const stored = resolveStoredCreatorClipAssignments(concepts, creators);
  const resolved = resolveCreatorClipAssignments(concepts, creators, { mode: 'single', characters: [{ id: 'creator-1' }] });

  assert.deepEqual(stored.map((item) => item.clipId), ['clip-office', 'clip-outdoors']);
  assert.deepEqual(resolved.map((item) => item.clipId), ['clip-office', 'clip-outdoors']);
});

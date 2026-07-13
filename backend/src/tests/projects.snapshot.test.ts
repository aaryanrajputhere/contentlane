import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { buildBrandProfile, buildExportState } from '../lib/workflow';

test('export state uses the selected concept as the default overlay text source', () => {
  const profile = buildBrandProfile('https://example.com');
  const concept = {
    id: 'ckv9z7t7f0000xkqwf3concept',
    projectId: 'ckv9z7t7f0000xkqwf3proj',
    angle: 'Sharper angle',
    hookText: 'Select a sharper angle for example.com',
    hookImagePrompt: 'prompt',
    demoOverlayText: 'overlay',
    videoDirection: 'direction',
    targetDurationLabel: '4-5s',
    targetDurationSeconds: 5,
    score: 94,
    scoreLabel: 'Top rank',
    rationale: 'rationale',
    generatedImageUrl: null,
    generatedVideoUrl: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const exportState = buildExportState({ id: 'ckv9z7t7f0000xkqwf3d', website: 'https://example.com', normalizedWebsite: 'https://example.com', status: 'READY', createdAt: new Date(), updatedAt: new Date(), selectedConceptId: null, selectedCharacterId: null, selectedCharacter: null, userId: null }, concept, null, null);
  assert.match(exportState.overlayText, /example\.com/i);
  assert.equal(profile.brandName.length > 0, true);
  assert.equal(exportState.selectedConceptId, concept.id);
});

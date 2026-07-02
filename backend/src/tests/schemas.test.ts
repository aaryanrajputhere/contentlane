import assert from 'node:assert/strict';
import test from 'node:test';
import { authSchema, hookTemplateSchema, sceneSchema, scriptJobSchema } from '../domain/schemas';

test('authentication normalizes email addresses', () => {
  const value = authSchema.parse({ email: '  Tester@Example.COM ', password: 'a-secure-password' });
  assert.equal(value.email, 'tester@example.com');
});

test('authentication rejects short passwords', () => {
  assert.throws(() => authSchema.parse({ email: 'tester@example.com', password: 'short' }));
});

test('persisted scenes reject oversized prompts', () => {
  assert.throws(() => sceneSchema.parse({ onScreenText: 'Hook', imagePrompt: 'x'.repeat(4001), durationSeconds: 5 }));
  assert.throws(() => sceneSchema.parse({ onScreenText: 'Hook', videoPrompt: 'Legacy prompt', durationSeconds: 5 }));
  assert.throws(() => sceneSchema.parse({ onScreenText: 'Hook', imagePrompt: 'New prompt', videoPrompt: 'Legacy prompt', durationSeconds: 5 }));
});


const validScriptJobBase = {
  campaignId: 'ckv9z7t7f0000xkqwf8dlqy3d',
  productId: 'ckv9z7t7f0001xkqw9t4s81fb',
};

test('script jobs accept legacy string hooks', () => {
  const value = scriptJobSchema.parse({ ...validScriptJobBase, hooks: ['A better setup in seconds'] });
  assert.equal(value.hooks[0], 'A better setup in seconds');
});

test('script jobs accept structured scene-by-scene hook briefs', () => {
  const value = scriptJobSchema.parse({
    ...validScriptJobBase,
    hooks: [{
      text: 'The difference is visible fast',
      templateType: 'Mess vs. Masterpiece',
      sceneDurationSeconds: 2,
      scenes: [
        { purpose: 'Show the mess', context: 'A cluttered table', requiredVisualChange: 'Add one wrong item', overlayTextDirection: 'Messy start' },
        { purpose: 'Reveal the fix', context: 'Same table after clearing space', requiredVisualChange: 'Place the product', overlayTextDirection: 'Now it fits' },
      ],
    }],
  });
  const hook = value.hooks[0];
  assert.equal(typeof hook, 'object');
  if (typeof hook === 'object') {
    assert.equal(hook.scenes.length, 2);
    assert.equal(hook.sceneDurationSeconds, 2);
  }
});

test('script jobs reject invalid structured hook timing and empty briefs', () => {
  assert.throws(() => scriptJobSchema.parse({
    ...validScriptJobBase,
    hooks: [{ text: 'Bad timing', sceneDurationSeconds: 0, scenes: [{ purpose: 'x', context: 'x', requiredVisualChange: 'x', overlayTextDirection: 'x' }] }],
  }));
  assert.throws(() => scriptJobSchema.parse({
    ...validScriptJobBase,
    hooks: [{ text: 'No scenes', sceneDurationSeconds: 2, scenes: [] }],
  }));
});


test('hook template payloads accept full scene briefs', () => {
  const value = hookTemplateSchema.parse({
    title: 'Value Stacker',
    text: 'Three details make this worth it',
    templateType: 'Value Stacker',
    sceneDurationSeconds: 2,
    sortOrder: 30,
    isActive: true,
    scenes: [
      { purpose: 'Open with promise', context: 'Use case before reveal', requiredVisualChange: 'Reveal the product', overlayTextDirection: 'Three details matter' },
    ],
  });
  assert.equal(value.title, 'Value Stacker');
  assert.equal(value.scenes.length, 1);
});

test('hook template payloads reject invalid scenes', () => {
  assert.throws(() => hookTemplateSchema.parse({
    title: 'Bad template',
    text: 'No scene context',
    templateType: 'Bad',
    sceneDurationSeconds: 2,
    scenes: [{ purpose: 'x', context: '', requiredVisualChange: 'x', overlayTextDirection: 'x' }],
  }));
});

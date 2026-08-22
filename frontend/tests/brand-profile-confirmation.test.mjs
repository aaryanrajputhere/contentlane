import assert from 'node:assert/strict';
import test from 'node:test';
import { brandProfileValidationError, requiresBrandProfileConfirmation } from '../src/lib/brand-profile-confirmation.mjs';

const profile = {
  brandName: 'ContentLane',
  productSummary: 'Turns websites into short-form marketing videos.',
  targetAudience: 'SaaS growth teams',
  customerProblems: ['Slow creative production'],
  keyBenefits: ['Faster testing'],
  proofPoints: [],
  claimConstraints: [],
};

test('brand confirmation validates required fields and list limits', () => {
  assert.equal(brandProfileValidationError(profile), null);
  assert.match(brandProfileValidationError({ ...profile, targetAudience: '' }), /target audience/);
  assert.match(brandProfileValidationError({ ...profile, customerProblems: [] }), /customer problem/);
  assert.match(brandProfileValidationError({ ...profile, keyBenefits: Array.from({ length: 6 }, () => 'Benefit') }), /up to 5/);
});

test('only a new analyzed project without hooks requires confirmation', () => {
  const project = { brandProfile: profile, brandProfileConfirmedAt: null, concepts: [] };
  assert.equal(requiresBrandProfileConfirmation(project), true);
  assert.equal(requiresBrandProfileConfirmation({ ...project, brandProfileConfirmedAt: new Date().toISOString() }), false);
  assert.equal(requiresBrandProfileConfirmation({ ...project, concepts: [{ id: 'hook' }] }), false);
  assert.equal(requiresBrandProfileConfirmation({ ...project, brandProfile: null }), false);
});

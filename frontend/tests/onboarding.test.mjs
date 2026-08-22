import assert from 'node:assert/strict';
import test from 'node:test';
import { PENDING_WEBSITE_KEY, isFreeConversionRequired, normalizePendingWebsite, savePendingWebsite } from '../src/lib/onboarding.mjs';

test('normalizes and validates pending onboarding websites', () => {
  assert.equal(normalizePendingWebsite('example.com'), 'https://example.com/');
  assert.equal(normalizePendingWebsite('https://example.com/pricing'), 'https://example.com/pricing');
  assert.equal(normalizePendingWebsite('not a website'), null);
  assert.equal(normalizePendingWebsite('javascript:alert(1)'), null);
});

test('stores only a validated pending website', () => {
  const values = new Map();
  globalThis.sessionStorage = { setItem: (key, value) => values.set(key, value) };
  assert.equal(savePendingWebsite('contentlane.app'), 'https://contentlane.app/');
  assert.equal(values.get(PENDING_WEBSITE_KEY), 'https://contentlane.app/');
  assert.equal(savePendingWebsite('bad url'), null);
});

test('free conversion locks at eight selections, 24 reviews, or permanent ending', () => {
  const base = { isFreeFlow: true, ended: false, selected: 3, generated: 16, reviewed: 9 };
  assert.equal(isFreeConversionRequired(base), false);
  assert.equal(isFreeConversionRequired({ ...base, selected: 8 }), true);
  assert.equal(isFreeConversionRequired({ ...base, generated: 24, reviewed: 24 }), true);
  assert.equal(isFreeConversionRequired({ ...base, ended: true }), true);
  assert.equal(isFreeConversionRequired({ ...base, isFreeFlow: false, selected: 8 }), false);
});

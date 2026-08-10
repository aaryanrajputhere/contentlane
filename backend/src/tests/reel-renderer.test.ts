import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReelFilter, escapeDrawtext, toRenderableCaptionText, wrapOverlayText } from '../lib/reel-renderer';

test('short overlay text remains on one line', () => {
  assert.equal(wrapOverlayText('Ship faster 🚀', 'STANDARD'), 'Ship faster 🚀');
});

test('long overlay text wraps only at word boundaries', () => {
  const wrapped = wrapOverlayText('This is a deliberately long caption that should wrap cleanly for the reel preview', 'STANDARD');
  assert.equal(wrapped, 'This is a deliberately\nlong caption that should\nwrap cleanly for the\nreel preview');
  assert.equal(wrapped.includes('\n '), false);
});

test('drawtext escaping preserves punctuation, emoji, and explicit newlines', () => {
  assert.equal(escapeDrawtext("Wait… really? 100% 🔥: it's live\nnow"), "Wait… really? 100\\% 🔥\\: it\\'s live\\\\nnow");
});

test('server captions use visible monochrome emoji fallbacks when color emoji is unavailable', () => {
  assert.equal(toRenderableCaptionText('I tried it 😭 🔥'), 'I tried it ☹ ✦');
});

test('Snapchat filter uses a centered input-height band and wider wrapped captions', () => {
  const filter = buildReelFilter('A short hook', 'A short demo', 'SNAPCHAT');
  assert.match(filter, /drawbox=x=0:y=\(ih-82\)\/2:w=iw:h=82/);
  assert.match(filter, /fontsize=46/);
  assert.match(filter, /x=\(w-text_w\)\/2:y=\(H-text_h\)\/2/);
});

test('Snapchat band grows for a wrapped two-line caption', () => {
  const filter = buildReelFilter('This Snapchat caption is long enough to wrap into two centered lines', 'Demo', 'SNAPCHAT');
  assert.match(filter, /drawbox=x=0:y=\(ih-140\)\/2:w=iw:h=140/);
});

test('standard filter uses centered multiline bold captions', () => {
  const filter = buildReelFilter('This standard caption is long enough to wrap across multiple lines safely', 'Demo copy', 'STANDARD');
  assert.match(filter, /fontfile=\/usr\/share\/fonts\/truetype\/dejavu\/DejaVuSans-Bold\.ttf/);
  assert.match(filter, /line_spacing=4/);
  assert.match(filter, /x=\(w-text_w\)\/2:y=\(H-text_h\)\/2/);
  assert.match(filter, /This standard caption is\\\\nlong enough/);
});

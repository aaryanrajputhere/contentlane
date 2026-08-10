import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  CAPTION_HEIGHT,
  CAPTION_WIDTH,
  captionDisplayLength,
  layoutCaption,
  parseCaptionRuns,
  rasterizeCaption,
} from '../lib/caption-rasterizer';
import { buildReelFilter, wrapOverlayText } from '../lib/reel-renderer';

const execFileAsync = promisify(execFile);

test('complete RGI emoji sequences are parsed as single runs and display units', () => {
  const emoji = ['😭', '🔥', '🤯', '❤️', '👍🏽', '🇮🇳', '👨‍👩‍👧‍👦'];
  const value = emoji.join(' ');
  assert.deepEqual(
    parseCaptionRuns(value).filter((run) => run.kind === 'emoji').map((run) => run.text),
    emoji,
  );
  assert.equal(captionDisplayLength(value), emoji.length * 2 - 1);
});

test('caption wrapping keeps existing thresholds and counts each emoji as one unit', () => {
  assert.equal(wrapOverlayText('Ship faster 🚀', 'STANDARD'), 'Ship faster 🚀');
  const wrapped = wrapOverlayText('This is a deliberately long caption that should wrap cleanly for the reel preview', 'STANDARD');
  assert.equal(wrapped, 'This is a deliberately\nlong caption that should\nwrap cleanly for the\nreel preview');
  assert.equal(wrapped.includes('\n '), false);

  const emojiHeavy = `${'a'.repeat(22)} 👨‍👩‍👧‍👦`;
  assert.equal(wrapOverlayText(emojiHeavy, 'STANDARD'), emojiHeavy);
});

test('pure text, mixed text, multiline, Snapchat, and standard lines are centered', () => {
  for (const [value, style] of [
    ['Pure text', 'STANDARD'],
    ['Mixed 🔥 text', 'STANDARD'],
    ['First line\nSecond ❤️ line', 'STANDARD'],
    ['Snapchat 👨‍👩‍👧‍👦 caption', 'SNAPCHAT'],
  ] as const) {
    const layout = layoutCaption(value, style, 'HOOK');
    for (const line of layout.lines) {
      assert.ok(Math.abs(line.x + line.width / 2 - CAPTION_WIDTH / 2) < 0.001);
    }
    assert.ok(Math.abs((layout.lines[0].y + layout.lines[layout.lines.length - 1].y) / 2 - CAPTION_HEIGHT / 2) < 0.001);
  }

  const snapchat = layoutCaption('A short hook', 'SNAPCHAT', 'HOOK');
  assert.deepEqual(snapchat.band, { y: 919, height: 82 });
  assert.equal(layoutCaption('A demo', 'SNAPCHAT', 'DEMO').band, undefined);
});

test('caption PNG is transparent, correctly sized, and contains chromatic emoji pixels', async () => {
  const png = await rasterizeCaption('Color 🔥 emoji', 'STANDARD', 'HOOK');
  const image = await loadImage(png);
  assert.equal(image.width, CAPTION_WIDTH);
  assert.equal(image.height, CAPTION_HEIGHT);

  const canvas = createCanvas(CAPTION_WIDTH, CAPTION_HEIGHT);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, CAPTION_WIDTH, CAPTION_HEIGHT).data;
  assert.equal(pixels[3], 0);
  let chromaticPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] > 0 && (pixels[index] !== pixels[index + 1] || pixels[index + 1] !== pixels[index + 2])) {
      chromaticPixels += 1;
    }
  }
  assert.ok(chromaticPixels > 100);
});

test('FFmpeg overlays static caption images and produces a valid reel with color emoji', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'contentlane-caption-smoke-'));
  const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
  try {
    const hook = join(directory, 'hook.mp4');
    const demo = join(directory, 'demo.mp4');
    const hookCaption = join(directory, 'hook.png');
    const demoCaption = join(directory, 'demo.png');
    const output = join(directory, 'output.mp4');
    const frame = join(directory, 'frame.png');
    await Promise.all([
      execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=1080x1920:r=10:d=0.3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', hook]),
      execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=1080x1920:r=10:d=0.3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', demo]),
      rasterizeCaption('Smoke 🔥', 'STANDARD', 'HOOK').then((png) => writeFile(hookCaption, png)),
      rasterizeCaption('Demo ❤️', 'STANDARD', 'DEMO').then((png) => writeFile(demoCaption, png)),
    ]);
    await execFileAsync(ffmpeg, [
      '-y', '-i', hook, '-i', demo, '-i', hookCaption, '-i', demoCaption,
      '-filter_complex', buildReelFilter(), '-map', '[video]',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', output,
    ]);
    const probe = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', output]);
    assert.equal(probe.stdout.trim(), '1080,1920');

    await execFileAsync(ffmpeg, ['-y', '-ss', '0.1', '-i', output, '-frames:v', '1', frame]);
    const image = await loadImage(frame);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let chromaticPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const spread = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
      if (spread > 20) chromaticPixels += 1;
    }
    assert.ok(chromaticPixels > 100);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reel filter accepts explicit static caption image inputs', () => {
  const filter = buildReelFilter({ hook: 4, demo: 5 });
  assert.match(filter, /\[hook-base\]\[4:v\]overlay=0:0:format=auto\[hook\]/);
  assert.match(filter, /\[demo-base\]\[5:v\]overlay=0:0:format=auto\[demo\]/);
  assert.doesNotMatch(filter, /drawtext|drawbox/);
});

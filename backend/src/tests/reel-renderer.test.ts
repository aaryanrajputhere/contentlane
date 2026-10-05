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
import { resolveDemoCaptionsEnabled } from '../lib/render-overlay';
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
    const expectedCenter = CAPTION_HEIGHT * (style === 'STANDARD' ? 0.7 : 0.5);
    assert.ok(Math.abs((layout.lines[0].y + layout.lines[layout.lines.length - 1].y) / 2 - expectedCenter) < 0.001);
  }

  const snapchat = layoutCaption('A short hook', 'SNAPCHAT', 'HOOK');
  const snapchatDemo = layoutCaption('A demo', 'SNAPCHAT', 'DEMO');
  assert.deepEqual(snapchat.band, { y: 919, height: 82 });
  assert.deepEqual(snapchatDemo.band, { y: 919, height: 82 });
  assert.equal(snapchatDemo.fontSize, snapchat.fontSize);
  assert.equal(snapchatDemo.lineHeight, snapchat.lineHeight);
  assert.equal(layoutCaption('A demo', 'STANDARD', 'DEMO').band, undefined);
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
      execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=1080x1920:r=24:d=0.3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', hook]),
      execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=1080x1920:r=29.97:d=0.3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', demo]),
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
  assert.match(filter, /fps=30,setpts=PTS-STARTPTS/);
  assert.match(filter, /\[hook-base\]\[4:v\]overlay=0:0:format=auto\[hook\]/);
  assert.match(filter, /\[demo-base\]\[5:v\]overlay=0:0:format=auto\[demo\]/);
  assert.doesNotMatch(filter, /drawtext|drawbox/);
});

test('preview reel filter composites a full-frame watermark after concatenation', () => {
  const filter = buildReelFilter({ hook: 2, demo: 3 }, 4);
  assert.match(filter, /concat=n=2:v=1:a=0\[joined\]/);
  assert.match(filter, /\[joined\]\[4:v\]overlay=0:0:format=auto:shortest=1\[video\]/);
});

for (const demoEnabled of [true, false]) test(`looped preview watermark stops when both clips finish (demo captions ${demoEnabled})`, { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'contentlane-watermark-duration-'));
  const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
  try {
    const overlay = join(directory, 'overlay.png');
    const output = join(directory, 'output.mp4');
    const canvas = createCanvas(1080, 1920);
    await writeFile(overlay, canvas.toBuffer('image/png'));
    await execFileAsync(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=red:s=180x320:r=30:d=0.3',
      '-f', 'lavfi', '-i', 'color=c=blue:s=180x320:r=30:d=0.5',
      '-i', overlay, ...(demoEnabled ? ['-i', overlay] : []), '-loop', '1', '-i', overlay,
      '-filter_complex', buildReelFilter({ hook: 2, demo: demoEnabled ? 3 : null }, demoEnabled ? 4 : 3),
      '-map', '[video]', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2',
      '-pix_fmt', 'yuv420p', output,
    ], { timeout: 10000 });
    const probe = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=duration', '-of', 'csv=p=0', output,
    ]);
    const duration = Number(probe.stdout.trim());
    assert.ok(duration >= 0.7 && duration <= 0.9, `Expected both clips to total 0.8 seconds, received ${duration}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('disabled demo captions bypass the overlay and preserve hook and watermark inputs', () => {
  const clean = buildReelFilter({ hook: 2, demo: null });
  assert.match(clean, /\[hook-base\]\[2:v\]overlay/);
  assert.match(clean, /\[demo-base\]null\[demo\]/);
  assert.doesNotMatch(clean, /\[demo-base\]\[\d+:v\]overlay/);
  const preview = buildReelFilter({ hook: 2, demo: null }, 3);
  assert.match(preview, /\[joined\]\[3:v\]overlay=0:0:format=auto:shortest=1/);
});

test('caption-free demo frames remain clean for both styles while hook captions render', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'contentlane-clean-demo-'));
  try {
    const caption = join(directory, 'hook.png');
    for (const style of ['STANDARD', 'SNAPCHAT'] as const) {
      await writeFile(caption, await rasterizeCaption('Visible hook', style, 'HOOK'));
      const output = join(directory, `${style}.mp4`);
      await execFileAsync(process.env.FFMPEG_PATH ?? 'ffmpeg', [
        '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'color=c=gray:s=180x320:r=30:d=0.3',
        '-f', 'lavfi', '-i', 'color=c=gray:s=180x320:r=30:d=0.3',
        '-i', caption, '-filter_complex', buildReelFilter({ hook: 2, demo: null }),
        '-map', '[video]', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2', '-pix_fmt', 'yuv420p', output,
      ]);
      for (const [time, hasCaption] of [['0.1', true], ['0.4', false]] as const) {
        const frame = join(directory, `${style}-${time}.png`);
        await execFileAsync(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-ss', time, '-i', output, '-frames:v', '1', frame]);
        const img = await loadImage(frame);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
        let contrastPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 90 || pixels[i] > 180) contrastPixels++;
        assert.equal(contrastPixels > 100, hasCaption, `${style} at ${time}s`);
      }
      const probe = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output]);
      assert.ok(Math.abs(Number(probe.stdout.trim()) - 0.6) < 0.1);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('demo caption overrides take precedence and unset hooks follow the campaign default', () => {
  for (const campaign of [true, false]) {
    assert.equal(resolveDemoCaptionsEnabled(campaign, null), campaign);
    assert.equal(resolveDemoCaptionsEnabled(campaign, undefined), campaign);
    assert.equal(resolveDemoCaptionsEnabled(campaign, true), true);
    assert.equal(resolveDemoCaptionsEnabled(campaign, false), false);
  }
});

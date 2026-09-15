import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createCanvas } from '@napi-rs/canvas';
import { storeUploadedAsset } from './asset-storage';
import { rasterizeCaption, wrapCaptionText } from './caption-rasterizer';

const execFileAsync = promisify(execFile);

export interface ReelRenderInput {
  hookUrl: string;
  demoUrl: string;
  hookOverlay: string;
  demoOverlay: string;
  outputId: string;
  folder: string;
  captionStyle: 'SNAPCHAT' | 'STANDARD';
  watermark?: boolean;
}

export function wrapOverlayText(value: string, captionStyle: ReelRenderInput['captionStyle']) {
  return wrapCaptionText(value, captionStyle);
}

export interface ReelCaptionInputs {
  hook: number;
  demo: number;
}

export function buildReelFilter(captionInputs: ReelCaptionInputs = { hook: 2, demo: 3 }, watermarkInput?: number) {
  const filters = [
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,setpts=PTS-STARTPTS[hook-base]',
    `[hook-base][${captionInputs.hook}:v]overlay=0:0:format=auto[hook]`,
    '[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,setpts=PTS-STARTPTS[demo-base]',
    `[demo-base][${captionInputs.demo}:v]overlay=0:0:format=auto[demo]`,
    `[hook][demo]concat=n=2:v=1:a=0${watermarkInput === undefined ? '[video]' : '[joined]'}`,
  ];
  // The watermark input loops forever; stop its overlay when the joined clips end.
  if (watermarkInput !== undefined) filters.push(`[joined][${watermarkInput}:v]overlay=0:0:format=auto:shortest=1[video]`);
  return filters.join(';');
}

function createPreviewWatermark() {
  const canvas = createCanvas(1080, 1920);
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 1080, 1920);
  context.translate(540, 960);
  context.rotate(-Math.PI / 7);
  context.font = '700 64px Arial';
  context.textAlign = 'center';
  context.fillStyle = 'rgba(255,255,255,0.24)';
  context.strokeStyle = 'rgba(0,0,0,0.18)';
  context.lineWidth = 3;
  for (let y = -900; y <= 900; y += 330) {
    context.strokeText('CONTENTLANE PREVIEW', 0, y);
    context.fillText('CONTENTLANE PREVIEW', 0, y);
  }
  return canvas.toBuffer('image/png');
}

async function materialize(url: string, directory: string, name: string) {
  const target = join(directory, name);
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma < 0) throw new Error('Invalid media data URL');
    await writeFile(target, Buffer.from(url.slice(comma + 1), url.slice(0, comma).endsWith(';base64') ? 'base64' : 'utf8'));
    return target;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download media (${response.status})`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

export async function renderReel(input: ReelRenderInput) {
  const directory = await mkdtemp(join(tmpdir(), 'contentlane-render-'));
  try {
    const hook = await materialize(input.hookUrl, directory, 'hook.mp4');
    const demo = await materialize(input.demoUrl, directory, 'demo.mp4');
    const hookCaption = join(directory, 'hook-caption.png');
    const demoCaption = join(directory, 'demo-caption.png');
    const watermark = input.watermark ? join(directory, 'preview-watermark.png') : null;
    const [hookCaptionPng, demoCaptionPng] = await Promise.all([
      rasterizeCaption(input.hookOverlay, input.captionStyle, 'HOOK'),
      rasterizeCaption(input.demoOverlay, input.captionStyle, 'DEMO'),
    ]);
    await Promise.all([
      writeFile(hookCaption, hookCaptionPng),
      writeFile(demoCaption, demoCaptionPng),
      ...(watermark ? [writeFile(watermark, createPreviewWatermark())] : []),
    ]);

    const output = join(directory, 'output.mp4');
    const args = [
      '-y',
      '-i', hook,
      '-i', demo,
      '-i', hookCaption,
      '-i', demoCaption,
      ...(watermark ? ['-loop', '1', '-i', watermark] : []),
      '-filter_complex', buildReelFilter({ hook: 2, demo: 3 }, watermark ? 4 : undefined),
      '-map', '[video]',
      '-map', '1:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      output,
    ];
    await execFileAsync(process.env.FFMPEG_PATH ?? 'ffmpeg', args, { timeout: 10 * 60 * 1000, maxBuffer: 2 * 1024 * 1024 });
    const stored = await storeUploadedAsset(await readFile(output), { folder: input.folder, publicId: input.outputId, mimeType: 'video/mp4', overwrite: true });
    return { ...stored, format: 'mp4', durationSeconds: null };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

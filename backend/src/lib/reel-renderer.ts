import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { storeUploadedAsset } from './asset-storage';

const execFileAsync = promisify(execFile);

export interface ReelRenderInput {
  hookUrl: string;
  demoUrl: string;
  hookOverlay: string;
  demoOverlay: string;
  outputId: string;
  folder: string;
  captionStyle: 'SNAPCHAT' | 'STANDARD';
}

const CAPTION_WRAP_LENGTHS = {
  SNAPCHAT: 38,
  STANDARD: 24,
} as const;

const SNAPCHAT_FONT_SIZE = 46;
const SNAPCHAT_LINE_HEIGHT = 58;
const SNAPCHAT_VERTICAL_PADDING = 24;
const DEJAVU_SANS_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const DEJAVU_SANS_BOLD_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

// FFmpeg's libfreetype path cannot render the installed color emoji font. Keep
// the meaning visible in server exports with glyphs supported by DejaVu Sans.
const MONOCHROME_EMOJI_FALLBACKS: Readonly<Record<string, string>> = {
  '😭': '☹',
  '😢': '☹',
  '😂': '☺',
  '🤣': '☺',
  '🔥': '✦',
  '🚀': '➤',
  '💀': '☠',
  '❤️': '♥',
  '❤': '♥',
};

export function toRenderableCaptionText(value: string) {
  return value.replace(/😭|😢|😂|🤣|🔥|🚀|💀|❤️|❤/gu, (emoji) => MONOCHROME_EMOJI_FALLBACKS[emoji] ?? emoji);
}

/** Wrap on words before handing text to FFmpeg's drawtext filter. */
export function wrapOverlayText(value: string, captionStyle: ReelRenderInput['captionStyle']) {
  const maxLength = CAPTION_WRAP_LENGTHS[captionStyle];
  return value
    .split(/\r?\n/)
    .flatMap((paragraph) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return [''];

      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && candidate.length > maxLength) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      return lines;
    })
    .join('\n');
}

export function escapeDrawtext(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\\\n')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

export interface ReelTextFiles {
  hook: string[];
  demo: string[];
}

function centeredLinePosition(index: number, lineCount: number, lineHeight: number) {
  const offset = (index - (lineCount - 1) / 2) * lineHeight;
  return `y=(H-text_h)/2${offset === 0 ? '' : offset > 0 ? `+${offset}` : offset}`;
}

function drawTextLines(
  lines: string[],
  captionStyle: ReelRenderInput['captionStyle'],
  fontSize: number,
  fontFile: string,
  textFiles?: string[],
) {
  const lineHeight = captionStyle === 'SNAPCHAT' ? SNAPCHAT_LINE_HEIGHT : fontSize + 8;
  return lines.map((line, index) => {
    const source = textFiles
      ? `textfile='${escapeDrawtext(textFiles[index])}'`
      : `text='${escapeDrawtext(line)}'`;
    const common = `${source}:fontcolor=white:fontsize=${fontSize}:fontfile=${fontFile}:x=(w-text_w)/2:${centeredLinePosition(index, lines.length, lineHeight)}`;
    return captionStyle === 'SNAPCHAT'
      ? `drawtext=${common}:line_spacing=0`
      : `drawtext=${common}:line_spacing=4:borderw=${fontSize === 68 ? 10 : 8}:bordercolor=black@0.92:shadowx=0:shadowy=2:shadowcolor=black@0.5`;
  }).join(',');
}

export function buildReelFilter(
  hookOverlay: string,
  demoOverlay: string,
  captionStyle: ReelRenderInput['captionStyle'],
  textFiles?: ReelTextFiles,
) {
  const wrappedHook = wrapOverlayText(hookOverlay, captionStyle);
  const wrappedDemo = wrapOverlayText(demoOverlay, captionStyle);
  const hookText = escapeDrawtext(wrappedHook);
  const demoText = escapeDrawtext(wrappedDemo);
  const hookLines = wrappedHook.split('\n');
  const demoLines = wrappedDemo.split('\n');
  const hookSource = textFiles
    ? drawTextLines(hookLines, captionStyle, captionStyle === 'SNAPCHAT' ? SNAPCHAT_FONT_SIZE : 68, captionStyle === 'SNAPCHAT' ? DEJAVU_SANS_FONT : DEJAVU_SANS_BOLD_FONT, textFiles.hook)
    : null;
  const demoSource = textFiles
    ? drawTextLines(demoLines, captionStyle, 42, DEJAVU_SANS_BOLD_FONT, textFiles.demo)
    : null;
  const caption = captionStyle === 'SNAPCHAT'
    ? `drawbox=x=0:y=(ih-${Math.max(SNAPCHAT_LINE_HEIGHT, hookLines.length * SNAPCHAT_LINE_HEIGHT + SNAPCHAT_VERTICAL_PADDING)})/2:w=iw:h=${Math.max(SNAPCHAT_LINE_HEIGHT, hookLines.length * SNAPCHAT_LINE_HEIGHT + SNAPCHAT_VERTICAL_PADDING)}:color=black@0.6:t=fill,${hookSource ?? `drawtext=text='${hookText}':fontcolor=white:fontsize=${SNAPCHAT_FONT_SIZE}:fontfile=${DEJAVU_SANS_FONT}:line_spacing=0:x=(w-text_w)/2:y=(H-text_h)/2`}`
    : hookSource ?? `drawtext=text='${hookText}':fontcolor=white:fontsize=68:fontfile=${DEJAVU_SANS_BOLD_FONT}:line_spacing=4:borderw=10:bordercolor=black@0.92:shadowx=0:shadowy=2:shadowcolor=black@0.5:x=(w-text_w)/2:y=(H-text_h)/2`;
  return [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,${caption}[hook]`,
    `[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,${demoSource ?? `drawtext=text='${demoText}':fontcolor=white:fontsize=42:fontfile=${DEJAVU_SANS_BOLD_FONT}:line_spacing=4:borderw=8:bordercolor=black@0.92:shadowx=0:shadowy=2:shadowcolor=black@0.5:x=(w-text_w)/2:y=(H-text_h)/2`}[demo]`,
    '[hook][demo]concat=n=2:v=1:a=0[video]',
  ].join(';');
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
    const renderableHookOverlay = toRenderableCaptionText(input.hookOverlay);
    const renderableDemoOverlay = toRenderableCaptionText(input.demoOverlay);
    const hookLines = wrapOverlayText(renderableHookOverlay, input.captionStyle).split('\n');
    const demoLines = wrapOverlayText(renderableDemoOverlay, input.captionStyle).split('\n');
    const hookTextFiles = await Promise.all(hookLines.map((line, index) => {
      const path = join(directory, `hook-${index}.txt`);
      return writeFile(path, line, 'utf8').then(() => path);
    }));
    const demoTextFiles = await Promise.all(demoLines.map((line, index) => {
      const path = join(directory, `demo-${index}.txt`);
      return writeFile(path, line, 'utf8').then(() => path);
    }));
    const output = join(directory, 'output.mp4');
    const args = ['-y', '-i', hook, '-i', demo, '-filter_complex', buildReelFilter(renderableHookOverlay, renderableDemoOverlay, input.captionStyle, { hook: hookTextFiles, demo: demoTextFiles }), '-map', '[video]', '-map', '1:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', output];
    await execFileAsync(process.env.FFMPEG_PATH ?? 'ffmpeg', args, { timeout: 10 * 60 * 1000, maxBuffer: 2 * 1024 * 1024 });
    const stored = await storeUploadedAsset(await readFile(output), { folder: input.folder, publicId: input.outputId, mimeType: 'video/mp4', overwrite: true });
    return { ...stored, format: 'mp4', durationSeconds: null };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

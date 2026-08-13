import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { GlobalFonts, createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { parse } from '@twemoji/parser';

export type CaptionStyle = 'SNAPCHAT' | 'STANDARD';
export type CaptionRole = 'HOOK' | 'DEMO';

export const CAPTION_WIDTH = 1080;
export const CAPTION_HEIGHT = 1920;

const CAPTION_WRAP_LENGTHS: Readonly<Record<CaptionStyle, number>> = {
  SNAPCHAT: 38,
  STANDARD: 24,
};
const SNAPCHAT_FONT_SIZE = 46;
const SNAPCHAT_LINE_HEIGHT = 58;
const SNAPCHAT_VERTICAL_PADDING = 24;
const DEJAVU_SANS_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const DEJAVU_SANS_BOLD_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const TWEMOJI_ASSET_DIRECTORY = join(__dirname, '../../assets/twemoji');
const emojiImageCache = new Map<string, Promise<Image | null>>();

GlobalFonts.registerFromPath(DEJAVU_SANS_FONT, 'ContentLane Sans');
GlobalFonts.registerFromPath(DEJAVU_SANS_BOLD_FONT, 'ContentLane Sans Bold');

export interface CaptionRun {
  kind: 'text' | 'emoji';
  text: string;
  assetId?: string;
}

export interface CaptionLineLayout {
  text: string;
  x: number;
  y: number;
  width: number;
}

export interface CaptionLayout {
  fontSize: number;
  lineHeight: number;
  lines: CaptionLineLayout[];
  band?: { y: number; height: number };
}

function emojiEntities(value: string) {
  return parse(value, { buildUrl: (codepoints) => codepoints });
}

export function parseCaptionRuns(value: string): CaptionRun[] {
  const runs: CaptionRun[] = [];
  let offset = 0;
  for (const entity of emojiEntities(value)) {
    if (entity.indices[0] > offset) {
      runs.push({ kind: 'text', text: value.slice(offset, entity.indices[0]) });
    }
    runs.push({ kind: 'emoji', text: entity.text, assetId: entity.url });
    offset = entity.indices[1];
  }
  if (offset < value.length) runs.push({ kind: 'text', text: value.slice(offset) });
  return runs;
}

export function captionDisplayLength(value: string) {
  const entities = emojiEntities(value);
  let length = entities.length;
  let offset = 0;
  for (const entity of entities) {
    length += Array.from(value.slice(offset, entity.indices[0])).length;
    offset = entity.indices[1];
  }
  return length + Array.from(value.slice(offset)).length;
}

/** Wrap on words while treating a complete emoji sequence as one display unit. */
export function wrapCaptionText(value: string, captionStyle: CaptionStyle) {
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
        if (line && captionDisplayLength(candidate) > maxLength) {
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

function captionTypography(style: CaptionStyle, role: CaptionRole) {
  const fontSize = style === 'SNAPCHAT' ? SNAPCHAT_FONT_SIZE : role === 'DEMO' ? 42 : 68;
  return {
    fontSize,
    fontFamily: style === 'SNAPCHAT' ? 'ContentLane Sans' : 'ContentLane Sans Bold',
    lineHeight: style === 'SNAPCHAT' ? SNAPCHAT_LINE_HEIGHT : fontSize + 8,
  };
}

function runWidth(context: SKRSContext2D, run: CaptionRun, fontSize: number) {
  return run.kind === 'emoji' ? fontSize : context.measureText(run.text).width;
}

export function layoutCaption(value: string, style: CaptionStyle, role: CaptionRole): CaptionLayout {
  const lineTexts = wrapCaptionText(value, style).split('\n');
  const { fontSize, fontFamily, lineHeight } = captionTypography(style, role);
  const context = createCanvas(1, 1).getContext('2d');
  context.font = `${fontSize}px "${fontFamily}"`;
  const lines = lineTexts.map((text, index) => {
    const width = parseCaptionRuns(text).reduce((total, run) => total + runWidth(context, run, fontSize), 0);
    return {
      text,
      width,
      x: (CAPTION_WIDTH - width) / 2,
      y: CAPTION_HEIGHT / 2 + (index - (lineTexts.length - 1) / 2) * lineHeight,
    };
  });
  const bandHeight = Math.max(SNAPCHAT_LINE_HEIGHT, lines.length * SNAPCHAT_LINE_HEIGHT + SNAPCHAT_VERTICAL_PADDING);
  return {
    fontSize,
    lineHeight,
    lines,
    ...(style === 'SNAPCHAT'
      ? { band: { y: (CAPTION_HEIGHT - bandHeight) / 2, height: bandHeight } }
      : {}),
  };
}

async function loadEmoji(assetId: string) {
  const cached = emojiImageCache.get(assetId);
  if (cached) return cached;
  const pending = (async () => {
    const path = join(TWEMOJI_ASSET_DIRECTORY, `${assetId}.svg`);
    try {
      await access(path);
      return await loadImage(path);
    } catch {
      return null;
    }
  })();
  emojiImageCache.set(assetId, pending);
  return pending;
}

export async function rasterizeCaption(value: string, style: CaptionStyle, role: CaptionRole) {
  const canvas = createCanvas(CAPTION_WIDTH, CAPTION_HEIGHT);
  const context = canvas.getContext('2d');
  const layout = layoutCaption(value, style, role);
  const fontFamily = style === 'SNAPCHAT' ? 'ContentLane Sans' : 'ContentLane Sans Bold';
  context.font = `${layout.fontSize}px "${fontFamily}"`;
  context.textBaseline = 'middle';
  context.fillStyle = '#fff';

  if (layout.band) {
    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
    context.fillRect(0, layout.band.y, CAPTION_WIDTH, layout.band.height);
    context.fillStyle = '#fff';
  }

  for (const line of layout.lines) {
    let x = line.x;
    for (const run of parseCaptionRuns(line.text)) {
      const width = runWidth(context, run, layout.fontSize);
      if (run.kind === 'emoji' && run.assetId) {
        const image = await loadEmoji(run.assetId);
        if (image) {
          context.save();
          context.shadowColor = style === 'STANDARD' ? 'rgba(0, 0, 0, 0.92)' : 'transparent';
          context.shadowBlur = style === 'STANDARD' ? (role === 'HOOK' ? 10 : 8) : 0;
          context.shadowOffsetY = style === 'STANDARD' ? 2 : 0;
          context.drawImage(image, x, line.y - layout.fontSize / 2, layout.fontSize, layout.fontSize);
          context.restore();
          x += width;
          continue;
        }
      }

      if (style === 'STANDARD') {
        context.save();
        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.shadowOffsetY = 2;
        context.lineJoin = 'round';
        context.lineWidth = role === 'HOOK' ? 20 : 16;
        context.strokeStyle = 'rgba(0, 0, 0, 0.92)';
        context.strokeText(run.text, x, line.y);
        context.fillText(run.text, x, line.y);
        context.restore();
      } else {
        context.fillText(run.text, x, line.y);
      }
      x += width;
    }
  }

  return canvas.encode('png');
}

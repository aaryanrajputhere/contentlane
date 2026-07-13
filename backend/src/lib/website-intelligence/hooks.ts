import { z } from 'zod';
import type { BrandProfile } from '../../domain/schemas';
import { hasLLMConfig, callLLM, type LLMPrompt } from './llm';
import type { ConceptBlueprint } from '../workflow';
import { config } from '../../config';

// Minimal overlay schema. Older LLM responses may include spoken_hook; zod ignores it.
const llmHookSchema = z.object({
  hook_overlay_text: z.coerce.string().min(1),
  demo_vid_overlay_text: z.coerce.string().min(1),
  hook_clip_ugc_tags: z.union([
    z.array(z.string()),
    z.string().transform((s) => s.split(',').map((t) => t.trim()).filter(Boolean)),
  ]),
});

function scoreToLabel(score: number): string {
  if (score >= 94) return 'Top rank';
  if (score >= 90) return 'High rank';
  if (score >= 86) return 'Strong rank';
  return 'Solid rank';
}

function clampScore(index: number): number {
  return Math.max(82, 97 - index * 2);
}

function buildHooksPrompt(profile: BrandProfile, count: number): LLMPrompt {
  const momentsList = profile.campaignStrategy && profile.campaignStrategy.length > 0 
    ? `\n\nCustomer Moments (use these specific situations as the foundation for your hooks):\n- ${profile.campaignStrategy.map(b => b.moment).join('\n- ')}`
    : '';

  return {
    system: `You are a viral short-form content strategist.

Your job is to create hooks that feel like they belong on TikTok, Instagram Reels, or YouTube Shorts.

These are NOT advertisements.

The goal is to make someone stop scrolling.

A good hook should create immediate curiosity, surprise, tension, or relatability within the first 2-3 seconds.

The overlay text should sound like creator captions typed directly onto a TikTok/Reels video, not a polished campaign line.

Use proven viral hook patterns such as:
- "how to actually use {app name} without overthinking it"
- "they kept this {category} SECRET from us 💀"
- "i didn't know {app name} could actually fix this in minutes"
- "3 years into {problem} and NOW i find this"
- "why is nobody talking about this??"
- "i wasted so much time doing this manually"
- "this feels like cheating..."
- "i wish i found this sooner"

Overlay text should:
- Be under 12 words.
- Be highly scroll-stopping.
- Use curiosity, surprise, contradiction or regret.
- Feel like a real creator's thumbnail, not marketing copy.
- Be mostly lowercase.
- Allow one emphasized uppercase word.
- Allow "...", "??", and occasional emojis like 💀, 😭, 🤯.
- Mix short direct hooks, curiosity hooks, and longer conversational hooks.
- Use the actual brand/app name from Brand or Product when naming the product. Never copy placeholder names from examples.

Avoid:
- Generic feature descriptions.
- Marketing buzzwords.
- Corporate language.
- Obvious CTAs in the hook.
- Title case.
- Quotation marks.
- Polished slogans.
- Complete corporate sentences.

SELF REVIEW

Before finalizing each hook silently check:

- Would this make someone stop scrolling?
- Does it sound like a creator rather than a brand?
- Is there genuine curiosity?
- Would this fit naturally on TikTok?

Output ONLY valid JSON.`,
    user: `Brand: ${profile.brandName}
Product: ${profile.product}
Audience Identity: ${profile.audienceIdentity} (${profile.audienceStage})
Transformation: ${profile.transformation}
Fears & Real Thoughts: ${profile.fears.slice(0, 2).concat(profile.realThoughts.slice(0, 2)).join(', ')}
Objections: ${profile.objections.slice(0, 2).join(', ')}${momentsList}

Generate EXACTLY ${count} distinct hook concepts. 
Each concept must use a different creative angle or moment.

Output FORMAT: A single JSON object with a "hooks" array containing exactly ${count} objects.
Each object must have exactly these 3 fields:
- hook_overlay_text: punchy scroll-stopping text shown on screen, under 12 words
- demo_vid_overlay_text: text shown over the brand demo clip later in the video, under 8 words
- hook_clip_ugc_tags: 2-4 emotion/action tags for the UGC creator clip (e.g. excited, sad, looking at phone, shocked, confident, thinking, pointing, laughing, nodding)

Example structure:
{
  "hooks": [
    {
      "hook_overlay_text": "i was off by 600 calories 💀",
      "demo_vid_overlay_text": "no more guessing",
      "hook_clip_ugc_tags": ["shocked", "looking at phone", "disappointed"]
    }
  ]
}

Output ONLY the JSON object:`,
  };
}

// Normalize field names from LLM (handles camelCase, snake_case, short names)
function normalizeHookItem(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  return {
    hook_overlay_text: r.hook_overlay_text ?? r.hookOverlayText ?? r.hookText ?? r.hook_text ?? r.hook ?? r.text ?? '',
    demo_vid_overlay_text: r.demo_vid_overlay_text ?? r.demoVidOverlayText ?? r.demoOverlayText ?? r.demo_overlay_text ?? r.overlay ?? '',
    hook_clip_ugc_tags: r.hook_clip_ugc_tags ?? r.hookClipUgcTags ?? r.ugc_tags ?? r.tags ?? r.clip_tags ?? [],
  };
}

/**
 * Extract complete JSON objects from a potentially truncated JSON array string.
 */
export function extractCompleteObjects(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const wrapped = record.hooks ?? record.concepts ?? record.items ?? record.data ?? record.results;
      if (Array.isArray(wrapped)) return wrapped;
      return [parsed];
    }
    return [];
  } catch {
    // JSON is truncated — salvage complete objects via brace matching
  }

  const results: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let j = i;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        if (ch === '}') { depth--; if (depth === 0) break; }
      }
      if (depth === 0 && j < text.length) {
        const slice = text.slice(i, j + 1);
        try { results.push(JSON.parse(slice)); } catch { /* skip */ }
        i = j + 1;
      } else {
        break;
      }
    } else {
      i++;
    }
  }
  return results;
}

export function parseLLMHookItems(rawItems: unknown[]): Array<z.infer<typeof llmHookSchema>> {
  const normalizedItems = rawItems.map(normalizeHookItem);
  return z.array(llmHookSchema).min(1).parse(normalizedItems);
}

/**
 * Convert the LLM's minimal hook output into a full ConceptBlueprint
 * by filling deterministic fields from the brand profile.
 */
function toConceptBlueprint(
  hook: z.infer<typeof llmHookSchema>,
  profile: BrandProfile,
  index: number,
): ConceptBlueprint {
  const angle = profile.conversationStarters[index % profile.conversationStarters.length] ?? `Angle ${index + 1}`;
  const painPoint = profile.realThoughts[index % profile.realThoughts.length] ?? 'the main problem';
  const benefit = profile.proofPoints[index % profile.proofPoints.length] ?? 'the key benefit';
  const score = clampScore(index);
  const ugcTags = hook.hook_clip_ugc_tags;

  return {
    angle,
    hookText: hook.hook_overlay_text,
    hookImagePrompt: [
      `Create a cinematic vertical 9:16 marketing image for ${profile.brandName}.`,
      `The image should support the hook: "${hook.hook_overlay_text}".`,
      `Visual direction: ${angle}. Show the benefit: ${benefit}.`,
      `Reference the pain point: ${painPoint}.`,
      `No watermark, no mock social UI.`,
    ].join(' '),
    demoOverlayText: hook.demo_vid_overlay_text,
    videoDirection: ugcTags.join(', '),
    targetDurationLabel: '4-5s',
    targetDurationSeconds: 5,
    score,
    scoreLabel: scoreToLabel(score),
    rationale: `Angle: ${angle}. Benefit: ${benefit}. UGC creator clip tags: ${ugcTags.join(', ')}.`,
    generatedImageUrl: null,
    generatedVideoUrl: null,
    sortOrder: index,
  };
}

export async function generateHooksFromLLM(
  profile: BrandProfile,
  count: number,
): Promise<ConceptBlueprint[] | null> {
  console.log(`[hooks] start brand="${profile.brandName}" count=${count}`);

  if (!hasLLMConfig()) {
    console.log('[hooks] no LLM config, returning null');
    return null;
  }

  try {
    const prompt = buildHooksPrompt(profile, count);
    const raw = await callLLM(prompt, { model: config.OPENAI_HOOK_MODEL, temperature: 0.8, maxTokens: 2200, responseFormat: 'json_object' });
    if (!raw) {
      console.log('[hooks] LLM returned null');
      return null;
    }

    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    console.log('[hooks] AI JSON response:\n', text);
    const rawItems = extractCompleteObjects(text);
    if (rawItems.length === 0) {
      console.warn('[hooks] no complete JSON objects found');
      return null;
    }

    const validated = parseLLMHookItems(rawItems);
    const concepts = validated.slice(0, count).map((item, index) =>
      toConceptBlueprint(item, profile, index),
    );

    console.log(`[hooks] done concepts=${concepts.length}`);
    return concepts;
  } catch (error) {
    console.error('[hooks] failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

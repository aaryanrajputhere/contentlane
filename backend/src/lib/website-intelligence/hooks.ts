import { z } from 'zod';
import type { BrandProfile } from '../../domain/schemas';
import { hasLLMConfig, callLLM, type LLMPrompt } from './llm';
import type { ConceptBlueprint } from '../workflow';

// Minimal schema — only the 3 fields the LLM needs to generate
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
  return {
    system: `You are a senior UGC ad creative strategist.

Your job is to create viral short-form video concepts that stop scrolling and convert cold audiences.

Think like the top performing TikTok, Instagram Reels and Meta ads.

Every idea should:
- Start with a powerful hook within the first 3 seconds.
- Feel authentic, not corporate.
- Speak directly to one pain point.
- Build curiosity.
- Show the product naturally.
- End with a clear CTA.

Never sound like marketing copy.

Avoid:
- Generic buzzwords
- "Introducing..."
- "Revolutionary..."
- "Best platform"

Output ONLY valid JSON. Do not explain anything.`,
    user: `Brand: ${profile.brandName}
Tagline: ${profile.tagline}
Audience: ${profile.audience}
Pain points: ${profile.painPoints.slice(0, 3).join(', ')}
Benefits: ${profile.benefits.slice(0, 3).join(', ')}
Voice: ${profile.voice}

Generate EXACTLY ${count} distinct hook concepts. 
Each concept must use a different angle.

Output FORMAT: A single JSON array containing exactly ${count} objects.
Each object must have exactly these 3 fields:
- hook_overlay_text: punchy scroll-stopping hook text, under 12 words
- demo_vid_overlay_text: text shown over the brand demo clip, under 8 words
- hook_clip_ugc_tags: 2-4 emotion/action tags for the UGC creator clip (e.g. excited, sad, looking at phone, shocked, confident, thinking, pointing, laughing, nodding)

Example structure (you must return ${count} objects like this):
[
  {
    "hook_overlay_text": "Stop scrolling. ${profile.brandName} changes everything.",
    "demo_vid_overlay_text": "See the ${profile.brandName} difference",
    "hook_clip_ugc_tags": ["excited", "pointing at screen", "surprised"]
  },
  {
    "hook_overlay_text": "You've been doing it wrong.",
    "demo_vid_overlay_text": "The better way",
    "hook_clip_ugc_tags": ["shocked", "shaking head"]
  }
]

Output ONLY the JSON array starting with [ and ending with ]:`,
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
function extractCompleteObjects(text: string): unknown[] {
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

/**
 * Convert the LLM's minimal hook output into a full ConceptBlueprint
 * by filling deterministic fields from the brand profile.
 */
function toConceptBlueprint(
  hook: z.infer<typeof llmHookSchema>,
  profile: BrandProfile,
  index: number,
): ConceptBlueprint {
  const angle = profile.angles[index % profile.angles.length] ?? `Angle ${index + 1}`;
  const painPoint = profile.painPoints[index % profile.painPoints.length] ?? 'the main problem';
  const benefit = profile.benefits[index % profile.benefits.length] ?? 'the key benefit';
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
    rationale: `Uses ${angle.toLowerCase()} to highlight ${benefit.toLowerCase()}. UGC creator clip tags: ${ugcTags.join(', ')}.`,
    generatedImageUrl: null,
    generatedVideoUrl: null,
    sortOrder: index,
  };
}

export async function generateHooksFromLLM(
  profile: BrandProfile,
  count: number,
): Promise<ConceptBlueprint[] | null> {
  if (!hasLLMConfig()) return null;

  try {
    const prompt = buildHooksPrompt(profile, count);
    console.log('[hooks-generation] prompt user length:', prompt.user.length);

    const raw = await callLLM(prompt, { temperature: 0.8, maxTokens: 4000, responseFormat: 'text' });
    if (!raw) return null;

    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    console.log('[hooks-generation] full LLM raw output:\n', raw);

    const rawItems = extractCompleteObjects(text);
    if (rawItems.length === 0) {
      console.warn('[hooks-generation] no complete JSON objects found');
      return null;
    }

    console.log('[hooks-generation] extracted', rawItems.length, 'objects, first keys:', Object.keys(rawItems[0] as object ?? {}));

    const normalizedItems = rawItems.map(normalizeHookItem);
    const validated = z.array(llmHookSchema).min(1).parse(normalizedItems);

    console.log(`[hooks-generation] validated ${validated.length} hooks from LLM`);

    return validated.slice(0, count).map((item, index) =>
      toConceptBlueprint(item, profile, index),
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.warn('[hooks-generation] LLM hook generation failed, using fallback:', msg);
    return null;
  }
}

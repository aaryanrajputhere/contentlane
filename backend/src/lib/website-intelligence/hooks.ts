import { z } from "zod";
import type { BrandProfile } from "../../domain/schemas";
import { hasLLMConfig, callLLM, type LLMPrompt } from "./llm";
import type { ConceptBlueprint } from "../workflow";
import { config } from "../../config";
import type { AnalysisJsonRecorder } from "../analysis-json";
import { errorJson } from "../analysis-json";

// Minimal overlay schema. Older LLM responses may include spoken_hook; zod ignores it.
const llmHookSchema = z.object({
  hook_overlay_text: z.coerce.string().min(1),
  demo_vid_overlay_text: z.coerce.string().min(1),
  hook_clip_ugc_tags: z.union([
    z.array(z.string()),
    z.string().transform((s) =>
      s
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]),
});

function scoreToLabel(score: number): string {
  if (score >= 94) return "Top rank";
  if (score >= 90) return "High rank";
  if (score >= 86) return "Strong rank";
  return "Solid rank";
}

function clampScore(index: number): number {
  return Math.max(82, 97 - index * 2);
}

const automaticStyleGuidance = [
  "Create an information gap that makes the viewer need the answer.",
  "Challenge a familiar assumption with a credible opposing take.",
  "Use a candid first-person admission that feels creator-native.",
];

export function buildHooksPrompt(
  profile: BrandProfile,
  count: number,
  previousConcepts: Array<
    Pick<ConceptBlueprint, "hookText" | "demoOverlayText">
  > = [],
  isDuplicateRetry = false,
): LLMPrompt {
  const guidance = [
    `Creative styles:\n- ${automaticStyleGuidance.join("\n- ")}`,
    profile.claimConstraints.length
      ? `Claim constraints:\n- ${profile.claimConstraints.join("\n- ")}`
      : "",
    previousConcepts.length
      ? `Previous concepts (do not repeat or lightly paraphrase either field):\n${previousConcepts.map((concept) => `- Hook: ${concept.hookText}\n  Demo: ${concept.demoOverlayText}`).join("\n")}`
      : "",
    isDuplicateRetry
      ? "Correction: The previous attempt reused existing copy. Replace every repeated line with a genuinely new angle and wording."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = {
    system: `You are a viral short-form content strategist.

Your job is to create hooks that feel like they belong on TikTok, Instagram Reels, or YouTube Shorts.

These are NOT advertisements.

The goal is to make someone stop scrolling.

A good hook should create immediate curiosity, surprise, tension, or relatability within the first 2-3 seconds.

The overlay text should sound like creator captions typed directly onto a TikTok/Reels video, not a polished campaign line.

Use proven viral hook patterns such as:
- How to actually use {app} without making it complicated
- Everyone uses {app} wrong… here's the easier way
- They really hid this {category} feature 💀
- I had NO idea {app} could solve this in 2 minutes
- 3 years of struggling with {problem}… and this was the fix?
- Why is literally nobody talking about this?
- I can't believe I was doing this manually
- This feels illegal… but it works 😭
- I wish someone showed me this sooner
- This one feature saved me hours
- You're overcomplicating {task}
- Stop doing {task} the hard way
- This tiny trick changes everything
- The easiest way to {desired outcome}
- The {app} feature everyone ignores
- I found the shortcut nobody mentions
- If you use {app}, watch this first
- This is the only {app} tutorial you actually need
- You can do THIS in {app}?!
- The fastest way to {outcome} without paying

Overlay text should:
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
Product summary: ${profile.productSummary}
Target audience: ${profile.targetAudience}
Customer problems: ${profile.customerProblems.join(" | ")}
Key benefits: ${profile.keyBenefits.join(" | ")}
Proof points: ${profile.proofPoints.join(" | ")}

${guidance}

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
      "demo_vid_overlay_text": "until i found this app that tracks it so efficiently",
      "hook_clip_ugc_tags": ["shocked", "looking at phone", "disappointed"]
    }
  ]
}

Output ONLY the JSON object:`,
  };

  return prompt;
}

export function normalizeCreativeLine(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function findRepeatedCreativeLines(
  concepts: Array<Pick<ConceptBlueprint, "hookText" | "demoOverlayText">>,
  previousConcepts: Array<
    Pick<ConceptBlueprint, "hookText" | "demoOverlayText">
  >,
): string[] {
  const previousLines = new Set(
    previousConcepts
      .flatMap((concept) => [concept.hookText, concept.demoOverlayText])
      .map(normalizeCreativeLine),
  );
  return concepts
    .flatMap((concept) => [concept.hookText, concept.demoOverlayText])
    .filter((line) => previousLines.has(normalizeCreativeLine(line)));
}

// Normalize field names from LLM (handles camelCase, snake_case, short names)
function normalizeHookItem(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  return {
    hook_overlay_text:
      r.hook_overlay_text ??
      r.hookOverlayText ??
      r.hookText ??
      r.hook_text ??
      r.hook ??
      r.text ??
      "",
    demo_vid_overlay_text:
      r.demo_vid_overlay_text ??
      r.demoVidOverlayText ??
      r.demoOverlayText ??
      r.demo_overlay_text ??
      r.overlay ??
      "",
    hook_clip_ugc_tags:
      r.hook_clip_ugc_tags ??
      r.hookClipUgcTags ??
      r.ugc_tags ??
      r.tags ??
      r.clip_tags ??
      [],
  };
}

/**
 * Extract complete JSON objects from a potentially truncated JSON array string.
 */
export function extractCompleteObjects(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const wrapped =
        record.hooks ??
        record.concepts ??
        record.items ??
        record.data ??
        record.results;
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
    if (text[i] === "{") {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let j = i;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth === 0 && j < text.length) {
        const slice = text.slice(i, j + 1);
        try {
          results.push(JSON.parse(slice));
        } catch {
          /* skip */
        }
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

export function parseLLMHookItems(
  rawItems: unknown[],
): Array<z.infer<typeof llmHookSchema>> {
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
  const angle =
    profile.customerProblems[index % profile.customerProblems.length] ??
    `Angle ${index + 1}`;
  const painPoint =
    profile.customerProblems[index % profile.customerProblems.length] ??
    "the main problem";
  const benefit =
    profile.keyBenefits[index % profile.keyBenefits.length] ??
    profile.proofPoints[index % profile.proofPoints.length] ??
    "the key benefit";
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
    ].join(" "),
    demoOverlayText: hook.demo_vid_overlay_text,
    videoDirection: ugcTags.join(", "),
    targetDurationLabel: "4-5s",
    targetDurationSeconds: 5,
    score,
    scoreLabel: scoreToLabel(score),
    rationale: `Angle: ${angle}. Benefit: ${benefit}. UGC creator clip tags: ${ugcTags.join(", ")}.`,
    generatedImageUrl: null,
    generatedVideoUrl: null,
    sortOrder: index,
  };
}

export async function generateHooksFromLLM(
  profile: BrandProfile,
  count: number,
  previousConcepts: Array<
    Pick<ConceptBlueprint, "hookText" | "demoOverlayText">
  > = [],
  recorder?: AnalysisJsonRecorder,
): Promise<ConceptBlueprint[]> {
  console.log(`[hooks] start brand="${profile.brandName}" count=${count}`);

  if (!hasLLMConfig()) {
    await recorder?.write(
      "hooks-prompt-attempt-1",
      buildHooksPrompt(profile, count, previousConcepts),
    );
    const error = new Error(
      "Hook generation is temporarily unavailable. No language model is configured.",
    );
    await recorder?.write("hooks-llm-error", errorJson(error));
    throw error;
  }

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt = buildHooksPrompt(
        profile,
        count,
        previousConcepts,
        attempt === 1,
      );
      const attemptNumber = attempt + 1;
      await recorder?.write(`hooks-prompt-attempt-${attemptNumber}`, prompt);
      const raw = await callLLM(prompt, {
        model: config.OPENAI_HOOK_MODEL,
        temperature: 0.8,
        maxTokens: 2200,
        responseFormat: "json_object",
        onRawResponse: async (response) => {
          await recorder?.write(
            `hooks-raw-provider-response-attempt-${attemptNumber}`,
            response,
          );
        },
      });
      await recorder?.write(`hooks-raw-response-attempt-${attemptNumber}`, {
        raw,
      });
      if (!raw) {
        console.log("[hooks] LLM returned null");
        throw new Error("The hook generator returned no response.");
      }

      const text = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      console.log("[hooks] AI JSON response:\n", text);
      try {
        JSON.parse(text);
      } catch {
        throw new Error(
          "The hook generator returned malformed or incomplete JSON.",
        );
      }
      const rawItems = extractCompleteObjects(text);
      if (rawItems.length === 0) {
        console.warn("[hooks] no complete JSON objects found");
        throw new Error("The hook generator returned malformed output.");
      }

      const validated = parseLLMHookItems(rawItems);
      if (validated.length !== count) {
        throw new Error(
          `The hook generator returned ${validated.length} valid hooks; ${count} were required.`,
        );
      }
      const concepts = validated.map((item, index) =>
        toConceptBlueprint(item, profile, index),
      );
      const repeatedLines = findRepeatedCreativeLines(
        concepts,
        previousConcepts,
      );
      if (repeatedLines.length === 0) {
        console.log(`[hooks] done concepts=${concepts.length}`);
        return concepts;
      }
      if (attempt === 0) {
        console.warn(
          `[hooks] retrying after ${repeatedLines.length} repeated creative lines`,
        );
        continue;
      }
      throw new Error(
        "The hook generator repeated existing copy after retrying.",
      );
    }
    throw new Error("Hook generation failed after retrying.");
  } catch (error) {
    console.error(
      "[hooks] failed:",
      error instanceof Error ? error.message : error,
    );
    await recorder?.write("hooks-llm-error", errorJson(error));
    throw error instanceof Error ? error : new Error("Hook generation failed.");
  }
}

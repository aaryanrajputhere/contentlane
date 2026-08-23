import { z } from "zod";
import type { BrandProfile } from "../../domain/schemas";
import { hasLLMConfig, callLLM, type LLMPrompt } from "./llm";
import type { ConceptBlueprint } from "../workflow";
import { config } from "../../config";
import type { AnalysisJsonRecorder } from "../analysis-json";
import { errorJson } from "../analysis-json";
import { containsOnlyLegacyDefaultHookPatterns } from "./hook-patterns";

type HookReference = Pick<ConceptBlueprint, "hookText" | "demoOverlayText"> & {
  angle?: string;
};

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

function formatHookReferences(references: HookReference[]): string {
  return references
    .map(
      (concept) =>
        `- Hook: ${concept.hookText}\n  Demo: ${concept.demoOverlayText}${concept.angle ? `\n  Angle: ${concept.angle}` : ""}`,
    )
    .join("\n");
}

export function buildHooksPrompt(
  profile: BrandProfile,
  count: number,
  previousConcepts: HookReference[] = [],
  rejectedConceptsOrRetry: HookReference[] | boolean = [],
  isDuplicateRetry = false,
  duplicateAvoidanceConcepts: HookReference[] = [],
  patterns: readonly string[] = [],
  language = 'English',
): LLMPrompt {
  const rejectedConcepts = Array.isArray(rejectedConceptsOrRetry)
    ? rejectedConceptsOrRetry
    : [];
  const duplicateRetry =
    typeof rejectedConceptsOrRetry === "boolean"
      ? rejectedConceptsOrRetry
      : isDuplicateRetry;
  const userPatterns = containsOnlyLegacyDefaultHookPatterns(patterns)
    ? []
    : patterns.slice(0, 8);

  const creativeContext = [
    `Writing moves to vary across the batch:\n- ${automaticStyleGuidance.join("\n- ")}`,
    userPatterns.length
      ? `User-provided good examples. Use their creative DNA, not their wording:\n${userPatterns.map((pattern) => `- ${pattern}`).join("\n")}`
      : "",
    previousConcepts.length
      ? `Liked hook references. Learn from their voice and specificity without copying them:\n${formatHookReferences(previousConcepts)}`
      : "",
    rejectedConcepts.length
      ? `Rejected references. Avoid their wording and creative approach:\n${formatHookReferences(rejectedConcepts)}`
      : "",
    duplicateAvoidanceConcepts.length
      ? `Previously generated hooks. These are only a do-not-repeat list:\n${duplicateAvoidanceConcepts.map((concept) => `- ${concept.hookText}`).join("\n")}`
      : "",
    duplicateRetry
      ? "The previous attempt repeated existing copy. Every hook in this attempt must use genuinely new wording and a new angle."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    system: `You write excellent overlay hooks for short-form videos.

Write all hook overlays and demo overlays in ${language}. Keep product and brand names unchanged when appropriate.

The hook is the priority. Write like a sharp creator with a real observation, opinion, confession, question, or discovery—not like a brand or ad agency.

A strong hook is specific to the supplied product and audience, understandable instantly, and creates curiosity, tension, surprise, or recognition. Keep it under 12 words. Avoid slogans, calls to action, buzzwords, generic hype, forced slang, and unsupported claims. Make every hook meaningfully different.

For each hook, also write a demo overlay under 8 words that naturally pays it off, plus 2-4 observable creator emotion/action tags (for example: skeptical, pointing, looking at screen). Tags must describe what the creator visibly does or feels, never a topic or audience label.

Output ONLY valid JSON in this shape:
{"hooks":[{"hook_overlay_text":"...","demo_vid_overlay_text":"...","hook_clip_ugc_tags":["..."]}]}

Return exactly the requested number of objects and no other fields or commentary.`,

    user: `Create exactly ${count} strong hooks that would go as overlay text on short videos about ${profile.brandName}.

Product: ${profile.productSummary}
Audience: ${profile.targetAudience}
Problems: ${profile.customerProblems.join(" | ")}
Benefits: ${profile.keyBenefits.join(" | ")}
Proof you may use: ${profile.proofPoints.length ? profile.proofPoints.join(" | ") : "None supplied"}
Claims to avoid: ${profile.claimConstraints.length ? profile.claimConstraints.join(" | ") : "Any claim not supported above"}

${creativeContext}

Choose the hook lines before filling in the supporting demo text and tags. Return only the final JSON object.`,
  };
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
  previousConcepts: HookReference[],
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

export function findRepeatedHookLines(
  concepts: Array<Pick<ConceptBlueprint, "hookText">>,
  previousConcepts: Array<Pick<ConceptBlueprint, "hookText">>,
): string[] {
  const previousHooks = new Set(previousConcepts.map((concept) => normalizeCreativeLine(concept.hookText)));
  return concepts
    .map((concept) => concept.hookText)
    .filter((hookText) => previousHooks.has(normalizeCreativeLine(hookText)));
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
    HookReference
  > = [],
  rejectedConcepts: HookReference[] = [],
  recorder?: AnalysisJsonRecorder,
  duplicateAvoidanceConcepts: HookReference[] = previousConcepts,
  patterns: readonly string[] = [],
  language = 'English',
): Promise<ConceptBlueprint[]> {
  console.log(`[hooks] start brand="${profile.brandName}" count=${count}`);

  if (!hasLLMConfig()) {
    await recorder?.write(
      "hooks-prompt-attempt-1",
      buildHooksPrompt(profile, count, previousConcepts, [], false, [], patterns, language),
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
        rejectedConcepts,
        attempt === 1,
        duplicateAvoidanceConcepts,
        patterns,
        language,
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
      const batchLines = concepts.map((concept) => concept.hookText);
      const seenBatchLines = new Set<string>();
      const repeatedBatchLines = batchLines.filter((line) => {
        const normalized = normalizeCreativeLine(line);
        if (seenBatchLines.has(normalized)) return true;
        seenBatchLines.add(normalized);
        return false;
      });
      const repeatedLines = findRepeatedHookLines(
        concepts,
        duplicateAvoidanceConcepts,
      );
      if (repeatedLines.length === 0 && repeatedBatchLines.length === 0) {
        console.log(`[hooks] done concepts=${concepts.length}`);
        return concepts;
      }
      if (attempt === 0) {
        console.warn(
          `[hooks] retrying after ${repeatedLines.length + repeatedBatchLines.length} repeated creative lines`,
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

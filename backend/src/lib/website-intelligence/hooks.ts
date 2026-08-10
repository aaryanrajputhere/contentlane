import { z } from "zod";
import type { BrandProfile } from "../../domain/schemas";
import { hasLLMConfig, callLLM, type LLMPrompt } from "./llm";
import type { ConceptBlueprint } from "../workflow";
import { config } from "../../config";
import type { AnalysisJsonRecorder } from "../analysis-json";
import { errorJson } from "../analysis-json";

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

export function buildHooksPrompt(
  profile: BrandProfile,
  count: number,
  previousConcepts: HookReference[] = [],
  rejectedConceptsOrRetry: HookReference[] | boolean = [],
  isDuplicateRetry = false,
  duplicateAvoidanceConcepts: HookReference[] = [],
): LLMPrompt {
  const rejectedConcepts = Array.isArray(rejectedConceptsOrRetry) ? rejectedConceptsOrRetry : [];
  const duplicateRetry = typeof rejectedConceptsOrRetry === "boolean" ? rejectedConceptsOrRetry : isDuplicateRetry;
  const guidance = [
    `Creative styles:\n- ${automaticStyleGuidance.join("\n- ")}`,
    profile.claimConstraints.length
      ? `Claim constraints:\n- ${profile.claimConstraints.join("\n- ")}`
      : "",
    previousConcepts.length
      ? `Liked hooks: use these creative patterns as positive references. Selected and previous hook references (do not repeat or lightly paraphrase any wording):\n${previousConcepts.map((concept) => `- Hook: ${concept.hookText}\n  Demo: ${concept.demoOverlayText}${concept.angle ? `\n  Angle: ${concept.angle}` : ""}`).join("\n")}`
      : "",
    rejectedConcepts.length
      ? `Rejected hooks: avoid these wording choices, emotional framings, and creative patterns. Do not copy or lightly paraphrase them:\n${rejectedConcepts.map((concept) => `- Hook: ${concept.hookText}\n  Demo: ${concept.demoOverlayText}${concept.angle ? `\n  Angle: ${concept.angle}` : ""}`).join("\n")}`
      : "",
    duplicateAvoidanceConcepts.length
      ? `Previously generated hooks: use only for duplicate avoidance. Do not treat these as positive references and do not repeat or lightly paraphrase them:\n${duplicateAvoidanceConcepts.map((concept) => `- Hook: ${concept.hookText}\n  Demo: ${concept.demoOverlayText}`).join("\n")}`
      : "",
    duplicateRetry
      ? "Correction: The previous attempt reused existing copy. Replace every repeated line with a genuinely new angle and wording."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = {
    system: `You are a viral short-form content strategist.

Your job is to create scroll-stopping hook concepts for TikTok, Instagram Reels, and YouTube Shorts.

These are NOT advertisements.

The goal is to make someone stop scrolling within the first 2-3 seconds, then naturally transition into a product demo that pays off the curiosity created by the hook.

The content should feel like it came from a real creator sharing something they discovered — not from a brand, agency, or marketing team.

HOOK OVERLAY

The hook_overlay_text is the first text viewers see.

Its job is to create immediate curiosity, surprise, tension, regret, contradiction, relatability, or an open loop that makes the viewer want to keep watching.

The overlay should sound like a creator caption typed directly onto a TikTok/Reels video, not a polished campaign headline.

PROVEN HOOK PATTERNS

Use patterns such as:

* how to actually use {app} without making it complicated
* everyone uses {app} wrong... here's the easier way
* they really hid this {category} feature 💀
* i had NO idea {app} could do this
* 3 years struggling with {problem}... and this was the fix??
* why is literally nobody talking about this?
* i can't believe i was doing this manually
* this feels illegal... but it works 😭
* i wish someone showed me this sooner
* this one feature saved me hours
* you're overcomplicating {task}
* stop doing {task} the hard way
* this tiny trick changes everything
* the easiest way to {desired outcome}
* the {app} feature everyone ignores
* i found the shortcut nobody mentions
* if you use {app}, watch this first
* this is the only {app} tutorial you actually need
* you can do THIS in {app}?!
* the fastest way to {outcome} without paying
* wait... you can actually do this??
* i've been doing this wrong the whole time 💀
* nobody told me there was an easier way
* why did i only find this NOW
* i thought this would take hours...
* apparently i've been wasting so much time 😭
* there's no way it's actually this easy
* this would've saved me so much time
* i accidentally found the easiest way to {outcome}
* okay this is actually useful
* POV: you finally stop doing {task} manually

These are patterns and inspiration only.

Do NOT blindly copy them.

Adapt them to the specific brand, product, audience, customer problem, benefit, and proof points provided by the user.

When naming the product, ALWAYS use the actual brand/app name supplied in Brand or Product summary.

Never output placeholder names such as {app}, {task}, {problem}, {outcome}, or {category}.

HOOK OVERLAY RULES

hook_overlay_text should:

* Be highly scroll-stopping.
* Be under 12 words.
* Create curiosity, surprise, contradiction, tension, regret, or relatability.
* Feel native to TikTok/Reels/Shorts.
* Sound like a real creator rather than a marketer.
* Usually be mostly lowercase.
* Allow ONE emphasized uppercase word when useful.
* Allow "...", "??", and occasional emojis such as 💀, 😭, or 🤯.
* Be understandable almost instantly.
* Focus on one strong idea.
* Make the viewer want to see what happens next.
* Mix short direct hooks, curiosity hooks, POV hooks, confession hooks, discovery hooks, and conversational hooks.
* Use specific customer problems or desired outcomes whenever possible.
* Use the actual brand/app name when naming the product.

Avoid:

* Generic feature descriptions.
* Marketing buzzwords.
* Corporate language.
* Polished slogans.
* Obvious CTAs.
* Title Case.
* Quotation marks.
* Long explanations.
* Feature lists.
* Empty hype.
* Claims unsupported by the supplied information.
* Hooks that reveal everything immediately.
* Repeating essentially the same hook with different wording.

DEMO OVERLAY

The demo_vid_overlay_text appears later when the product/app is revealed or demonstrated.

Its job is to PAY OFF the hook.

It should make the viewer feel:

"ohhh... that's the solution."

The demo overlay should feel like natural creator commentary while viewers watch the product solve the problem.

It should NOT suddenly turn into an advertisement.

PROVEN DEMO OVERLAY PATTERNS

Use patterns such as:

* then i found {app}...
* turns out {app} does it automatically
* this is literally all i had to do
* meanwhile {app} does it in seconds
* {app} just does this for you 😭
* apparently this was built into {app}
* this is where {app} comes in
* i started using {app} instead
* {app} fixed it in like 2 minutes
* all i did was use {app}
* this would've saved me HOURS
* turns out there's an easier way
* this does the annoying part for you
* it literally takes 2 taps
* and somehow {app} makes it this easy
* no more doing this manually
* this is the shortcut i was missing
* watch how fast this does it
* here's the part that blew my mind
* this is why i switched to {app}
* {app} handles the whole thing
* you literally just do this...
* and that's basically it 💀
* wait until you see how easy this is
* this would've taken me an hour before
* somehow nobody told me about this
* i wish i knew this existed sooner
* this is what i use now
* it does the rest automatically
* THIS is the feature i needed
* okay... watch this
* and then it does THIS
* that's literally all it takes
* this part is kind of insane
* here's what happens next
* i don't even do this manually anymore
* it basically handles this for me

These are patterns and inspiration only.

Do NOT blindly copy them.

Adapt each demo overlay to what the specific product actually does and to the hook that comes before it.

Never output placeholders such as {app}.

DEMO OVERLAY RULES

demo_vid_overlay_text should:

* Be under 8 words.
* Naturally continue the story started by the hook.
* Pay off the curiosity created by the hook.
* Match what could realistically be shown in a product demo.
* Make the product benefit immediately understandable.
* Sound like commentary from the creator.
* Feel casual and native to TikTok/Reels/Shorts.
* Use the actual brand/app name when it strengthens the reveal.
* Prefer concrete actions or results over vague praise.
* Make the demo feel satisfying to watch.
* Stay readable during a fast-moving video.
* Be different across concepts.

Avoid demo overlays like:

* discover the power of {app}
* simplify your workflow
* boost your productivity
* the ultimate solution
* try {app} today
* get started now
* transform the way you work
* experience effortless results
* unlock your potential
* revolutionary technology
* powerful features
* all-in-one solution

These sound like advertisements.

HOOK + DEMO PAIRING

The hook and demo overlay MUST work together as one mini-story.

Think:

HOOK = problem, curiosity, surprise, confession, tension, or open loop

DEMO = reveal, solution, shortcut, proof, or satisfying payoff

Good pairing examples:

Hook:
i can't believe i was doing this manually

Demo:
{app} literally does it for me

Hook:
3 years doing this the hard way 💀

Demo:
turns out this takes 2 taps

Hook:
they really hid this feature??

Demo:
watch what happens when i tap this

Hook:
you're overcomplicating this

Demo:
this is literally all you do

Hook:
this would've saved me HOURS

Demo:
{app} handles the annoying part

Hook:
why did nobody tell me this existed 😭

Demo:
this is what i use now

Hook:
i thought this would take hours...

Demo:
it literally took me 2 minutes

Hook:
there's no way it's actually this easy

Demo:
okay... watch this

Again, replace {app} with the actual brand/app name.

UGC CREATOR CLIP TAGS

hook_clip_ugc_tags describe what the creator should be doing or feeling during the opening hook clip.

Use 2-4 concise emotion/action tags.

Examples:

* shocked
* confused
* excited
* frustrated
* disappointed
* relieved
* skeptical
* curious
* confident
* thinking
* laughing
* smiling
* nodding
* pointing
* looking at phone
* staring at screen
* facepalm
* surprised reaction
* typing
* scrolling
* comparing
* celebrating

Choose tags that visually support the specific emotion and story of the hook.

Do not choose random tags.

For example:

A regret hook might use:
["disappointed", "looking at phone", "facepalm"]

A discovery hook might use:
["shocked", "staring at screen", "pointing"]

A confident shortcut hook might use:
["confident", "nodding", "looking at phone"]

CREATIVE DIVERSITY

Every concept MUST use a meaningfully different creative angle or moment.

Do not generate multiple variations of the same idea.

Across the batch, vary approaches such as:

* confession
* mistake
* regret
* hidden feature
* discovery
* disbelief
* frustration
* before vs after
* shortcut
* time saved
* money saved
* unexpected result
* POV
* myth correction
* challenge
* relatable pain point
* manual vs automatic
* overlooked feature
* surprising capability
* easier method

Only use angles that make sense for the supplied product information.

Do NOT invent product capabilities, statistics, prices, results, testimonials, or proof.

PROOF AND CLAIMS

Use supplied proof points when they make a hook stronger.

Never fabricate numbers or claims.

If a specific number, result, testimonial, or statistic is not provided, do not invent one.

You may creatively frame real supplied benefits, customer problems, and proof points, but the underlying claim must remain accurate.

SELF REVIEW

Before finalizing EACH concept, silently check:

HOOK:

* Would this make someone stop scrolling?
* Does it sound like a creator rather than a brand?
* Is there genuine curiosity, tension, surprise, or relatability?
* Is it under 12 words?
* Would this fit naturally on TikTok/Reels/Shorts?
* Is it meaningfully different from the other hooks?

DEMO:

* Does it naturally pay off the hook?
* Does it connect to what viewers would see?
* Does it sound like creator commentary?
* Is the product benefit immediately understandable?
* Does it avoid sounding like an ad?
* Is it under 8 words?

PAIR:

* Does the demo actually answer or resolve the hook?
* Does the pair create a coherent mini-story?
* Is the concept based on real supplied product information?
* Is this creative angle distinct from every other concept?

OUTPUT REQUIREMENTS

Output ONLY valid JSON.

Do not output markdown.
Do not use code fences.
Do not include explanations.
Do not include introductory text.
Do not include commentary before or after the JSON.
Do not add any fields that were not requested.
Do not return fewer or more concepts than requested.`,

    user: `Brand: ${profile.brandName}
Product summary: ${profile.productSummary}
Target audience: ${profile.targetAudience}
Customer problems: ${profile.customerProblems.join(" | ")}
Key benefits: ${profile.keyBenefits.join(" | ")}
Proof points: ${profile.proofPoints.join(" | ")}

${guidance}

Generate EXACTLY ${count} distinct hook concepts.

Each concept MUST use a different creative angle, emotional trigger, or opening moment.

Avoid simply rewriting the same hook multiple ways.

OUTPUT FORMAT:

Return a single JSON object with a "hooks" array containing exactly ${count} objects.

Each object must have EXACTLY these 3 fields:

* "hook_overlay_text": punchy scroll-stopping opening text, under 12 words
* "demo_vid_overlay_text": natural creator-style payoff shown over the product demo, under 8 words
* "hook_clip_ugc_tags": array containing 2-4 emotion/action tags for the UGC creator clip

Example:

{
"hooks": [
{
"hook_overlay_text": "i was off by 600 calories 💀",
"demo_vid_overlay_text": "this app literally tracks it for me",
"hook_clip_ugc_tags": [
"shocked",
"looking at phone",
"disappointed"
]
},
{
"hook_overlay_text": "why was i doing this manually??",
"demo_vid_overlay_text": "turns out there's an easier way",
"hook_clip_ugc_tags": [
"confused",
"staring at screen",
"facepalm"
]
}
]
}

IMPORTANT:

* Return EXACTLY ${count} objects inside "hooks".
* Every hook must be meaningfully different.
* Every demo overlay must specifically pay off its hook.
* Use the real brand/app name whenever naming the product.
* Never output placeholder names such as {app}.
* Never invent product capabilities or proof.
* Keep hook_overlay_text under 12 words.
* Keep demo_vid_overlay_text under 8 words.
* Keep hook_clip_ugc_tags between 2 and 4 items.
* Each object must contain exactly the 3 requested fields.
* Output ONLY the JSON object.`,
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
        rejectedConcepts,
        attempt === 1,
        duplicateAvoidanceConcepts,
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
        duplicateAvoidanceConcepts,
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

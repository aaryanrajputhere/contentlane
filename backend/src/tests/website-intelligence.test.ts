import assert from "node:assert/strict";
import test from "node:test";
import { parseCreativeIntelligenceJson } from "../lib/website-intelligence/synthesis";
import { extractCompleteObjects, parseLLMHookItems } from "../lib/website-intelligence/hooks";
import { buildConceptCards } from "../lib/workflow";
import type { BrandProfile } from "../domain/schemas";

const baseProfile = {
  brandName: "ContentLane",
  product: "URL-to-video creative tool",
  audience: "Growth teams",
  audienceIdentity: "Busy marketers",
  audienceStage: "Problem aware",
  emotionalDrivers: ["Speed"],
  fears: ["Wasting ad spend"],
  realThoughts: ["I need better hooks"],
  dailyMoments: ["Opening a blank editor"],
  dreamOutcomes: ["Launch faster"],
  misconceptions: ["AI ads look fake"],
  objections: ["Quality concerns"],
  proofPoints: ["Creates hooks quickly"],
  socialProofMoments: ["Seeing the first usable draft"],
  transformation: "From blank page to ready creative",
  uniqueMechanism: "Website evidence becomes creative direction",
  conversationStarters: ["I used to hate making ads"],
  viralTriggers: ["Regret"],
  emotionalLanguage: ["Finally"],
  forbiddenClaims: ["Guaranteed ROAS"],
  ugcScenarios: ["Creator at desk"],
  testimonials: ["Saved us hours"],
  cta: "Start now",
  summary: "Turns a website into creative direction.",
};

test("creative intelligence parser accepts valid merged output", () => {
  const parsed = parseCreativeIntelligenceJson(JSON.stringify({
    ...baseProfile,
    campaignStrategy: [{
      pattern: "Confession",
      moment: "I am staring at a blank timeline again.",
      viewerEmotion: "Relief",
      creatorEmotion: "Frustration",
      payoff: "Now the first draft is ready in minutes.",
      location: "Desk",
      creatorAction: "Looks at laptop, exhales, clicks generate.",
      avoid: ["unlock", "revolutionary"],
    }],
  }));

  assert.equal(parsed.brandName, "ContentLane");
  assert.equal(parsed.campaignStrategy?.length, 1);
  assert.match(parsed.campaignStrategy?.[0]?.id ?? "", /^[0-9a-f-]{36}$/i);
});

test("creative intelligence parser rejects missing and malformed JSON", () => {
  assert.throws(() => parseCreativeIntelligenceJson(JSON.stringify(baseProfile)));
  assert.throws(() => parseCreativeIntelligenceJson("{not-json"));
});

test("hook parser extracts wrapped arrays and salvages truncated objects", () => {
  assert.equal(extractCompleteObjects(JSON.stringify({ hooks: [{ a: 1 }, { a: 2 }] })).length, 2);
  assert.deepEqual(
    extractCompleteObjects('[{"a":1},{"a":2},{"a":').map((item) => (item as { a: number }).a),
    [1, 2],
  );
});


test("hook parser accepts minimal hook output without spoken_hook", () => {
  const parsed = parseLLMHookItems([{
    hook_overlay_text: "how to actually use ContentLane without overthinking it",
    demo_vid_overlay_text: "site to ad, fast",
    hook_clip_ugc_tags: ["thinking", "pointing"],
  }]);

  const first = parsed[0];
  assert.ok(first);
  assert.equal(first.hook_overlay_text, "how to actually use ContentLane without overthinking it");
  assert.equal(first.demo_vid_overlay_text, "site to ad, fast");
});

test("hook parser ignores legacy spoken_hook output", () => {
  const parsed = parseLLMHookItems([{
    spoken_hook: "I used to say this out loud.",
    hook_overlay_text: "i wish i found ContentLane sooner",
    demo_vid_overlay_text: "hooks in minutes",
    hook_clip_ugc_tags: "relieved, looking at laptop",
  }]);

  const first = parsed[0];
  assert.ok(first);
  assert.equal("spoken_hook" in first, false);
  assert.deepEqual(first.hook_clip_ugc_tags, ["relieved", "looking at laptop"]);
});

const persistedProfile: BrandProfile = {
  ...baseProfile,
  id: "cm00000000000000000000000",
  projectId: "cm00000000000000000000001",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

test("fallback hooks use actual profile names and creator-native casing", () => {
  const concepts = buildConceptCards(persistedProfile, 8);
  const hooks = concepts.map((concept) => concept.hookText);

  assert.equal(hooks.some((hook) => hook.includes("ContentLane")), true);
  assert.equal(hooks.some((hook) => hook.includes(baseProfile.product.toLowerCase())), true);
  assert.equal(hooks.some((hook) => hook.includes("SECRET") || hook.includes("...") || hook.includes("??")), true);
  assert.equal(hooks.some((hook) => hook.startsWith("how to ") || hook.startsWith("i ")), true);
  assert.equal(hooks.every((hook) => !/\{app name\}|\{category\}|Notion|Acme|Example/i.test(hook)), true);
});

test("fallback rationale no longer includes spoken copy", () => {
  const [concept] = buildConceptCards(persistedProfile, 1);

  assert.ok(concept);
  assert.equal(concept.rationale.includes("Spoken:"), false);
  assert.match(concept.rationale, /Angle: .* Benefit: /);
});

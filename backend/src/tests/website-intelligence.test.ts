import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSynthesisPrompt,
  parseCreativeIntelligenceJson,
} from "../lib/website-intelligence/synthesis";
import {
  buildHooksPrompt,
  extractCompleteObjects,
  findRepeatedCreativeLines,
  normalizeCreativeLine,
  parseLLMHookItems,
} from "../lib/website-intelligence/hooks";
import { buildConceptCards } from "../lib/workflow";
import {
  buildSelectedTextSnippet,
  HOMEPAGE_EVIDENCE_MAX_CHARS,
} from "../lib/website-intelligence/utils";
import type { BrandProfile } from "../domain/schemas";

const baseProfile = {
  brandName: "ContentLane",
  productSummary: "URL-to-video creative tool",
  targetAudience: "Busy growth marketers",
  customerProblems: ["Wasting ad spend", "I need better hooks", "Quality concerns"],
  keyBenefits: ["Launch creative faster"],
  proofPoints: ["Creates hooks quickly"],
  claimConstraints: ["Guaranteed ROAS"],
};

test("creative intelligence parser accepts exactly the lean brand context", () => {
  const parsed = parseCreativeIntelligenceJson(JSON.stringify(baseProfile));

  assert.equal(parsed.brandName, "ContentLane");
  assert.deepEqual(Object.keys(parsed).sort(), Object.keys(baseProfile).sort());
});

test("creative intelligence parser rejects missing and malformed JSON", () => {
  const { targetAudience: _targetAudience, ...incomplete } = baseProfile;
  assert.throws(() => parseCreativeIntelligenceJson(JSON.stringify(incomplete)));
  assert.throws(() => parseCreativeIntelligenceJson("{not-json"));
});

test("creative intelligence parser permits evidence-limited arrays and rejects excessive output", () => {
  const evidenceLimited = {
    ...baseProfile,
    customerProblems: ["One supported problem"],
    keyBenefits: ["One supported benefit"],
    proofPoints: [],
    claimConstraints: [],
  };
  assert.deepEqual(
    parseCreativeIntelligenceJson(JSON.stringify(evidenceLimited)),
    evidenceLimited,
  );

  assert.throws(() => parseCreativeIntelligenceJson(JSON.stringify({
    ...baseProfile,
    customerProblems: Array.from({ length: 6 }, (_, index) => `Problem ${index + 1}`),
  })));
  assert.throws(() => parseCreativeIntelligenceJson(JSON.stringify({
    ...baseProfile,
    keyBenefits: Array.from({ length: 6 }, (_, index) => `Benefit ${index + 1}`),
  })));
  assert.throws(() => parseCreativeIntelligenceJson(JSON.stringify({
    ...baseProfile,
    proofPoints: Array.from({ length: 6 }, (_, index) => `Proof ${index + 1}`),
  })));
  assert.throws(() => parseCreativeIntelligenceJson(JSON.stringify({
    ...baseProfile,
    claimConstraints: Array.from({ length: 5 }, (_, index) => `Constraint ${index + 1}`),
  })));
});

test("brand synthesis uses one expanded evidence block and requests useful array depth", () => {
  const laterEvidence = "Later proof: customers can publish without paying until launch.";
  const extractedText = `${"Homepage detail. ".repeat(120)}${laterEvidence}`;
  const prompt = buildSynthesisPrompt({
    sourceUrl: "https://example.com",
    rootDomain: "example.com",
    homepage: {
      url: "https://example.com",
      title: "Example",
      metaDescription: "Example description",
      visibleTextSnippet: "Short duplicate preview",
      extractedTextSnippet: extractedText,
    },
  });
  const payload = JSON.parse(prompt.user) as {
    homepage: Record<string, unknown> & { contentEvidence: string };
    fieldGuidance: Record<string, string>;
    responseShape: Record<string, unknown[]>;
  };

  assert.match(payload.homepage.contentEvidence, /Later proof/);
  assert.equal("visibleTextSnippet" in payload.homepage, false);
  assert.equal("extractedTextSnippet" in payload.homepage, false);
  assert.match(prompt.system, /atomic, distinct, and non-overlapping/i);
  assert.match(payload.fieldGuidance.customerProblems, /3-5/);
  assert.match(payload.fieldGuidance.keyBenefits, /3-5/);
  assert.match(payload.fieldGuidance.proofPoints, /2-5/);
  assert.match(payload.fieldGuidance.claimConstraints, /2-4/);
  assert.equal(payload.responseShape.customerProblems.length, 3);
  assert.equal(payload.responseShape.keyBenefits.length, 3);
  assert.equal(payload.responseShape.proofPoints.length, 2);
  assert.equal(payload.responseShape.claimConstraints.length, 2);
});

test("homepage evidence snippets retain up to 3000 characters", () => {
  const snippet = buildSelectedTextSnippet("x".repeat(4000), HOMEPAGE_EVIDENCE_MAX_CHARS);
  assert.equal(snippet.length, HOMEPAGE_EVIDENCE_MAX_CHARS);
  assert.equal(snippet.endsWith("…"), true);
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

test("hook prompt applies automatic styles and brand constraints", () => {
  const prompt = buildHooksPrompt(persistedProfile, 8);

  assert.match(prompt.user, /Create an information gap/);
  assert.match(prompt.user, /Challenge a familiar assumption/);
  assert.match(prompt.user, /candid first-person admission/);
  assert.match(prompt.user, /Wasting ad spend/);
  assert.match(prompt.user, /Guaranteed ROAS/);
  assert.match(prompt.user, /exactly these 3 fields/i);
  assert.match(prompt.system, /Output ONLY valid JSON/);
});

test("regeneration prompt excludes previous copy", () => {
  const prompt = buildHooksPrompt(persistedProfile, 8, [{
    hookText: "i kept forgetting our best moments 😭",
    demoOverlayText: "save every memory",
  }], true);

  assert.match(prompt.user, /i kept forgetting our best moments/);
  assert.match(prompt.user, /save every memory/);
  assert.match(prompt.user, /previous attempt reused existing copy/i);
});

test("hook prompt uses selected examples as creative direction without copying them", () => {
  const prompt = buildHooksPrompt(persistedProfile, 8, [{
    hookText: "i found the shortcut nobody mentions",
    demoOverlayText: "this is what i use now",
    angle: "manual work",
  }]);

  assert.match(prompt.user, /Selected and previous hook references/);
  assert.match(prompt.user, /manual work/);
  assert.match(prompt.user, /do not repeat or lightly paraphrase/i);
});

test("creative line comparison ignores casing, punctuation, and whitespace", () => {
  assert.equal(normalizeCreativeLine("  Save EVERY memory!!! "), "save every memory");
  assert.deepEqual(findRepeatedCreativeLines([
    { hookText: "A genuinely new hook", demoOverlayText: "SAVE every memory..." },
  ], [
    { hookText: "An old hook", demoOverlayText: "save every memory" },
  ]), ["SAVE every memory..."]);
});

test("fallback hooks use actual profile names and creator-native casing", () => {
  const concepts = buildConceptCards(persistedProfile, 8);
  const hooks = concepts.map((concept) => concept.hookText);

  assert.equal(hooks.some((hook) => hook.includes("ContentLane")), true);
  assert.equal(hooks.some((hook) => hook.includes("url-to-video creative tool")), true);
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

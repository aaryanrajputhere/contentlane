import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  characterSelectionSchema,
  conceptSelectionSchema,
  conceptStageInputSchema,
  creatorCharacterSchema,
  creatorClipMutationSchema,
  creatorListQuerySchema,
  creatorMutationSchema,
  exportPayloadSchema,
  hookPreferenceSelectionSchema,
  hookPreferencesSchema,
  mediaStageInputSchema,
  projectCreatorSelectionSchema,
  websiteInputSchema,
} from "../domain/schemas";
import { creatorToCharacter } from "../lib/creator-library";
import {
  buildBrandProfile,
  buildConceptImagePrompt,
  buildConceptVideoPrompt,
  buildExportState,
  normalizeWebsiteInput,
} from "../lib/workflow";

test("website input normalizes bare domains and mixed casing", () => {
  assert.equal(
    normalizeWebsiteInput(" Example.com/Launch "),
    "https://example.com/launch",
  );
  const value = websiteInputSchema.parse({ website: "example.com" });
  assert.equal(value.website, "example.com");
});

test("workflow helpers derive a lean brand profile", () => {
  const profile = buildBrandProfile("https://signal-studio.io");
  assert.equal(profile.brandName.length > 0, true);
  assert.equal(profile.customerProblems.length > 0, true);
  assert.equal(profile.keyBenefits.length > 0, true);
  assert.deepEqual(Object.keys(profile).sort(), [
    "brandName",
    "claimConstraints",
    "customerProblems",
    "keyBenefits",
    "productSummary",
    "proofPoints",
    "targetAudience",
  ]);
});

test("generation payload schemas set sane defaults", () => {
  assert.equal(conceptStageInputSchema.parse({}).count, 8);
  assert.equal(conceptStageInputSchema.parse({}).useHookPreferences, true);
  assert.equal(conceptStageInputSchema.parse({}).append, false);
  assert.equal(conceptStageInputSchema.parse({ append: true }).append, true);
  assert.throws(() => conceptStageInputSchema.parse({ brief: {} }));
  assert.equal(mediaStageInputSchema.parse({}).forceRegenerate, false);
  const exportValue = exportPayloadSchema.parse({
    settings: { overlayText: "Publish now" },
  });
  assert.equal(exportValue.settings.overlayText, "Publish now");
  assert.equal(
    conceptSelectionSchema.parse({ conceptId: null }).conceptId,
    null,
  );
});

test("hook preference schemas accept bounded project-scoped examples", () => {
  const current = hookPreferenceSelectionSchema.parse({
    likedConceptIds: ["concept_legacy_01"],
    rejectedConceptIds: ["concept_legacy_02"],
  });
  assert.deepEqual(current.likedConceptIds, ["concept_legacy_01"]);
  assert.deepEqual(current.rejectedConceptIds, ["concept_legacy_02"]);

  const selected = hookPreferenceSelectionSchema.parse({
    conceptIds: ["cm00000000000000000000001"],
  });
  assert.equal(selected.conceptIds.length, 1);
  const preferences = hookPreferencesSchema.parse({
    examples: [{
      hookText: "i found the shortcut nobody mentions",
      demoOverlayText: "this is what i use now",
      angle: "manual work",
      score: 93,
      selectedAt: "2026-08-10T00:00:00.000Z",
    }],
    updatedAt: "2026-08-10T00:00:00.000Z",
  });
  assert.equal(preferences.examples[0]?.hookText, "i found the shortcut nobody mentions");
  assert.throws(() => hookPreferenceSelectionSchema.parse({ conceptIds: [] }));
  assert.throws(() => hookPreferenceSelectionSchema.parse({
    likedConceptIds: ["same-concept"],
    rejectedConceptIds: ["same-concept"],
  }), /both liked and rejected/);
  assert.throws(() => hookPreferenceSelectionSchema.parse({
    likedConceptIds: ["same-concept", "same-concept"],
    rejectedConceptIds: [],
  }), /cannot be repeated/);
  assert.throws(() => hookPreferenceSelectionSchema.parse({
    likedConceptIds: ["1", "2", "3", "4", "5"],
    rejectedConceptIds: ["6", "7", "8", "9"],
  }), /At most eight hook decisions/);
  assert.throws(() => hookPreferenceSelectionSchema.parse({
    conceptIds: ["same-concept", "same-concept"],
  }));
});

test("creator library schemas normalize editor payloads", () => {
  const unrestrictedDescription = "Creator description ".repeat(20);
  assert.equal(
    creatorMutationSchema.parse({
      name: "Test",
      description: unrestrictedDescription,
    }).description,
    unrestrictedDescription.trim(),
  );
  assert.equal(
    creatorListQuerySchema.parse({ tag: " founder " }).tag,
    "founder",
  );
  assert.deepEqual(
    creatorClipMutationSchema.parse({ tags: ["Hook", "Founder"] }).tags,
    ["Hook", "Founder"],
  );
  assert.equal(
    creatorCharacterSchema.parse({
      id: "creator-test",
      source: "preset",
      name: "Test",
      persona: "Persona",
      appearance: "Look",
      voice: "Voice",
      prompt: "Prompt",
      baseImageUrl: "https://example.com/image.png",
    }).baseImageUrl,
    "https://example.com/image.png",
  );
  const longDescription =
    "A friendly, relatable American content creator who specializes in authentic product reviews, lifestyle recommendations, and app demos. Her content is casual, natural, and filmed in everyday environments with an iPhone.";
  const character = creatorToCharacter({
    id: "creator-test",
    name: "Test",
    description: longDescription,
    baseImageUrl: "https://example.com/image.png",
    baseImageProvider: "cloudinary",
    baseImageMimeType: "image/png",
    clips: [],
  });
  assert.equal(
    creatorCharacterSchema.parse(character).persona.length <= 160,
    true,
  );
});

test("creator selection schemas support stable mixes and legacy characters", () => {
  const character = {
    id: "creator-test",
    source: "preset" as const,
    name: "Test",
    persona: "Persona",
    appearance: "Look",
    voice: "Voice",
    prompt: "Prompt",
  };
  const mixRequest = characterSelectionSchema.parse({ selection: { mode: "mix" } });
  assert.ok("selection" in mixRequest);
  assert.equal(mixRequest.selection.mode, "mix");
  const legacyRequest = characterSelectionSchema.parse({ character });
  assert.ok("character" in legacyRequest);
  assert.equal(legacyRequest.character?.id, "creator-test");
  assert.equal(
    projectCreatorSelectionSchema.parse({ mode: "single", characters: [character] }).mode,
    "single",
  );
  assert.throws(() => projectCreatorSelectionSchema.parse({ mode: "mix", characters: [character] }));
});

test("concept prompt builders and export state stay aligned", () => {
  const profile = buildBrandProfile("https://ContentLane.dev");
  const concept = {
    id: "ckv9z7t7f0000xkqwf3concept",
    projectId: "ckv9z7t7f0000xkqwf3proj",
    angle: "Sharper contrast",
    hookText: "Stop generic hooks before they cost the next customer.",
    hookImagePrompt:
      "Create a cinematic vertical 9:16 marketing image for ContentLane.",
    demoOverlayText: "ContentLane in 4 seconds",
    videoDirection: "Create a 4-5 second demo video for ContentLane.",
    targetDurationLabel: "4-5s",
    targetDurationSeconds: 5,
    score: 94,
    scoreLabel: "Top rank",
    rationale: "ContentLane positions the website as the source of truth.",
    generatedImageUrl: null,
    generatedVideoUrl: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  // @ts-expect-error Local fixture intentionally mirrors only the fields these helpers need.
  const imagePrompt = buildConceptImagePrompt(profile, concept);
  // @ts-expect-error Local fixture intentionally mirrors only the fields these helpers need.
  const videoPrompt = buildConceptVideoPrompt(profile, concept);
  const exportState = buildExportState(
    {
      website: "https://ContentLane.dev",
    },
    concept,
    null,
    null,
  );

  assert.match(imagePrompt, /Hook:/i);
  assert.match(videoPrompt.prompt, /Duration target: 4-5s/i);
  assert.equal(videoPrompt.durationSeconds, 5);
  assert.match(exportState.overlayText, /generic hooks/i);
  assert.equal(exportState.selectedConceptId, concept.id);
});

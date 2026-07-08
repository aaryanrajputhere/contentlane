-- Add concept-first generation columns while keeping the existing project tables intact.
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'GENERATE_CONCEPTS';

ALTER TABLE "HookDraft"
  ADD COLUMN IF NOT EXISTS "hookImagePrompt" TEXT,
  ADD COLUMN IF NOT EXISTS "demoOverlayText" TEXT,
  ADD COLUMN IF NOT EXISTS "videoDirection" TEXT,
  ADD COLUMN IF NOT EXISTS "targetDurationLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "targetDurationSeconds" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "scoreLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedVideoUrl" TEXT;

UPDATE "HookDraft"
SET
  "hookImagePrompt" = COALESCE("hookImagePrompt", CONCAT('Concept image prompt for ', "hookText")),
  "demoOverlayText" = COALESCE("demoOverlayText", 'Brand-specific concept'),
  "videoDirection" = COALESCE("videoDirection", '4-5 second demo video direction'),
  "targetDurationLabel" = COALESCE("targetDurationLabel", '4-5s'),
  "score" = COALESCE("score", 90),
  "scoreLabel" = COALESCE("scoreLabel", 'High rank');

ALTER TABLE "HookDraft"
  ALTER COLUMN "hookImagePrompt" SET NOT NULL,
  ALTER COLUMN "demoOverlayText" SET NOT NULL,
  ALTER COLUMN "videoDirection" SET NOT NULL,
  ALTER COLUMN "targetDurationLabel" SET NOT NULL,
  ALTER COLUMN "scoreLabel" SET NOT NULL;

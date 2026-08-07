ALTER TABLE "BrandProfile"
ADD COLUMN "productSummary" TEXT,
ADD COLUMN "targetAudience" TEXT,
ADD COLUMN "customerProblems" TEXT[],
ADD COLUMN "keyBenefits" TEXT[],
ADD COLUMN "claimConstraints" TEXT[];

UPDATE "BrandProfile"
SET
  "productSummary" = COALESCE(NULLIF("product", ''), NULLIF("summary", ''), "brandName"),
  "targetAudience" = COALESCE(NULLIF("audience", ''), NULLIF("audienceIdentity", ''), 'Website visitors'),
  "customerProblems" = ARRAY(
    SELECT DISTINCT value
    FROM unnest(
      COALESCE("fears", ARRAY[]::TEXT[])
      || COALESCE("realThoughts", ARRAY[]::TEXT[])
      || COALESCE("objections", ARRAY[]::TEXT[])
    ) AS value
    WHERE value <> ''
  ),
  "keyBenefits" = ARRAY(
    SELECT DISTINCT value
    FROM unnest(
      CASE WHEN "transformation" = '' THEN ARRAY[]::TEXT[] ELSE ARRAY["transformation"] END
      || COALESCE("dreamOutcomes", ARRAY[]::TEXT[])
    ) AS value
    WHERE value <> ''
  ),
  "claimConstraints" = COALESCE("forbiddenClaims", ARRAY[]::TEXT[]);

ALTER TABLE "BrandProfile"
ALTER COLUMN "productSummary" SET NOT NULL,
ALTER COLUMN "targetAudience" SET NOT NULL,
ALTER COLUMN "customerProblems" SET NOT NULL,
ALTER COLUMN "keyBenefits" SET NOT NULL,
ALTER COLUMN "claimConstraints" SET NOT NULL,
DROP COLUMN "product",
DROP COLUMN "audience",
DROP COLUMN "audienceIdentity",
DROP COLUMN "audienceStage",
DROP COLUMN "emotionalDrivers",
DROP COLUMN "fears",
DROP COLUMN "realThoughts",
DROP COLUMN "dailyMoments",
DROP COLUMN "dreamOutcomes",
DROP COLUMN "misconceptions",
DROP COLUMN "objections",
DROP COLUMN "socialProofMoments",
DROP COLUMN "transformation",
DROP COLUMN "uniqueMechanism",
DROP COLUMN "conversationStarters",
DROP COLUMN "viralTriggers",
DROP COLUMN "emotionalLanguage",
DROP COLUMN "forbiddenClaims",
DROP COLUMN "ugcScenarios",
DROP COLUMN "testimonials",
DROP COLUMN "cta",
DROP COLUMN "summary",
DROP COLUMN "campaignStrategy";

UPDATE "Project"
SET "hookBrief" = "hookBrief" - 'focusMomentId'
WHERE jsonb_typeof("hookBrief") = 'object';

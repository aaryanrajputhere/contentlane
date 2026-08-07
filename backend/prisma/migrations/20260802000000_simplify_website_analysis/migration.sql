ALTER TABLE "WebsiteAnalysis"
ADD COLUMN "homepage" JSONB,
ADD COLUMN "sourceContentFingerprint" TEXT;

UPDATE "WebsiteAnalysis"
SET
  "homepage" = COALESCE(
    "selectedPages" -> 0,
    "rankedPages" -> 0,
    jsonb_build_object(
      'url', "sourceUrl",
      'visibleTextSnippet', 'Homepage for ' || "rootDomain"
    )
  ),
  "sourceContentFingerprint" = "crawlSummary" ->> 'sourceContentFingerprint';

ALTER TABLE "WebsiteAnalysis"
ALTER COLUMN "homepage" SET NOT NULL,
DROP COLUMN "discoveredUrls",
DROP COLUMN "rankedPages",
DROP COLUMN "selectedPages",
DROP COLUMN "crawlSummary";

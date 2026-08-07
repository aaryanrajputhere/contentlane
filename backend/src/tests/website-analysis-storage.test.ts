import assert from "node:assert/strict";
import test from "node:test";
import { buildWebsiteAnalysisStorageData } from "../lib/workflow";

test("website analysis storage contains homepage evidence without ranking scaffolding", () => {
  const homepage = {
    url: "https://example.com",
    title: "Example",
    metaDescription: "An example homepage",
    visibleTextSnippet: "Example homepage content",
    extractedTextSnippet: "Example homepage content",
    canonicalUrl: "https://example.com",
    extractionStatus: "success" as const,
    extractionSource: "firecrawl" as const,
    extractionError: null,
  };
  const stored = buildWebsiteAnalysisStorageData({
    sourceUrl: "https://example.com",
    rootDomain: "example.com",
    homepage,
    sourceContentFingerprint: "fingerprint",
  });

  assert.deepEqual(stored, {
    sourceUrl: "https://example.com",
    rootDomain: "example.com",
    homepage,
    sourceContentFingerprint: "fingerprint",
  });
  assert.equal("rankedPages" in stored, false);
  assert.equal("selectedPages" in stored, false);
  assert.equal("crawlSummary" in stored, false);
});

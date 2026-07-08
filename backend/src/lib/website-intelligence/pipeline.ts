import { normalizeWebsiteInput } from '../workflow';
import { scrapePage } from './firecrawl';
import { synthesizeBrandProfile } from './synthesis';
import { buildSelectedTextSnippet } from './utils';
import type { AnalysisPipelineResult, WebsiteHomepageEvidence, WebsiteIntelligenceResult } from './types';

function toHomepageEvidence(scrape: Awaited<ReturnType<typeof scrapePage>>, website: string): WebsiteHomepageEvidence {
  const sourceUrl = scrape?.url ?? website;
  return {
    url: sourceUrl,
    title: scrape?.title ?? null,
    metaDescription: scrape?.metaDescription ?? null,
    visibleTextSnippet: buildSelectedTextSnippet(scrape?.visibleTextSnippet ?? sourceUrl),
    extractedTextSnippet: scrape?.rawText ? buildSelectedTextSnippet(scrape.rawText) : null,
    canonicalUrl: scrape?.canonicalUrl ?? null,
    extractionStatus: scrape && 'error' in scrape && scrape.error ? 'failed' : 'success',
    extractionSource: scrape?.source ?? 'fallback',
    extractionError: scrape && 'error' in scrape && scrape.error ? scrape.error : null,
  };
}

export async function runWebsiteIntelligencePipeline(website: string): Promise<AnalysisPipelineResult> {
  const rootUrl = normalizeWebsiteInput(website);
  console.log(`[website-intelligence] start analysis for ${rootUrl}`);
  const homepageScrape = await scrapePage(rootUrl, { allowFallback: true });
  const homepage = toHomepageEvidence(homepageScrape, rootUrl);
  const rootDomain = new URL(rootUrl).host.replace(/^www\./i, '');
  const intelligenceResult: WebsiteIntelligenceResult = {
    sourceUrl: rootUrl,
    rootDomain,
    homepage,
  };
  console.log(`[website-intelligence] homepage scrape complete for ${rootUrl}`);
  const brandProfile = await synthesizeBrandProfile(intelligenceResult);
  console.log(`[website-intelligence] completed analysis for ${rootUrl}`);
  return {
    brandProfile,
    analysis: {
      sourceUrl: rootUrl,
      rootDomain,
      homepage,
    },
  };
}

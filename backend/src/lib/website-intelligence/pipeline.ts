import { normalizeWebsiteInput } from '../workflow';
import { createHash } from 'node:crypto';
import { scrapePage } from './firecrawl';
import { synthesizeBrandProfile } from './synthesis';
import { buildSelectedTextSnippet, HOMEPAGE_EVIDENCE_MAX_CHARS } from './utils';
import type { AnalysisPipelineResult, WebsiteHomepageEvidence, WebsiteIntelligenceResult } from './types';
import type { AnalysisJsonRecorder } from '../analysis-json';

function toHomepageEvidence(scrape: Awaited<ReturnType<typeof scrapePage>>, website: string): WebsiteHomepageEvidence {
  const sourceUrl = scrape?.url ?? website;
  return {
    url: sourceUrl,
    title: scrape?.title ?? null,
    metaDescription: scrape?.metaDescription ?? null,
    visibleTextSnippet: buildSelectedTextSnippet(scrape?.visibleTextSnippet ?? sourceUrl),
    extractedTextSnippet: scrape?.rawText
      ? buildSelectedTextSnippet(scrape.rawText, HOMEPAGE_EVIDENCE_MAX_CHARS)
      : null,
    canonicalUrl: scrape?.canonicalUrl ?? null,
    extractionStatus: scrape && 'error' in scrape && scrape.error ? 'failed' : 'success',
    extractionSource: scrape?.source ?? 'fallback',
    extractionError: scrape && 'error' in scrape && scrape.error ? scrape.error : null,
  };
}

function buildSourceContentFingerprint(result: WebsiteIntelligenceResult) {
  return createHash('sha256')
    .update(JSON.stringify({
      sourceUrl: result.sourceUrl,
      title: result.homepage.title ?? '',
      metaDescription: result.homepage.metaDescription ?? '',
      visibleTextSnippet: result.homepage.visibleTextSnippet,
      extractedTextSnippet: result.homepage.extractedTextSnippet ?? '',
    }))
    .digest('hex');
}

export async function runWebsiteIntelligencePipeline(
  website: string,
  recorder?: AnalysisJsonRecorder,
): Promise<AnalysisPipelineResult> {
  const rootUrl = normalizeWebsiteInput(website);
  const t0 = Date.now();
  console.log(`[pipeline] start url=${rootUrl}`);

  const t1 = Date.now();
  const homepageScrape = await scrapePage(rootUrl, { allowFallback: true, recorder });
  console.log(`[pipeline] scrape done ${Date.now() - t1}ms source=${homepageScrape?.source ?? 'none'}`);

  const homepage = toHomepageEvidence(homepageScrape, rootUrl);
  await recorder?.write('homepage-evidence', homepage);
  const rootDomain = new URL(rootUrl).host.replace(/^www\./i, '');
  const intelligenceResult: WebsiteIntelligenceResult = {
    sourceUrl: rootUrl,
    rootDomain,
    homepage,
  };

  const t2 = Date.now();
  const finalProfile = await synthesizeBrandProfile(intelligenceResult, recorder);
  await recorder?.write('brand-profile', finalProfile);
  console.log(`[pipeline] synthesis done ${Date.now() - t2}ms`);

  console.log(`[pipeline] complete ${Date.now() - t0}ms brand="${finalProfile.brandName}"`);

  const result = {
    brandProfile: finalProfile,
    analysis: {
      sourceUrl: rootUrl,
      rootDomain,
      homepage,
      sourceContentFingerprint: buildSourceContentFingerprint(intelligenceResult),
    },
  };
  await recorder?.write('website-analysis', result.analysis);
  return result;
}

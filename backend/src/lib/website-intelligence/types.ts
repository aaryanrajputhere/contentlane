import type { BrandProfile, WebsiteAnalysis, WebsiteAnalysisHomepage } from '../../domain/schemas';

export interface WebsitePageCandidate {
  url: string;
  title: string | null;
  metaDescription: string | null;
  visibleTextSnippet: string;
  pageTypeHint: string;
  crawlDepth: number;
  canonicalUrl?: string | null;
}

export interface WebsitePageRank extends WebsitePageCandidate {
  score: number;
  scoreReason: string;
}

export interface WebsitePageExtraction extends WebsitePageRank {
  extractionStatus: 'success' | 'failed';
  extractionSource: 'firecrawl' | 'fallback';
  extractionError: string | null;
  extractedTextSnippet: string | null;
}

export type WebsiteHomepageEvidence = WebsiteAnalysisHomepage;

export interface WebsiteIntelligenceResult {
  sourceUrl: string;
  rootDomain: string;
  homepage: WebsiteHomepageEvidence;
}

export interface AnalysisPipelineResult {
  brandProfile: Omit<BrandProfile, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;
  analysis: Omit<WebsiteAnalysis, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> & {
    sourceContentFingerprint?: string;
  };
}

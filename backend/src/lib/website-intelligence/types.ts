import type { BrandProfile, WebsiteAnalysis, WebsiteAnalysisHomepage } from '../../domain/schemas';

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

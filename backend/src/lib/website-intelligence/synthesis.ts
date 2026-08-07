import { brandProfileSchema } from '../../domain/schemas';
import { config } from '../../config';
import { buildBrandProfile } from '../workflow';
import { callLLM, hasLLMConfig, type LLMPrompt } from './llm';
import { HOMEPAGE_EVIDENCE_MAX_CHARS, truncateText } from './utils';
import type { WebsiteIntelligenceResult } from './types';
import type { AnalysisJsonRecorder } from '../analysis-json';
import { errorJson } from '../analysis-json';

const synthesisResponseSchema = brandProfileSchema.omit({
  id: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
});

export function buildSynthesisPrompt(result: WebsiteIntelligenceResult): LLMPrompt {
  const contentEvidence = truncateText(
    result.homepage.extractedTextSnippet ?? result.homepage.visibleTextSnippet,
    HOMEPAGE_EVIDENCE_MAX_CHARS,
  );

  return {
    system: `You extract an evidence-grounded brand profile from website content.

Use only the supplied homepage evidence. Do not invent customers, benefits, proof, guarantees, or product capabilities. Make every array item atomic, distinct, and non-overlapping. Aim for the requested range when the evidence supports it, but return fewer items rather than padding or guessing. Return strict JSON only with exactly the requested fields.`,
    user: JSON.stringify({
      task: 'Extract the seven brand-context fields used for short-form hook generation.',
      rootUrl: result.sourceUrl,
      rootDomain: result.rootDomain,
      homepage: {
        url: result.homepage.url,
        title: result.homepage.title,
        metaDescription: result.homepage.metaDescription,
        contentEvidence,
      },
      fieldGuidance: {
        brandName: 'The brand name shown by the website.',
        productSummary: 'One concise sentence explaining what the product or service does.',
        targetAudience: 'The specific customer described or clearly implied by the evidence.',
        customerProblems: 'Target 3-5 concrete, distinct problems the product addresses. Do not invent fears or objections.',
        keyBenefits: 'Target 3-5 distinct outcomes or capabilities explicitly supported by the evidence.',
        proofPoints: 'Target 2-5 verifiable facts, prices, features, testimonials, or claims present in the evidence.',
        claimConstraints: 'Target 2-4 specific claims hook generation must avoid because the evidence does not support them.',
      },
      responseShape: {
        brandName: 'ExampleBrand',
        productSummary: 'A concise description of the product.',
        targetAudience: 'The intended customer.',
        customerProblems: [
          'A concrete customer problem',
          'A second distinct customer problem',
          'A third distinct customer problem',
        ],
        keyBenefits: [
          'An evidence-backed benefit',
          'A second distinct benefit',
          'A third distinct benefit',
        ],
        proofPoints: [
          'An evidence-backed fact',
          'A second verifiable fact',
        ],
        claimConstraints: [
          'Do not claim a result the website does not support',
          'Do not imply a capability absent from the evidence',
        ],
      },
    }, null, 2),
  };
}

function buildFallbackProfile(result: WebsiteIntelligenceResult) {
  const fallback = buildBrandProfile(result.sourceUrl);
  const title = result.homepage.title?.trim();
  const description = result.homepage.metaDescription?.trim();
  const snippet = truncateText(
    result.homepage.extractedTextSnippet ?? result.homepage.visibleTextSnippet,
    180,
  );

  return {
    ...fallback,
    brandName: title || fallback.brandName,
    productSummary: description || snippet || fallback.productSummary,
  };
}

export function parseCreativeIntelligenceJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return synthesisResponseSchema.parse(JSON.parse(clean));
}

export async function synthesizeBrandProfile(
  result: WebsiteIntelligenceResult,
  recorder?: AnalysisJsonRecorder,
) {
  console.log(`[synthesis] start url=${result.sourceUrl} title="${result.homepage.title ?? ''}" text=${result.homepage.visibleTextSnippet.length}chars`);
  const prompt = buildSynthesisPrompt(result);
  await recorder?.write('brand-prompt', prompt);

  if (!hasLLMConfig()) {
    console.log('[synthesis] no LLM config, using fallback');
    await recorder?.write('brand-raw-response', {
      provider: 'fallback',
      raw: null,
      reason: 'No language model is configured',
    });
    return synthesisResponseSchema.parse(buildFallbackProfile(result));
  }

  try {
    const raw = await callLLM(prompt, {
      model: config.OPENAI_SYNTHESIS_MODEL,
      temperature: 0.2,
      maxTokens: 1400,
      onRawResponse: async (response) => {
        await recorder?.write('brand-raw-provider-response', response);
      },
    });
    await recorder?.write('brand-raw-response', { raw });
    if (!raw) return buildFallbackProfile(result);

    const parsed = parseCreativeIntelligenceJson(raw);
    console.log(`[synthesis] done brand="${parsed.brandName}" problems=${parsed.customerProblems.length} benefits=${parsed.keyBenefits.length}`);
    return parsed;
  } catch (error) {
    console.error('[synthesis] failed:', error instanceof Error ? error.message : error);
    await recorder?.write('brand-error', errorJson(error));
    return buildFallbackProfile(result);
  }
}

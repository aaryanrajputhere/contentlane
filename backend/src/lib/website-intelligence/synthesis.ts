import { z } from 'zod';
import { brandProfileSchema } from '../../domain/schemas';
import { buildBrandProfile } from '../workflow';
import { buildRunPodPrompt, extractRunPodText, hasRunPodConfig, runPodJson } from './runpod';
import { truncateText } from './utils';
import type { WebsiteIntelligenceResult } from './types';

const synthesisResponseSchema = brandProfileSchema.omit({ id: true, projectId: true, createdAt: true, updatedAt: true });

function buildSynthesisPrompt(result: WebsiteIntelligenceResult) {
  return buildRunPodPrompt({
    system: 'You synthesize concise brand profiles from homepage evidence. Return strict JSON only.',
    user: JSON.stringify({
      task: 'Create a structured brand profile using only the homepage evidence below.',
      rootUrl: result.sourceUrl,
      rootDomain: result.rootDomain,
      homepage: {
        url: result.homepage.url,
        title: result.homepage.title,
        metaDescription: result.homepage.metaDescription,
        visibleTextSnippet: truncateText(result.homepage.visibleTextSnippet, 360),
        extractedTextSnippet: truncateText(result.homepage.extractedTextSnippet ?? '', 360) || null,
        canonicalUrl: result.homepage.canonicalUrl,
        extractionStatus: result.homepage.extractionStatus,
        extractionSource: result.homepage.extractionSource,
        extractionError: result.homepage.extractionError,
      },
      outputFields: ['brandName', 'tagline', 'audience', 'painPoints', 'benefits', 'voice', 'offer', 'cta', 'angles', 'summary'],
      guidance: [
        'Keep the brand name faithful to the site branding when possible.',
        'Use short, concrete language with marketing clarity.',
        'Pain points and benefits should be derived from the homepage evidence.',
        'Angles should be usable for short-form marketing hooks.',
        'Summary should explain the core positioning in two sentences or less.',
      ],
      responseShape: {
        brandName: 'Example',
        tagline: 'Example tagline',
        audience: 'Example audience',
        painPoints: ['Problem 1'],
        benefits: ['Benefit 1'],
        voice: 'Direct, practical',
        offer: 'Example offer',
        cta: 'Book a demo',
        angles: ['Angle 1'],
        summary: 'Short summary',
      },
    }, null, 2),
  });
}

function buildFallbackProfile(result: WebsiteIntelligenceResult) {
  const fallback = buildBrandProfile(result.sourceUrl);
  const homepage = result.homepage;
  const title = homepage.title?.trim();
  const snippet = truncateText(homepage.extractedTextSnippet ?? homepage.visibleTextSnippet, 120);
  if (!title && !snippet) return fallback;
  return {
    ...fallback,
    tagline: title ? `${title} that turns website attention into short-form content.` : fallback.tagline,
    audience: homepage.metaDescription ? truncateText(homepage.metaDescription, 120) : fallback.audience,
    summary: truncateText(`${fallback.summary} Homepage evidence leaned on ${title ?? 'the site brand'} and ${snippet}.`, 240),
    angles: Array.from(new Set([...(title ? [title] : []), ...fallback.angles])).slice(0, 4),
  };
}

export async function synthesizeBrandProfile(result: WebsiteIntelligenceResult) {
  if (!hasRunPodConfig()) {
    return synthesisResponseSchema.parse(buildFallbackProfile(result));
  }
  const prompt = buildSynthesisPrompt(result);
  try {
    const payload = await runPodJson<unknown>({ prompt, temperature: 0.2, maxTokens: 2200 });
    if (!payload) return buildFallbackProfile(result);
    const text = extractRunPodText(payload);
    return synthesisResponseSchema.parse(JSON.parse(text));
  } catch {
    return buildFallbackProfile(result);
  }
}

import { z } from 'zod';
import { brandProfileSchema, creativeBriefSchema } from '../../domain/schemas';
import { buildBrandProfile } from '../workflow';
import { hasLLMConfig, callLLM, type LLMPrompt } from './llm';
import { truncateText } from './utils';
import type { WebsiteIntelligenceResult } from './types';
import { buildFallbackBriefs } from './planner';
import { config } from '../../config';
import { randomUUID } from 'node:crypto';

const synthesisResponseSchema = brandProfileSchema.omit({ id: true, projectId: true, createdAt: true, updatedAt: true });
const creativeBriefInputSchema = creativeBriefSchema.omit({ id: true });
const creativeIntelligenceSchema = synthesisResponseSchema.extend({
  campaignStrategy: z.array(z.union([creativeBriefSchema, creativeBriefInputSchema])).min(1).max(5),
});

function buildSynthesisPrompt(result: WebsiteIntelligenceResult): LLMPrompt {
  return {
    system: 'You are a senior UX researcher and consumer psychology expert.\n\nYour job is not to summarize a website. Your job is to extract customer psychology from the homepage evidence.\n\nThink like a researcher interviewing real users. Capture what they actually think, what they complain about, what they wish existed, what they tell their friends, their daily moments, and their misconceptions.\n\nExtract real insights instead of generic marketing language. Do NOT invent information; infer everything from the evidence. The output should feel like notes from interviewing 100 customers.\n\nReturn strict JSON only.',
    user: JSON.stringify({
      task: 'Create a Creative Intelligence Report and 5 customer moments using only the homepage evidence below.',
      rootUrl: result.sourceUrl,
      rootDomain: result.rootDomain,
      homepage: {
        url: result.homepage.url,
        title: result.homepage.title,
        metaDescription: result.homepage.metaDescription,
        visibleTextSnippet: truncateText(result.homepage.visibleTextSnippet, 1000),
        extractedTextSnippet: truncateText(result.homepage.extractedTextSnippet ?? '', 1000) || null,
      },
      outputFields: [
        'brandName', 'product', 'audience', 'audienceIdentity', 'audienceStage',
        'emotionalDrivers', 'fears', 'realThoughts', 'dailyMoments', 'dreamOutcomes',
        'misconceptions', 'objections', 'proofPoints', 'socialProofMoments',
        'transformation', 'uniqueMechanism', 'conversationStarters',
        'viralTriggers', 'emotionalLanguage', 'forbiddenClaims', 'ugcScenarios',
        'testimonials', 'cta', 'summary', 'campaignStrategy'
      ],
      guidance: [
        'Keep the brand name faithful to the site branding when possible.',
        'Focus on real human insights over generic marketing summaries.',
        'realThoughts: internal monologue before buying (e.g. "I always forget to log meals").',
        'dailyMoments: situations where the product naturally appears.',
        'dreamOutcomes: emotional outcomes rather than product benefits.',
        'misconceptions: false beliefs users commonly have.',
        'conversationStarters: phrases a creator could naturally start a Reel with (e.g. "I thought this wasn\'t for me").',
        'socialProofMoments: moments where testimonials or social proof can naturally be introduced.',
        'campaignStrategy: exactly 5 realistic short-form video moments. Do not write hooks.',
        'Do not invent information. Infer everything strictly from the provided homepage text.',
      ],
      responseShape: {
        brandName: 'ExampleBrand',
        product: 'ExampleProduct',
        audience: 'Target demographic',
        audienceIdentity: 'How they see themselves',
        audienceStage: 'Problem aware / Solution aware / etc',
        emotionalDrivers: ['Desire 1'],
        fears: ['Fear 1'],
        realThoughts: ['I always forget to...'],
        dailyMoments: ['Sitting at the desk when...'],
        dreamOutcomes: ['Stop feeling guilty after...'],
        misconceptions: ['I thought I had to...'],
        objections: ['Objection 1'],
        proofPoints: ['Proof 1'],
        socialProofMoments: ['When they realize that...'],
        transformation: 'Before state to after state',
        uniqueMechanism: 'How the product works uniquely',
        conversationStarters: ['I finally understand why people...'],
        viralTriggers: ['Trigger 1'],
        emotionalLanguage: ['Exact phrase 1'],
        forbiddenClaims: ['Claim 1'],
        ugcScenarios: ['Scenario 1'],
        testimonials: ['Testimonial 1'],
        cta: 'Book a demo',
        summary: 'Short summary of the transformation',
        campaignStrategy: [{
          pattern: 'Confession',
          moment: 'A specific situation a real customer experiences',
          viewerEmotion: 'Relief',
          creatorEmotion: 'Frustration',
          payoff: 'What changes after using the product',
          location: 'Home office',
          creatorAction: 'Physical action for the opening scene',
          avoid: ['unlock', 'revolutionary'],
        }],
      },
    }, null, 2),
  };
}

function buildFallbackProfile(result: WebsiteIntelligenceResult) {
  const fallback = buildBrandProfile(result.sourceUrl);
  const homepage = result.homepage;
  const title = homepage.title?.trim();
  const snippet = truncateText(homepage.extractedTextSnippet ?? homepage.visibleTextSnippet, 120);
  if (!title && !snippet) return fallback;
  const profile = {
    ...fallback,
    audience: homepage.metaDescription ? truncateText(homepage.metaDescription, 120) : fallback.audience,
    summary: truncateText(`${fallback.summary} Homepage evidence leaned on ${title ?? 'the site brand'} and ${snippet}.`, 240),
    conversationStarters: Array.from(new Set([...(title ? [title] : []), ...fallback.conversationStarters])).slice(0, 4),
  };
  return {
    ...profile,
    campaignStrategy: buildFallbackBriefs(profile),
  };
}

export function parseCreativeIntelligenceJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = creativeIntelligenceSchema.parse(JSON.parse(clean));
  return {
    ...parsed,
    campaignStrategy: parsed.campaignStrategy.map((brief) => ({
      id: 'id' in brief ? brief.id : randomUUID(),
      ...brief,
    })),
  };
}

export async function synthesizeBrandProfile(result: WebsiteIntelligenceResult) {
  console.log(`[synthesis] start url=${result.sourceUrl} title="${result.homepage.title ?? ''}" text=${result.homepage.visibleTextSnippet.length}chars`);

  if (!hasLLMConfig()) {
    console.log('[synthesis] no LLM config, using fallback');
    return synthesisResponseSchema.parse(buildFallbackProfile(result));
  }

  const prompt = buildSynthesisPrompt(result);

  try {
    const raw = await callLLM(prompt, { model: config.OPENAI_SYNTHESIS_MODEL, temperature: 0.2, maxTokens: 2800 });
    if (!raw) {
      console.log('[synthesis] LLM returned null, using fallback');
      return buildFallbackProfile(result);
    }

    const parsed = parseCreativeIntelligenceJson(raw);
    console.log(`[synthesis] done brand="${parsed.brandName}" angles=${parsed.conversationStarters.length} scenarios=${parsed.ugcScenarios.length} briefs=${parsed.campaignStrategy?.length ?? 0}`);
    return parsed;
  } catch (error) {
    console.error('[synthesis] failed:', error instanceof Error ? error.message : error);
    return buildFallbackProfile(result);
  }
}

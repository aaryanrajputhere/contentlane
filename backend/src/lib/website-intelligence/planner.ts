import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { BrandProfile, CreativeBrief } from '../../domain/schemas';
import { hasLLMConfig, callLLM, type LLMPrompt } from './llm';

const llmBriefsSchema = z.object({
  briefs: z.array(z.object({
    pattern: z.string().min(1),
    moment: z.string().min(1),
    viewerEmotion: z.string().min(1),
    creatorEmotion: z.string().min(1),
    payoff: z.string().min(1),
    location: z.string().min(1),
    creatorAction: z.string().min(1),
    avoid: z.array(z.string()),
  }))
});

type ProfileInput = Omit<BrandProfile, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;

function buildPlannerPrompt(profile: ProfileInput): LLMPrompt {
  return {
    system: `You are a TikTok creator planning videos, not a marketer.
Your job is to read a Creative Intelligence Report and generate 5 distinct moments that real customers experience.
These moments will be used to plan the opening scenes of short-form videos.

You must generate REALISTIC, VISUAL, EMOTIONALLY RELATABLE situations.
Do NOT write hooks. Do NOT write marketing copy. Do NOT explain the product.
Think like a film director planning scenes.

Output ONLY valid JSON. Do not explain anything.`,
    user: `Brand: ${profile.brandName}
Product: ${profile.product}
Audience Identity: ${profile.audienceIdentity} (${profile.audienceStage})
Transformation: ${profile.transformation}
Fears & Real Thoughts: ${profile.fears.slice(0, 2).concat(profile.realThoughts.slice(0, 2)).join(', ')}
Objections: ${profile.objections.slice(0, 2).join(', ')}
Proof Points: ${profile.proofPoints.slice(0, 2).join(', ')}
Conversation Starters: ${profile.conversationStarters.slice(0, 3).join(' | ')}
Emotional Language: ${profile.emotionalLanguage.join(', ')}
UGC Scenarios: ${profile.ugcScenarios.slice(0, 2).join(' | ')}
Forbidden Claims: ${profile.forbiddenClaims.join(', ')}

Generate exactly 5 video moments.
Each brief MUST use a different pattern (e.g., Confession, Curiosity, Story, Mistake, Myth).

Output FORMAT: A JSON object containing an array of 5 briefs under the key "briefs".
Each brief must have:
- pattern: The framework (e.g., "Confession")
- moment: A specific situation a real customer experiences (e.g., "I'm already halfway through my burger when I realize I forgot to log it... again.")
- viewerEmotion: What the viewer should feel (e.g., "Guilt")
- creatorEmotion: What the creator is feeling in the scene (e.g., "Relief")
- payoff: What changes after using the product (e.g., "Now I just take a picture and move on.")
- location: Where this scene happens (e.g., "Restaurant")
- creatorAction: Physical action (e.g., "Looks down at meal, sighs, opens the app and snaps a photo.")
- avoid: Array of 3-5 marketing words to explicitly avoid (e.g., ["unlock", "discover", "revolutionary"])

Output ONLY valid JSON:`,
  };
}

export function buildFallbackBriefs(profile: ProfileInput): CreativeBrief[] {
  return [
    {
      id: randomUUID(),
      pattern: 'Confession',
      moment: "I'm sitting in my car after a meeting, staring at my phone, realizing I forgot to send that crucial email.",
      viewerEmotion: 'Anxiety',
      creatorEmotion: 'Frustration',
      payoff: 'Now it happens automatically while I drive.',
      location: 'In a parked car',
      creatorAction: 'Rubbing temples, looking stressed, then relaxing.',
      avoid: ['unlock', 'discover', 'revolutionary', 'journey', 'potential']
    },
    {
      id: randomUUID(),
      pattern: 'Mistake',
      moment: "I just spent 3 hours building a spreadsheet only to realize I did it the hard way.",
      viewerEmotion: 'Empathy',
      creatorEmotion: 'Annoyance',
      payoff: 'Now I just click one button and the report is done.',
      location: 'Home office desk',
      creatorAction: 'Slams laptop shut slightly, shakes head.',
      avoid: ['solution', 'comprehensive', 'best in class']
    },
    {
      id: randomUUID(),
      pattern: 'Story',
      moment: "I'm unpacking groceries and trying to remember which brand of oat milk I liked last time.",
      viewerEmotion: 'Curiosity',
      creatorEmotion: 'Confusion',
      payoff: 'Now I have a saved list that tells me exactly what to buy.',
      location: 'Kitchen counter',
      creatorAction: 'Holding two cartons of milk, looking between them.',
      avoid: ['introducing', 'platform', 'seamless']
    },
    {
      id: randomUUID(),
      pattern: 'Curiosity',
      moment: "I saw my coworker leave at 4 PM every day this week and finally asked how.",
      viewerEmotion: 'Envy',
      creatorEmotion: 'Excitement',
      payoff: 'Now I have the same shortcut installed.',
      location: 'Office hallway',
      creatorAction: 'Looking off-camera, whispering conspiratorially.',
      avoid: ['maximize', 'optimize', 'leverage']
    },
    {
      id: randomUUID(),
      pattern: 'Myth Busting',
      moment: "I'm sitting with a friend who just told me I need 10,000 followers to get sponsorships.",
      viewerEmotion: 'Skepticism',
      creatorEmotion: 'Confidence',
      payoff: 'Now I get deals with just 500 engaged followers.',
      location: 'Coffee shop',
      creatorAction: 'Sipping coffee, raising an eyebrow.',
      avoid: ['industry leading', 'innovative', 'next generation']
    }
  ];
}

export async function generateCampaignStrategy(profile: ProfileInput): Promise<CreativeBrief[]> {
  console.log(`[planner] start brand="${profile.brandName}"`);

  if (!hasLLMConfig()) {
    console.log('[planner] no LLM config, using fallback');
    return buildFallbackBriefs(profile);
  }

  const prompt = buildPlannerPrompt(profile);

  try {
    const raw = await callLLM(prompt, { temperature: 0.7, maxTokens: 2500 });
    if (!raw) {
      console.log('[planner] LLM returned null, using fallback');
      return buildFallbackBriefs(profile);
    }
    
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    console.log('[planner] AI JSON response:\n', text);
    const parsed = llmBriefsSchema.parse(JSON.parse(text));
    
    const briefs = parsed.briefs.map(b => ({
      id: randomUUID(),
      ...b
    }));

    console.log(`[planner] done briefs=${briefs.length} patterns=${briefs.map(b => b.pattern).join(', ')}`);
    return briefs;
  } catch (error) {
    console.error('[planner] failed:', error instanceof Error ? error.message : error);
    return buildFallbackBriefs(profile);
  }
}

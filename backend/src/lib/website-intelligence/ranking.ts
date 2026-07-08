import { z } from 'zod';
import { buildRunPodPrompt, extractRunPodText, hasRunPodConfig, runPodJson } from './runpod';
import { filterRankablePages, isLowSignalPage, scorePageLocally, sortPagesByScore, truncateText } from './utils';
import type { WebsitePageCandidate, WebsitePageRank } from './types';

const rankingResponseSchema = z.object({
  rankedPages: z.array(z.object({
    url: z.string().url(),
    score: z.number().int().min(0).max(100),
    scoreReason: z.string().min(1),
  }).strict()).min(1),
}).strict();

function buildRankingPrompt(pages: WebsitePageCandidate[], rootDomain: string) {
  return buildRunPodPrompt({
    system: 'You rank website pages for brand analysis. Return strict JSON only.',
    user: JSON.stringify({
      task: 'Score each page by how useful it is for understanding the brand, offer, audience, voice, benefits, and conversion path.',
      rootDomain,
      rankingRules: [
        'Bias toward homepage, pricing, product/features, use cases, docs/how-it-works, and about/team when needed for voice.',
        'Down-rank login, signup, privacy, terms, blog indexes, tag archives, and category archives.',
        'Use score 0-100, higher is more relevant for brand analysis.',
        'Return every input page exactly once.',
      ],
      pages: pages.map((page) => ({
        url: page.url,
        title: page.title,
        metaDescription: page.metaDescription,
        visibleTextSnippet: truncateText(page.visibleTextSnippet, 220),
        pageTypeHint: page.pageTypeHint,
        crawlDepth: page.crawlDepth,
      })),
      responseShape: {
        rankedPages: [{ url: 'https://example.com', score: 100, scoreReason: 'Homepage explains the offer.' }],
      },
    }, null, 2),
  });
}

function rankLocally(pages: WebsitePageCandidate[]) {
  return sortPagesByScore(pages.map((page) => {
    const { score, scoreReason } = scorePageLocally(page);
    return { ...page, score, scoreReason };
  }));
}

export async function rankWebsitePages(pages: WebsitePageCandidate[], rootDomain: string) {
  const rankablePages = filterRankablePages(pages);
  if (!hasRunPodConfig()) {
    return rankLocally(rankablePages);
  }
  const prompt = buildRankingPrompt(rankablePages, rootDomain);
  try {
    const payload = await runPodJson<unknown>({ prompt, temperature: 0.1, maxTokens: 1800 });
    if (!payload) return rankLocally(rankablePages);
    const text = extractRunPodText(payload);
    const parsed = rankingResponseSchema.parse(JSON.parse(text));
    const byUrl = new Map(parsed.rankedPages.map((page) => [page.url, page]));
    const rankedPages = rankablePages.map((page) => {
      const ranked = byUrl.get(page.url);
      if (ranked) return { ...page, score: ranked.score, scoreReason: ranked.scoreReason };
      const local = scorePageLocally(page);
      return { ...page, score: local.score, scoreReason: local.scoreReason };
    });
    return sortPagesByScore(rankedPages);
  } catch {
    return rankLocally(rankablePages);
  }
}

export function selectTopPages(pages: WebsitePageRank[], count = 8) {
  const sorted = sortPagesByScore(pages).filter((page) => !isLowSignalPage(page));
  return sorted.slice(0, count);
}

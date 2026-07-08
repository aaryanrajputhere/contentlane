import type { WebsitePageCandidate, WebsitePageRank } from './types';

const lowSignalPathPatterns = [
  /\/login(?:\/|$)/i,
  /\/sign[-_]?in(?:\/|$)/i,
  /\/signup(?:\/|$)/i,
  /\/register(?:\/|$)/i,
  /\/privacy(?:\/|$)/i,
  /\/terms(?:\/|$)/i,
  /\/legal(?:\/|$)/i,
  /\/cookie(?:\/|$)/i,
  /\/careers?(?:\/|$)/i,
  /\/jobs?(?:\/|$)/i,
  /\/tag(?:s)?\//i,
  /\/category\//i,
  /\/author\//i,
  /\/feed(?:\/|$)/i,
  /\/rss(?:\/|$)/i,
  /\/search(?:\/|$)/i,
  /\/sitemap(?:\.xml)?$/i,
];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncateText(value: string, maxLength: number) {
  const trimmed = collapseWhitespace(value);
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function rootDomainFromUrl(value: string) {
  return new URL(value).host.replace(/^www\./i, '').toLowerCase();
}

export function normalizePageUrl(value: string, baseUrl?: string | null) {
  const parsed = new URL(value, baseUrl ?? undefined);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  const removableParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid', 'ref', 'source', 'cmp'];
  for (const key of removableParams) {
    parsed.searchParams.delete(key);
  }
  const remaining = Array.from(parsed.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  parsed.search = '';
  for (const [key, currentValue] of remaining) {
    parsed.searchParams.append(key, currentValue);
  }
  const path = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  parsed.pathname = path === '' ? '/' : path;
  const normalized = parsed.toString();
  return parsed.pathname === '/' && parsed.search === '' ? normalized.replace(/\/$/, '') : normalized;
}

export function pageDepthFromUrl(value: string) {
  const { pathname } = new URL(value);
  return pathname.split('/').filter(Boolean).length;
}

export function pageTypeHintFromUrl(value: string, title?: string | null) {
  const path = new URL(value).pathname.toLowerCase();
  const titleText = (title ?? '').toLowerCase();
  const source = `${path} ${titleText}`;
  if (path === '/' || path === '') return 'homepage';
  if (/pricing|plans|pricing page/.test(source)) return 'pricing';
  if (/feature|product|solutions?|platform|how-it-works|how it works|overview/.test(source)) return 'product/features';
  if (/use-case|use case|case-study|case study|customer-story|stories/.test(source)) return 'use case';
  if (/doc|help|support|guide|tutorial|academy|kb|knowledge base/.test(source)) return 'docs/how-it-works';
  if (/about|company|team|who-we-are|our-story|mission/.test(source)) return 'about/team';
  if (/blog|news|insight|article|resources/.test(source)) return path.includes('/blog') && path.split('/').filter(Boolean).length <= 1 ? 'blog index' : 'blog/article';
  if (/contact|book|demo|schedule/.test(source)) return 'contact/demo';
  if (/login|sign in|signin|signup|register|privacy|terms/.test(source)) return 'low-signal';
  return 'supporting page';
}

export function isLowSignalPage(candidate: Pick<WebsitePageCandidate, 'url' | 'pageTypeHint'>) {
  if (candidate.pageTypeHint === 'low-signal' || candidate.pageTypeHint === 'blog index') return true;
  return lowSignalPathPatterns.some((pattern) => pattern.test(candidate.url));
}

export function toPageCandidate(input: { url: string; title?: string | null; metaDescription?: string | null; visibleTextSnippet?: string | null; pageTypeHint?: string; crawlDepth?: number; canonicalUrl?: string | null }, baseUrl?: string | null): WebsitePageCandidate | null {
  try {
    const url = normalizePageUrl(input.url, baseUrl);
    const title = input.title?.trim() || null;
    const metaDescription = input.metaDescription?.trim() || null;
    const visibleTextSnippet = truncateText(input.visibleTextSnippet ?? metaDescription ?? title ?? url, 280);
    return {
      url,
      title,
      metaDescription,
      visibleTextSnippet,
      pageTypeHint: input.pageTypeHint?.trim() || pageTypeHintFromUrl(url, title),
      crawlDepth: input.crawlDepth ?? pageDepthFromUrl(url),
      canonicalUrl: input.canonicalUrl ? normalizePageUrl(input.canonicalUrl, baseUrl) : null,
    };
  } catch {
    return null;
  }
}

export function dedupePageCandidates(pages: WebsitePageCandidate[]) {
  const byUrl = new Map<string, WebsitePageCandidate>();
  for (const page of pages) {
    const key = normalizePageUrl(page.canonicalUrl ?? page.url);
    const current = byUrl.get(key);
    if (!current) {
      byUrl.set(key, page);
      continue;
    }
    const currentScore = (current.title ? 2 : 0) + (current.metaDescription ? 1 : 0) + current.visibleTextSnippet.length;
    const nextScore = (page.title ? 2 : 0) + (page.metaDescription ? 1 : 0) + page.visibleTextSnippet.length;
    if (nextScore >= currentScore) {
      byUrl.set(key, page);
    }
  }
  return [...byUrl.values()];
}

export function filterRankablePages(pages: WebsitePageCandidate[]) {
  if (pages.length <= 8) return pages.slice();
  return pages.filter((page) => !isLowSignalPage(page));
}

export function scorePageLocally(page: WebsitePageCandidate) {
  const hint = page.pageTypeHint.toLowerCase();
  let score = 50;
  let reason = 'General supporting page';
  if (hint === 'homepage') {
    score = 100;
    reason = 'Homepage usually carries the core positioning';
  } else if (hint === 'pricing') {
    score = 98;
    reason = 'Pricing page usually reveals the offer and conversion path';
  } else if (hint === 'product/features') {
    score = 95;
    reason = 'Product and feature pages explain the value proposition';
  } else if (hint === 'docs/how-it-works') {
    score = 92;
    reason = 'Docs and how-it-works pages explain the workflow in detail';
  } else if (hint === 'use case') {
    score = 90;
    reason = 'Use case and case study pages show the ideal customer and outcomes';
  } else if (hint === 'about/team') {
    score = 84;
    reason = 'About and team pages help with voice and positioning';
  } else if (hint === 'contact/demo') {
    score = 72;
    reason = 'Contact and demo pages can reveal the conversion motion';
  } else if (hint === 'blog/article') {
    score = 63;
    reason = 'Blog articles are secondary unless the site is content-led';
  } else if (hint === 'blog index') {
    score = 25;
    reason = 'Blog indexes are usually low-signal for positioning';
  } else if (hint === 'low-signal') {
    score = 6;
    reason = 'Authentication and legal pages rarely describe the product';
  }
  if (page.title) score += 4;
  if (page.metaDescription) score += 2;
  if (page.visibleTextSnippet.length > 140) score += 2;
  if (page.visibleTextSnippet.length > 240) score += 1;
  if (page.crawlDepth === 0) score += 2;
  if (page.crawlDepth > 3) score -= 4;
  score = Math.max(1, Math.min(100, score));
  return { score, scoreReason: reason };
}

export function sortPagesByScore(pages: WebsitePageRank[]) {
  return pages.slice().sort((left, right) => right.score - left.score || left.crawlDepth - right.crawlDepth || left.url.localeCompare(right.url));
}

export function buildSelectedTextSnippet(value: string) {
  return truncateText(value, 380);
}

export function summarizeSourceCount(pages: WebsitePageCandidate[]) {
  return {
    total: pages.length,
    lowSignal: pages.filter((page) => isLowSignalPage(page)).length,
  };
}

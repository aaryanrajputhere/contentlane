import { config } from "../../config";
import { normalizeWebsiteInput } from "../workflow";
import {
  buildSelectedTextSnippet,
  normalizePageUrl,
  pageTypeHintFromUrl,
  rootDomainFromUrl,
  toPageCandidate,
  truncateText,
} from "./utils";
import type { WebsitePageCandidate } from "./types";

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

async function firecrawlRequest<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number,
) {
  if (!config.FIRECRAWL_API_KEY) return null;
  const baseUrl = config.FIRECRAWL_BASE_URL.replace(/\/$/, "");
  const { controller, timer } = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Firecrawl request failed with ${response.status}: ${text.slice(0, 240)}`,
      );
    }
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } finally {
    clearTimeout(timer);
  }
}

function extractArray(payload: unknown, keys: string[]) {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

function extractText(payload: unknown, keys: string[]) {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function extractMetaDescription(html: string) {
  const match =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    );
  return match?.[1]?.trim() ?? null;
}

async function syntheticPage(url: string, error?: string) {
  const normalizedUrl = normalizePageUrl(url);
  const parsed = new URL(normalizedUrl);
  const domain = parsed.host.replace(/^www\./i, "");
  const hint = pageTypeHintFromUrl(normalizedUrl);
  const title =
    parsed.pathname === "/"
      ? domain
      : `${domain} ${parsed.pathname.replace(/\//g, " ").trim()}`.trim();
  const description = `${hint} for ${domain}`;
  return {
    url: normalizedUrl,
    title,
    metaDescription: description,
    visibleTextSnippet: buildSelectedTextSnippet(`${title}. ${description}`),
    canonicalUrl: normalizedUrl,
    source: "fallback" as const,
    rawText: `${title}. ${description}`,
    ...(error ? { error } : {}),
  };
}

async function fetchHtmlFallback(url: string, timeoutMs: number) {
  const { controller, timer } = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; ContentLane/1.0)",
      },
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Fallback fetch failed with ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function homepageFromHtml(
  url: string,
  html: string,
  source: "fallback" | "firecrawl",
) {
  const normalizedUrl = normalizePageUrl(url);
  const plainText = stripHtml(html) || normalizedUrl;
  return {
    url: normalizedUrl,
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    visibleTextSnippet: buildSelectedTextSnippet(plainText),
    canonicalUrl: null,
    source,
    rawText: plainText,
  };
}

export async function discoverWebsitePages(website: string) {
  const normalizedWebsite = normalizeWebsiteInput(website);
  const rootDomain = rootDomainFromUrl(normalizedWebsite);
  if (!config.FIRECRAWL_API_KEY) {
    return {
      rootDomain,
      normalizedWebsite,
      candidates: [
        toPageCandidate(
          {
            url: normalizedWebsite,
            title: rootDomain,
            metaDescription: `Homepage for ${rootDomain}`,
            visibleTextSnippet: `Homepage for ${rootDomain}`,
            pageTypeHint: "homepage",
            crawlDepth: 0,
            canonicalUrl: normalizedWebsite,
          },
          normalizedWebsite,
        ),
      ].filter((candidate): candidate is WebsitePageCandidate =>
        Boolean(candidate),
      ),
    };
  }

  let links: unknown[] = [];
  try {
    const mapPayload = await firecrawlRequest<Record<string, unknown>>(
      "/map",
      {
        url: normalizedWebsite,
        ignoreSitemap: false,
        includeSubdomains: false,
        limit: 60,
      },
      config.FIRECRAWL_TIMEOUT_MS,
    );
    links = extractArray(mapPayload, ["links", "data", "urls"]) ?? [];
  } catch (error) {
    console.warn(
      `[website-intelligence] Firecrawl /map failed for ${normalizedWebsite}; falling back to homepage discovery`,
      error instanceof Error ? error.message : error,
    );
    links = [];
  }

  const homepageCandidate = toPageCandidate(
    {
      url: normalizedWebsite,
      title: rootDomain,
      metaDescription: `Homepage for ${rootDomain}`,
      visibleTextSnippet: `Homepage for ${rootDomain}`,
      pageTypeHint: "homepage",
      crawlDepth: 0,
      canonicalUrl: normalizedWebsite,
    },
    normalizedWebsite,
  );
  const rootPage = await scrapePage(normalizedWebsite, { allowFallback: true });
  const candidates: WebsitePageCandidate[] = homepageCandidate
    ? [homepageCandidate]
    : [];
  if (rootPage) {
    candidates.push({
      url: rootPage.url,
      title: rootPage.title,
      metaDescription: rootPage.metaDescription,
      visibleTextSnippet: rootPage.visibleTextSnippet,
      pageTypeHint: "homepage",
      crawlDepth: 0,
      canonicalUrl: rootPage.canonicalUrl,
    });
  }
  for (const link of links) {
    if (typeof link === "string") {
      const candidate = toPageCandidate(
        {
          url: link,
          visibleTextSnippet: link,
          pageTypeHint: pageTypeHintFromUrl(link),
        },
        normalizedWebsite,
      );
      if (candidate) candidates.push(candidate);
      continue;
    }
    if (typeof link !== "object" || link === null) continue;
    const record = link as Record<string, unknown>;
    const candidate = toPageCandidate(
      {
        url: String(record.url ?? record.loc ?? record.link ?? ""),
        title:
          typeof record.title === "string"
            ? record.title
            : typeof record.name === "string"
              ? record.name
              : null,
        metaDescription:
          typeof record.description === "string"
            ? record.description
            : typeof record.metaDescription === "string"
              ? record.metaDescription
              : null,
        visibleTextSnippet:
          typeof record.description === "string"
            ? record.description
            : typeof record.text === "string"
              ? record.text
              : typeof record.title === "string"
                ? record.title
                : null,
        pageTypeHint:
          typeof record.pageTypeHint === "string"
            ? record.pageTypeHint
            : pageTypeHintFromUrl(
                String(record.url ?? ""),
                typeof record.title === "string" ? record.title : null,
              ),
        canonicalUrl:
          typeof record.canonical === "string"
            ? record.canonical
            : typeof record.canonicalUrl === "string"
              ? record.canonicalUrl
              : null,
      },
      normalizedWebsite,
    );
    if (candidate) candidates.push(candidate);
  }
  return { rootDomain, normalizedWebsite, candidates };
}

export async function scrapePage(
  url: string,
  options?: { allowFallback?: boolean },
) {
  const normalizedUrl = normalizePageUrl(url);
  console.log(`[scrape] url=${normalizedUrl}`);
  const buildHomepageFallback = async (error?: unknown) => {
    try {
      const htmlFallback = await fetchHtmlFallback(
        normalizedUrl,
        config.FIRECRAWL_TIMEOUT_MS,
      );
      return homepageFromHtml(normalizedUrl, htmlFallback, "fallback");
    } catch (fallbackError) {
      return syntheticPage(
        normalizedUrl,
        error instanceof Error
          ? error.message
          : fallbackError instanceof Error
            ? fallbackError.message
            : "Unable to extract page content",
      );
    }
  };

  if (!config.FIRECRAWL_API_KEY) {
    console.log('[scrape] no Firecrawl key, using fallback');
    return buildHomepageFallback();
  }

  let firecrawlPayload: Record<string, unknown> | null = null;
  try {
    firecrawlPayload = await firecrawlRequest<Record<string, unknown>>(
      "/scrape",
      {
        url: normalizedUrl,
        formats: ["markdown", "html"],
        onlyMainContent: true,
        waitFor: 2000,
      },
      config.FIRECRAWL_TIMEOUT_MS,
    );
  } catch (scrapeError) {
    console.warn('[scrape] firecrawl failed:', scrapeError instanceof Error ? scrapeError.message : scrapeError);
    firecrawlPayload = null;
  }

  const firecrawlData =
    firecrawlPayload &&
    typeof firecrawlPayload === "object" &&
    firecrawlPayload !== null &&
    "data" in firecrawlPayload
      ? (firecrawlPayload as Record<string, unknown>).data
      : firecrawlPayload;
  const markdown = extractText(firecrawlData, ["markdown", "content", "text"]);
  const html = extractText(firecrawlData, ["html"]);
  const metadata =
    typeof firecrawlData === "object" &&
    firecrawlData !== null &&
    "metadata" in firecrawlData &&
    typeof (firecrawlData as Record<string, unknown>).metadata === "object"
      ? ((firecrawlData as Record<string, unknown>).metadata as Record<
          string,
          unknown
        >)
      : null;
  const title =
    extractText(firecrawlData, ["title"]) ??
    (typeof metadata?.title === "string" ? metadata.title : null);
  const description =
    extractText(firecrawlData, ["description", "metaDescription"]) ??
    (typeof metadata?.description === "string"
      ? metadata.description
      : typeof metadata?.metaDescription === "string"
        ? metadata.metaDescription
        : null);
  const canonicalUrl =
    typeof metadata?.canonicalUrl === "string"
      ? metadata.canonicalUrl
      : typeof metadata?.canonical === "string"
        ? metadata.canonical
        : null;
  if (markdown || html) {
    const plainText = markdown
      ? markdownToPlainText(markdown)
      : stripHtml(html ?? "");
    const result = {
      url: canonicalUrl ? normalizePageUrl(canonicalUrl) : normalizedUrl,
      title: title ?? (html ? extractTitle(html) : null),
      metaDescription:
        description ?? (html ? extractMetaDescription(html) : null),
      visibleTextSnippet: buildSelectedTextSnippet(plainText || normalizedUrl),
      canonicalUrl,
      source: "firecrawl" as const,
      rawText: plainText || normalizedUrl,
    };
    console.log(`[scrape] done source=firecrawl title="${result.title}" text=${result.rawText.length}chars`);
    return result;
  }
  console.log('[scrape] no content from firecrawl, trying fallback');
  if (!options?.allowFallback) return null;
  return buildHomepageFallback();
}

export async function scrapeSelectedPages(urls: string[]) {
  const results = [] as Array<Awaited<ReturnType<typeof scrapePage>>>;
  for (const url of urls) {
    results.push(await scrapePage(url, { allowFallback: true }));
  }
  return results;
}

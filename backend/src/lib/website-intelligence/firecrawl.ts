import { config } from "../../config";
import {
  buildSelectedTextSnippet,
  normalizePageUrl,
} from "./utils";
import type { AnalysisJsonRecorder } from "../analysis-json";
import { errorJson } from "../analysis-json";

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
  const title =
    parsed.pathname === "/"
      ? domain
      : `${domain} ${parsed.pathname.replace(/\//g, " ").trim()}`.trim();
  const description = `Homepage for ${domain}`;
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

export async function scrapePage(
  url: string,
  options?: { allowFallback?: boolean; recorder?: AnalysisJsonRecorder },
) {
  const normalizedUrl = normalizePageUrl(url);
  const recorder = options?.recorder;
  console.log(`[scrape] url=${normalizedUrl}`);
  const buildHomepageFallback = async (error?: unknown) => {
    try {
      await recorder?.write('html-fallback-request', { url: normalizedUrl });
      const htmlFallback = await fetchHtmlFallback(
        normalizedUrl,
        config.FIRECRAWL_TIMEOUT_MS,
      );
      await recorder?.write('html-fallback-response', {
        url: normalizedUrl,
        html: htmlFallback,
      });
      const page = homepageFromHtml(normalizedUrl, htmlFallback, "fallback");
      await recorder?.write('normalized-scrape-result', page);
      return page;
    } catch (fallbackError) {
      await recorder?.write('html-fallback-error', errorJson(fallbackError));
      const page = await syntheticPage(
        normalizedUrl,
        error instanceof Error
          ? error.message
          : fallbackError instanceof Error
            ? fallbackError.message
            : "Unable to extract page content",
      );
      await recorder?.write('synthetic-fallback', page);
      return page;
    }
  };

  if (!config.FIRECRAWL_API_KEY) {
    console.log('[scrape] no Firecrawl key, using fallback');
    await recorder?.write('firecrawl-request', {
      skipped: true,
      url: normalizedUrl,
      reason: 'No Firecrawl API key is configured',
    });
    return buildHomepageFallback();
  }

  let firecrawlPayload: Record<string, unknown> | null = null;
  const firecrawlBody = {
    url: normalizedUrl,
    formats: ["markdown", "html"],
    onlyMainContent: true,
    waitFor: 2000,
  };
  await recorder?.write('firecrawl-request', {
    path: '/scrape',
    body: firecrawlBody,
    timeoutMs: config.FIRECRAWL_TIMEOUT_MS,
  });
  try {
    firecrawlPayload = await firecrawlRequest<Record<string, unknown>>(
      "/scrape",
      firecrawlBody,
      config.FIRECRAWL_TIMEOUT_MS,
    );
    await recorder?.write('firecrawl-response', firecrawlPayload);
  } catch (scrapeError) {
    console.warn('[scrape] firecrawl failed:', scrapeError instanceof Error ? scrapeError.message : scrapeError);
    await recorder?.write('firecrawl-error', errorJson(scrapeError));
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
    await recorder?.write('normalized-scrape-result', result);
    return result;
  }
  console.log('[scrape] no content from firecrawl, trying fallback');
  if (!options?.allowFallback) return null;
  return buildHomepageFallback();
}

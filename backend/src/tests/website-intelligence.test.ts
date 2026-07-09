import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupePageCandidates, normalizePageUrl, scorePageLocally } from '../lib/website-intelligence/utils';

const pages = [
  {
    url: 'https://example.com/',
    title: 'Home',
    metaDescription: 'Homepage',
    visibleTextSnippet: 'A simple homepage',
    pageTypeHint: 'homepage',
    crawlDepth: 0,
  },
  {
    url: 'https://example.com/pricing',
    title: 'Pricing',
    metaDescription: 'Plans and pricing',
    visibleTextSnippet: 'Pricing page',
    pageTypeHint: 'pricing',
    crawlDepth: 1,
  },
  {
    url: 'https://example.com/privacy',
    title: 'Privacy',
    metaDescription: 'Privacy policy',
    visibleTextSnippet: 'Legal page',
    pageTypeHint: 'low-signal',
    crawlDepth: 1,
  },
  {
    url: 'https://example.com/pricing/',
    title: 'Pricing duplicate',
    metaDescription: 'Duplicate pricing',
    visibleTextSnippet: 'More pricing details',
    pageTypeHint: 'pricing',
    crawlDepth: 1,
  },
] as const;



test('website intelligence pipeline scrapes only the homepage and does not rank pages', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-firecrawl';
  process.env.FIRECRAWL_BASE_URL = 'https://firecrawl.test/v2';
  process.env.FIRECRAWL_TIMEOUT_MS = '5000';
  process.env.OPENAI_API_KEY = 'test-openai';

  const originalFetch = globalThis.fetch;
  let scrapeCalls = 0;
  let mapCalls = 0;
  let runpodCalls = 0;
  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const bodyText = typeof init?.body === 'string' ? init.body : '';

    if (url.includes('/map')) {
      mapCalls += 1;
      throw new Error('Firecrawl /map should not be called');
    }

    if (url.includes('/scrape')) {
      scrapeCalls += 1;
      return new Response(JSON.stringify({
        data: {
          markdown: '# Acme\nAcme helps teams ship faster.',
          metadata: {
            canonicalUrl: 'https://acme.test/',
            title: 'Acme',
            description: 'Acme helps teams ship faster.',
          },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    if (url.includes('api.openai.com')) {
      runpodCalls += 1;
      const payload = bodyText ? JSON.parse(bodyText) as { messages?: { role: string; content: string }[] } : {};
      const prompt = payload.messages?.map(m => m.content).join('\n') ?? '';
      if (prompt.includes('rank website pages') || prompt.includes('selectedPages') || prompt.includes('crawlSummary')) {
        throw new Error('Ranking prompt should not be sent');
      }
      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                brandName: 'Acme',
                tagline: 'Ship faster with Acme',
                audience: 'Teams that need a clearer workflow',
                painPoints: ['Slow launches'],
                benefits: ['Faster shipping'],
                voice: 'Direct, practical',
                offer: 'Workflow software',
                cta: 'Book a demo',
                angles: ['Speed to launch', 'Clear positioning'],
                summary: 'Acme helps teams ship faster with a clearer workflow.',
              })
            }
          }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    throw new Error(`Unexpected fetch: ${url}${bodyText ? ` body=${bodyText}` : ''}`);
  };
  globalThis.fetch = mockFetch as typeof fetch;

  try {
    const { runWebsiteIntelligencePipeline } = await import('../lib/website-intelligence/pipeline.js');
    const result = await runWebsiteIntelligencePipeline('https://acme.test');
    assert.equal(mapCalls, 0);
    assert.equal(scrapeCalls, 1);
    assert.equal(runpodCalls, 1);
    assert.equal(result.analysis.sourceUrl, 'https://acme.test');
    assert.equal(result.analysis.homepage.url, 'https://acme.test');
    assert.equal(result.analysis.homepage.extractionSource, 'firecrawl');
    assert.equal(result.analysis.homepage.extractionStatus, 'success');
    assert.ok(result.analysis.homepage.extractedTextSnippet?.includes('Acme helps teams ship faster'));
    assert.equal(result.brandProfile.brandName, 'Acme');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('website intelligence pipeline falls back to homepage html when Firecrawl scrape fails', async () => {
  process.env.FIRECRAWL_API_KEY = 'test-firecrawl';
  process.env.FIRECRAWL_BASE_URL = 'https://firecrawl.test/v2';
  process.env.FIRECRAWL_TIMEOUT_MS = '5000';

  const originalFetch = globalThis.fetch;
  let mapCalls = 0;
  let scrapeCalls = 0;
  let homepageFetches = 0;
  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const bodyText = typeof init?.body === 'string' ? init.body : '';

    if (url.includes('/map')) {
      mapCalls += 1;
      throw new Error('Firecrawl /map should not be called');
    }

    if (url.includes('/scrape')) {
      scrapeCalls += 1;
      return new Response('temporary failure', { status: 500, headers: { 'content-type': 'text/plain' } });
    }

    if (url === 'https://acme.test' || url === 'https://acme.test/') {
      homepageFetches += 1;
      return new Response(`<!doctype html>
<html>
  <head>
    <title>Acme</title>
    <meta name="description" content="Acme helps teams ship faster." />
  </head>
  <body>
    <h1>Acme helps teams ship faster.</h1>
  </body>
</html>`, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    throw new Error(`Unexpected fetch: ${url}${bodyText ? ` body=${bodyText}` : ''}`);
  };
  globalThis.fetch = mockFetch as typeof fetch;

  try {
    const { runWebsiteIntelligencePipeline } = await import('../lib/website-intelligence/pipeline.js');
    const result = await runWebsiteIntelligencePipeline('https://acme.test');
    assert.equal(mapCalls, 0);
    assert.equal(scrapeCalls, 1);
    assert.equal(homepageFetches, 1);
    assert.equal(result.analysis.homepage.extractionSource, 'fallback');
    assert.equal(result.analysis.homepage.extractionStatus, 'success');
    assert.equal(result.analysis.homepage.title, 'Acme');
    assert.equal(result.analysis.homepage.metaDescription, 'Acme helps teams ship faster.');
    assert.equal(result.brandProfile.brandName, 'Acme');
    assert.ok(result.brandProfile.summary.includes('Acme'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

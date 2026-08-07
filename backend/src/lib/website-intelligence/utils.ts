function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export const HOMEPAGE_EVIDENCE_MAX_CHARS = 3000;

export function truncateText(value: string, maxLength: number) {
  const trimmed = collapseWhitespace(value);
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function normalizePageUrl(value: string, baseUrl?: string | null) {
  const parsed = new URL(value, baseUrl ?? undefined);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  const removableParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid', 'ref', 'source', 'cmp'];
  for (const key of removableParams) parsed.searchParams.delete(key);
  const remaining = Array.from(parsed.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  parsed.search = '';
  for (const [key, currentValue] of remaining) parsed.searchParams.append(key, currentValue);
  const path = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  parsed.pathname = path === '' ? '/' : path;
  const normalized = parsed.toString();
  return parsed.pathname === '/' && parsed.search === '' ? normalized.replace(/\/$/, '') : normalized;
}

export function buildSelectedTextSnippet(value: string, maxLength = 380) {
  return truncateText(value, maxLength);
}

export const PENDING_WEBSITE_KEY = 'contentlane.pendingWebsite';

export function normalizePendingWebsite(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function savePendingWebsite(value) {
  const normalized = normalizePendingWebsite(value);
  if (normalized) sessionStorage.setItem(PENDING_WEBSITE_KEY, normalized);
  return normalized;
}

export function getPendingWebsite() {
  const stored = sessionStorage.getItem(PENDING_WEBSITE_KEY);
  return stored ? normalizePendingWebsite(stored) : null;
}

export function clearPendingWebsite() {
  sessionStorage.removeItem(PENDING_WEBSITE_KEY);
}

export function isFreeConversionRequired({ isFreeFlow, ended, selected, generated, reviewed, limit = 24 }) {
  return isFreeFlow && (ended || selected >= 8 || (generated >= limit && reviewed >= generated));
}

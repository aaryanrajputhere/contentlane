import { config } from '../config';
import { ApiError } from './errors';

type QueryValue = string | number | boolean | undefined;

function configured() {
  if (!config.ZERNIO_API_KEY) {
    throw new ApiError(503, 'ZERNIO_NOT_CONFIGURED', 'TikTok publishing is not configured yet');
  }
}

function urlFor(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${config.ZERNIO_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

function errorMessage(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['error', 'message', 'errorMessage']) {
    if (typeof record[key] === 'string') return record[key];
  }
  return null;
}

export async function zernioRequest<T>(path: string, init: RequestInit = {}, query?: Record<string, QueryValue>): Promise<T> {
  configured();
  let response: Response;
  try {
    response = await fetch(urlFor(path, query), {
      ...init,
      headers: {
        Authorization: `Bearer ${config.ZERNIO_API_KEY}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError(503, 'ZERNIO_UNAVAILABLE', 'TikTok publishing is temporarily unavailable');
  }
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new ApiError(retryable ? 503 : response.status, 'ZERNIO_REQUEST_FAILED', errorMessage(data) ?? 'TikTok rejected the request');
  }
  return data as T;
}

export function createZernioProfile(name: string, idempotencyKey: string) {
  return zernioRequest<{ profile: { _id: string } }>('/v1/profiles', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ name }),
  });
}

export function getTikTokConnectUrl(profileId: string, redirectUrl: string) {
  return zernioRequest<{ authUrl: string }>('/v1/connect/tiktok', {}, { profileId, redirect_url: redirectUrl });
}

export function listZernioAccounts(profileId: string) {
  return zernioRequest<{ accounts?: unknown[] }>('/v1/accounts', {}, { profileId, platform: 'tiktok' });
}

export function deleteZernioAccount(accountId: string) {
  return zernioRequest<unknown>(`/v1/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
}

export function listTikTokMusic(accountId: string, countryCode: string) {
  return zernioRequest<{ tracks?: unknown[] }>(`/v1/accounts/${encodeURIComponent(accountId)}/tiktok/commercial-music`, {}, { countryCode });
}

export function getTikTokCreatorInfo(accountId: string) {
  return zernioRequest<unknown>(`/v1/accounts/${encodeURIComponent(accountId)}/tiktok/creator-info`, {}, { mediaType: 'video' });
}

export function validateZernioMedia(url: string) {
  return zernioRequest<unknown>('/v1/tools/validate/media', { method: 'POST', body: JSON.stringify({ url }) });
}

export function validateZernioPost(body: Record<string, unknown>) {
  return zernioRequest<unknown>('/v1/tools/validate/post', { method: 'POST', body: JSON.stringify(body) });
}

export function createZernioPost(body: Record<string, unknown>, idempotencyKey: string) {
  return zernioRequest<unknown>('/v1/posts', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
}

export function getZernioAnalytics(postId: string) {
  return zernioRequest<unknown>('/v1/analytics', {}, { postId });
}

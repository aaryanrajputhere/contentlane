import { authUnauthorizedEvent } from './auth-events';

const productionApiBase = 'https://contentlane-backend-aaryanrajputheres-projects.vercel.app';
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? productionApiBase : '');

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public requestId?: string,
    public status?: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const isBinaryBody = typeof Blob !== 'undefined' && init.body instanceof Blob;
  const isUrlSearchParams = typeof URLSearchParams !== 'undefined' && init.body instanceof URLSearchParams;
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body && !isFormData && !isBinaryBody && !isUrlSearchParams ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string; requestId?: string } };
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/signup')) {
      window.dispatchEvent(new Event(authUnauthorizedEvent));
    }
    throw new ApiClientError(data.error?.code ?? 'REQUEST_FAILED', data.error?.message ?? 'Request failed', data.error?.requestId, response.status);
  }
  return data as T;
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export async function waitForJob<T>(jobId: string, onProgress?: (progress: number, message: string | null) => void): Promise<T> {
  let delay = 500;
  for (;;) {
    const { job } = await api<{ job: import('../types/domain').GenerationJob }>(`/jobs/${jobId}`);
    onProgress?.(job.progress, job.progressMessage);
    if (job.status === 'COMPLETED') return job.result as T;
    if (job.status === 'FAILED' || job.status === 'CANCELLED') throw new ApiClientError(job.status, job.errorMessage ?? `Job ${job.status.toLowerCase()}`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(4000, Math.round(delay * 1.5));
  }
}

const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

const STORAGE_KEY = 'moometrics_user';
const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** Dispatched when the API returns 401; AuthContext listens and logs out. */
export const UNAUTHORIZED_EVENT = 'moometrics:unauthorized';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True for network failure / timeout (no HTTP response was received). */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isUpload = options?.body instanceof FormData;
  // Don't set Content-Type for FormData — the browser sets it with the boundary.
  if (!isUpload) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutMs = isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        0,
        'Request timed out — this was NOT saved. Check your connection and try again.'
      );
    }
    throw new ApiError(
      0,
      'Network error — you may be offline. This was NOT saved; try again once reconnected.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    // Token is missing/expired/invalid — drop the session and notify the app.
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiUrl = (path: string) => `${BASE}${path}`;

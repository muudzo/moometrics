const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** Dispatched when a request is unauthorized and refresh fails; AuthContext logs out. */
export const UNAUTHORIZED_EVENT = 'moometrics:unauthorized';

/**
 * The access token lives in memory only (never localStorage) so it is not
 * exposed to XSS. The refresh token is an httpOnly cookie the browser sends
 * automatically; on a 401 we silently refresh and retry once.
 */
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SessionInfo {
  access_token: string;
  role: 'manager' | 'employee';
  user_id: number;
  username: string;
  farm_id: number;
  farm_name: string;
}

/**
 * Restore a session on app load using the refresh cookie. Returns the session
 * (and primes the in-memory access token) or null when there is no valid
 * session. Used by AuthContext on mount instead of persisting tokens in JS.
 */
export async function restoreSession(): Promise<SessionInfo | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data: SessionInfo = await res.json();
    accessToken = data.access_token;
    return data;
  } catch {
    return null;
  }
}

/**
 * FastAPI returns `detail` as a string for HTTPExceptions but as a list of
 * error objects for 422 validation failures — flatten the latter into a
 * human-readable message (dropping pydantic's "Value error, " prefix).
 */
function formatErrorDetail(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) =>
        entry && typeof entry === 'object' && 'msg' in entry
          ? String((entry as { msg: unknown }).msg).replace(/^Value error, /, '')
          : null
      )
      .filter((msg): msg is string => msg !== null);
    if (messages.length > 0) return messages.join('; ');
  }
  return null;
}

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

async function rawFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const isUpload = options?.body instanceof FormData;
  if (!isUpload && options?.body) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timeoutMs = isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
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
}

// Coalesce concurrent refreshes so a burst of 401s triggers a single /refresh.
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return false;
        const data = await res.json();
        accessToken = data.access_token;
        return true;
      } catch {
        return false;
      }
    })();
    void refreshing.finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res = await rawFetch(path, options);

  // A 401 from an auth endpoint (e.g. wrong password on login) is a normal
  // request failure — fall through so the server's message is surfaced. Only
  // a 401 elsewhere means an expired session: silently refresh, replay once,
  // and log out if the refresh itself fails.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    if (await refreshSession()) res = await rawFetch(path, options);
    if (res.status === 401) {
      accessToken = null;
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, formatErrorDetail(body.detail) ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Download an authenticated file (e.g. CSV export) and trigger a save dialog. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  let res = await rawFetch(path, { method: 'GET' });
  if (res.status === 401 && (await refreshSession())) {
    res = await rawFetch(path, { method: 'GET' });
  }
  if (!res.ok) throw new ApiError(res.status, `Download failed (HTTP ${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Resolve a stored image reference to a loadable URL (absolute for S3/R2). */
export const resolveAssetUrl = (path: string): string =>
  /^https?:\/\//.test(path) ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;

export const apiUrl = (path: string) => `${BASE}${path}`;

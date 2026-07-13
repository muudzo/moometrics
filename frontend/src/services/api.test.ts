import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError, setAccessToken, UNAUTHORIZED_EVENT } from '@/services/api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  setAccessToken(null);
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('returns parsed JSON on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    await expect(apiFetch('/x')).resolves.toEqual({ ok: true });
  });

  it('maps an error response to ApiError with the server detail', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(409, { detail: 'Tag taken' }));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 409, message: 'Tag taken' });
  });

  it('formats a FastAPI 422 validation detail array into a readable message', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(422, {
        detail: [
          {
            type: 'value_error',
            loc: ['body', 'password'],
            msg: 'Value error, Password must contain at least one uppercase letter',
          },
        ],
      })
    );
    await expect(apiFetch('/api/auth/signup', { method: 'POST' })).rejects.toMatchObject({
      status: 422,
      message: 'Password must contain at least one uppercase letter',
    });
  });

  it('reports a network failure as an offline ApiError (status 0)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('network down'));
    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).isOffline).toBe(true);
  });

  it('silently refreshes and replays the request on a 401', async () => {
    setAccessToken('expired');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'expired' })) // original
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh' })) // refresh
      .mockResolvedValueOnce(jsonResponse(200, { ok: true })); // replay
    global.fetch = fetchMock;

    await expect(apiFetch('/api/animals')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/auth/refresh');
  });

  it('does not attempt to refresh for auth endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { detail: 'bad creds' }));
    global.fetch = fetchMock;
    await expect(apiFetch('/api/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the server detail on a login 401 instead of "session expired"', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { detail: 'Invalid username or password' }));
    await expect(apiFetch('/api/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password',
    });
  });

  it('does not dispatch the unauthorized (logout) event on a login 401', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { detail: 'bad creds' }));
    const onUnauthorized = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    await apiFetch('/api/auth/login', { method: 'POST' }).catch(() => {});
    window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('throws "session expired" and dispatches logout when refresh fails on a 401', async () => {
    setAccessToken('expired');
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'expired' })) // original
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'no cookie' })); // refresh fails
    const onUnauthorized = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    await expect(apiFetch('/api/animals')).rejects.toMatchObject({
      status: 401,
      message: 'Your session has expired. Please sign in again.',
    });
    window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

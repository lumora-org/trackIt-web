import { describe, expect, it } from 'vitest';

import {
  buildQuery,
  configureApiClient,
  getAccessToken,
  resetApiClientForTests,
  resolveUrl,
  setAccessToken,
  unwrapEnvelope,
  apiClient,
} from './client';
import { ApiError } from './errors';

describe('buildQuery', () => {
  it('serialises primitives and skips empties', () => {
    expect(buildQuery({ page: 1, limit: 20, search: '', status: undefined, branchId: null })).toBe(
      '?page=1&limit=20',
    );
  });

  it('joins array values with commas', () => {
    expect(buildQuery({ type: ['REPORT_SUBMITTED', 'LOW_INVENTORY'] })).toBe(
      '?type=REPORT_SUBMITTED%2CLOW_INVENTORY',
    );
  });

  it('returns an empty string when there is nothing to send', () => {
    expect(buildQuery()).toBe('');
    expect(buildQuery({})).toBe('');
  });
});

describe('unwrapEnvelope', () => {
  it('unwraps the doc 04 §6 single-resource envelope', () => {
    expect(unwrapEnvelope<{ id: string }>({ data: { id: 'a' } }).data).toEqual({ id: 'a' });
  });

  it('unwraps the doc 04 §6 collection envelope and keeps meta', () => {
    const { data, meta } = unwrapEnvelope<number[]>({
      data: [1, 2, 3],
      meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
    });
    expect(data).toEqual([1, 2, 3]);
    expect(meta).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
  });

  it('tolerates the doc 02 §37 shape with success/message', () => {
    const body = { success: true, message: 'Sale recorded successfully', data: { id: 's1' } };
    expect(unwrapEnvelope<{ id: string }>(body).data).toEqual({ id: 's1' });
  });

  it('returns a bare array untouched', () => {
    expect(unwrapEnvelope<number[]>([1, 2]).data).toEqual([1, 2]);
  });

  it('handles a 204 null body', () => {
    expect(unwrapEnvelope(null).data).toBeNull();
  });
});

describe('resolveUrl', () => {
  it('applies the mandatory /api/v1 prefix (doc 04 §2.1)', () => {
    resetApiClientForTests();
    configureApiClient({ baseUrl: 'http://api.test:4000' });
    expect(resolveUrl('/auth/login')).toBe('http://api.test:4000/api/v1/auth/login');
  });

  it('does not double-prefix a path that already includes it', () => {
    resetApiClientForTests();
    configureApiClient({ baseUrl: 'http://api.test:4000' });
    expect(resolveUrl('/api/v1/inventory')).toBe('http://api.test:4000/api/v1/inventory');
  });

  it('tolerates a trailing slash on the base URL', () => {
    resetApiClientForTests();
    configureApiClient({ baseUrl: 'http://api.test:4000/' });
    expect(resolveUrl('/sales')).toBe('http://api.test:4000/api/v1/sales');
  });

  it('produces an absolute URL when the base is empty (mock mode)', () => {
    resetApiClientForTests();
    configureApiClient({ baseUrl: '' });
    // Relative URLs are rejected by fetch outside a browser, so the current
    // origin must be used rather than emitting a bare path.
    expect(resolveUrl('/auth/login')).toBe(`${window.location.origin}/api/v1/auth/login`);
  });

  it('appends the query string', () => {
    resetApiClientForTests();
    configureApiClient({ baseUrl: 'http://api.test:4000' });
    expect(resolveUrl('/sales', '?page=2&limit=50')).toBe(
      'http://api.test:4000/api/v1/sales?page=2&limit=50',
    );
  });
});

describe('access token store', () => {
  it('stores and clears the in-memory access token', () => {
    resetApiClientForTests();
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe('apiClient authorization', () => {
  it('sends the Bearer header and never sends it when skipAuth is set', async () => {
    resetApiClientForTests();
    const calls: Array<{ url: string; headers: HeadersInit }> = [];
    configureApiClient({
      baseUrl: 'http://api.test',
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), headers: (init?.headers ?? {}) as HeadersInit });
        return new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    setAccessToken('token-123');

    await apiClient.get('/auth/me');
    expect(new Headers(calls[0]!.headers).get('Authorization')).toBe('Bearer token-123');

    await apiClient.get('/fuel-types', { skipAuth: true });
    expect(new Headers(calls[1]!.headers).get('Authorization')).toBeNull();
  });

  it('sets Content-Type only when there is a body', async () => {
    resetApiClientForTests();
    const headers: Array<Headers> = [];
    configureApiClient({
      baseUrl: 'http://api.test',
      fetchImpl: async (_input, init) => {
        headers.push(new Headers(init?.headers as HeadersInit));
        return new Response(JSON.stringify({ data: null }), { status: 200 });
      },
    });

    await apiClient.get('/inventory');
    expect(headers[0]!.get('Content-Type')).toBeNull();

    await apiClient.post('/sales', { litresSold: 100 });
    expect(headers[1]!.get('Content-Type')).toBe('application/json');
  });

  it('passes the Idempotency-Key header for financial writes (doc 04 §103)', async () => {
    resetApiClientForTests();
    let seen: string | null = null;
    configureApiClient({
      baseUrl: 'http://api.test',
      fetchImpl: async (_input, init) => {
        seen = new Headers(init?.headers as HeadersInit).get('Idempotency-Key');
        return new Response(JSON.stringify({ data: { id: 's1' } }), { status: 201 });
      },
    });

    await apiClient.post('/sales', { litresSold: 100 }, { idempotencyKey: 'key-abc' });
    expect(seen).toBe('key-abc');
  });
});

/**
 * Session recovery after a page reload.
 *
 * The access token is memory-only, so F5 always starts with none and the first
 * `/auth/me` always 401s. The httpOnly refresh cookie is the only thing that can
 * bring the session back — which is exactly what used to be blocked by skipping
 * the refresh for every `/auth/*` path, logging the user out on each reload.
 */
describe('401 refresh-and-retry', () => {
  interface Call {
    path: string;
    auth: string | null;
  }

  const unauthorized = {
    statusCode: 401,
    code: 'AUTH_TOKEN_EXPIRED',
    message: 'Your session has expired. Please sign in again.',
  };

  /** Routes by API path (prefix stripped) and records every call made. */
  function recordingFetch(
    route: (path: string, auth: string | null) => { status: number; body?: unknown },
    calls: Call[],
  ): typeof fetch {
    return async (input, init) => {
      const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, '');
      const auth = new Headers(init?.headers as HeadersInit).get('Authorization');
      calls.push({ path, auth });
      const res = route(path, auth);
      return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }

  it('re-establishes the session on a hard refresh instead of logging out', async () => {
    resetApiClientForTests();
    const calls: Call[] = [];
    configureApiClient({
      baseUrl: 'http://api.test',
      onSessionExpired: undefined,
      fetchImpl: recordingFetch((path, auth) => {
        if (path === '/auth/refresh') {
          return { status: 200, body: { data: { accessToken: 'fresh-token', expiresIn: 900 } } };
        }
        if (path === '/auth/me') {
          return auth === 'Bearer fresh-token'
            ? { status: 200, body: { data: { id: 'u1', email: 'manager@kbyglobal.com' } } }
            : { status: 401, body: unauthorized };
        }
        return { status: 200, body: { data: null } };
      }, calls),
    });

    // No access token in memory: the exact state of a reloaded tab.
    const user = await apiClient.get<{ id: string }>('/auth/me');

    expect(user).toEqual({ id: 'u1', email: 'manager@kbyglobal.com' });
    expect(calls.map((call) => call.path)).toEqual(['/auth/me', '/auth/refresh', '/auth/me']);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('shares a single refresh between concurrent 401s', async () => {
    resetApiClientForTests();
    const calls: Call[] = [];
    configureApiClient({
      baseUrl: 'http://api.test',
      onSessionExpired: undefined,
      fetchImpl: recordingFetch((path, auth) => {
        if (path === '/auth/refresh') {
          return { status: 200, body: { data: { accessToken: 'fresh-token' } } };
        }
        // Only the replayed request, carrying the new token, is allowed through.
        return auth === 'Bearer fresh-token'
          ? { status: 200, body: { data: [] } }
          : { status: 401, body: unauthorized };
      }, calls),
    });

    setAccessToken('stale-token');
    await Promise.all([apiClient.get('/notifications'), apiClient.list('/sales')]);

    expect(calls.filter((call) => call.path === '/auth/refresh')).toHaveLength(1);
  });

  it('never refreshes when the endpoint itself rejected the credentials', async () => {
    resetApiClientForTests();
    const calls: Call[] = [];
    configureApiClient({
      baseUrl: 'http://api.test',
      onSessionExpired: undefined,
      fetchImpl: recordingFetch((path) => {
        if (path === '/auth/login') {
          return {
            status: 401,
            body: { ...unauthorized, code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' },
          };
        }
        return { status: 200, body: { data: null } };
      }, calls),
    });

    // A wrong password must keep saying "invalid email or password", not quietly
    // rotate the session and re-POST the credentials.
    const err: unknown = await apiClient
      .post('/auth/login', { email: 'a@b.com', password: 'wrong' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe('Invalid email or password.');
    expect(calls.map((call) => call.path)).toEqual(['/auth/login']);
  });

  it('ends the session when the refresh cannot recover it', async () => {
    resetApiClientForTests();
    const calls: Call[] = [];
    let expiredCount = 0;
    configureApiClient({
      baseUrl: 'http://api.test',
      onSessionExpired: () => {
        expiredCount += 1;
      },
      fetchImpl: recordingFetch(() => ({ status: 401, body: unauthorized }), calls),
    });

    setAccessToken('stale-token');
    const err: unknown = await apiClient.get('/auth/me').catch((e) => e);

    expect((err as ApiError).statusCode).toBe(401);
    // One attempt, one retry, no loop: a dead cookie is settled after that.
    expect(calls.map((call) => call.path)).toEqual(['/auth/me', '/auth/refresh']);
    expect(expiredCount).toBe(1);
    expect(getAccessToken()).toBeNull();
  });
});

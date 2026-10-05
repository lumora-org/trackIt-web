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

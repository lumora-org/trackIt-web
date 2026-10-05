/**
 * Core HTTP client.
 *
 * Responsibilities (PROMPT.md §22):
 *   base URL · auth header · refresh token · headers · error normalisation ·
 *   request cancellation
 *
 * Deliberately framework-free so it is unit-testable without React.
 */

import { ApiError, normalizeApiError, toApiError } from './errors';
import type { PageMeta } from '@/types/domain';

/** doc 04 — mandatory URI version prefix. */
export const API_PREFIX = '/api/v1';

export const ACCESS_TOKEN_COOKIE = 'kby_access_token';
export const REFRESH_TOKEN_COOKIE = 'kby_refresh_token';

export interface ApiEnvelope<T> {
  data: T;
  meta?: PageMeta;
}

/**
 * Token store. The access token lives in memory only; the refresh token is
 * held in an httpOnly cookie so JavaScript can never read it (PROMPT.md §21).
 *
 * The server is expected to set the refresh cookie. For the local mock we can
 * also set a readable value, which `getRefreshToken` prefers when present.
 */
interface TokenStore {
  accessToken: string | null;
}

const tokenStore: TokenStore = { accessToken: null };

export function setAccessToken(token: string | null): void {
  tokenStore.accessToken = token;
}

export function getAccessToken(): string | null {
  return tokenStore.accessToken;
}

export type TokenReader = () => string | null;

let refreshTokenReader: TokenReader | null = null;

/** Registered by the auth provider so the client can refresh without importing it. */
export function setRefreshTokenReader(reader: TokenReader | null): void {
  refreshTokenReader = reader;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Notified when the session cannot be recovered and the user must re-login. */
  onSessionExpired?: () => void;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

let config: ApiClientConfig = { baseUrl: DEFAULT_BASE_URL };

export function configureApiClient(next: Partial<ApiClientConfig>): void {
  config = { ...config, ...next };
}

export function getApiBaseUrl(): string {
  return config.baseUrl;
}

/* ------------------------------------------------------------ url helpers */

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>;

export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/* ------------------------------------------------------- envelope unwrapping */

/**
 * Unwrap `{ data }` (doc 04) or `{ success, message, data }` (doc 02).
 * Returns both the payload and pagination meta when present.
 */
export function unwrapEnvelope<T>(body: unknown): ApiEnvelope<T> {
  if (typeof body !== 'object' || body === null) {
    // 204 No Content, or a bare payload.
    return { data: body as T };
  }
  const raw = body as Record<string, unknown>;
  if ('data' in raw) {
    return {
      data: raw.data as T,
      meta: isPageMeta(raw.meta) ? raw.meta : undefined,
    };
  }
  return { data: body as T };
}

function isPageMeta(value: unknown): value is PageMeta {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PageMeta).total === 'number' &&
    typeof (value as PageMeta).page === 'number'
  );
}

/* -------------------------------------------------------------- internals */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * doc 04 §103 — `Idempotency-Key` for financial writes. Applied to
   * POST /sales, /deliveries, /fuel-orders, /inventory/adjustments.
   */
  idempotencyKey?: string;
  /** Set for auth endpoints so a 401 does not trigger a refresh storm. */
  skipAuth?: boolean;
  /** Internal: prevents infinite refresh recursion. */
  isRetry?: boolean;
}

/**
 * Single-flight refresh. Concurrent 401s must not each fire a refresh, which
 * would rotate the refresh token more than once and invalidate the session.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = refreshTokenReader?.();
      const res = await rawRequest('POST', '/auth/refresh', {
        body: refreshToken ? { refreshToken } : {},
        skipAuth: true,
        headers: { 'X-Requested-Refresh': 'true' },
      });

      const { data } = unwrapEnvelope<{ accessToken?: string; access_token?: string }>(res);
      const token = data?.accessToken ?? data?.access_token;
      if (typeof token !== 'string' || token.length === 0) return false;
      setAccessToken(token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function rawRequest(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<unknown> {
  const doFetch = config.fetchImpl ?? fetch;
  const url = `${config.baseUrl}${path}${buildQuery(options.query)}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  // doc 06 §7 — `Authorization: Bearer <access-token>`
  const token = getAccessToken();
  if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  if (options.signal) init.signal = options.signal;

  const res = await doFetch(url, init);

  // 204 No Content (e.g. POST /auth/logout)
  if (res.status === 204) return null;

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw normalizeApiError(res.status, parsed, path);
  }
  return parsed;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return unwrapEnvelope<T>(await execute(path, options)).data;
}

async function requestPaginated<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T[]; meta: PageMeta | null }> {
  const envelope = unwrapEnvelope<T[]>(await execute(path, options));
  const data = Array.isArray(envelope.data) ? envelope.data : [];
  return { data, meta: envelope.meta ?? null };
}

async function execute(path: string, options: RequestOptions): Promise<unknown> {
  try {
    return await rawRequest(options.method ?? 'GET', path, options);
  } catch (err) {
    const apiError = toApiError(err, path);
    if (apiError.isCanceled) throw apiError;

    const isAuthPath = path.startsWith('/auth/');
    const canRefresh =
      apiError.isUnauthorized && !options.isRetry && !options.skipAuth && !isAuthPath;

    if (canRefresh) {
      const recovered = await attemptRefresh();
      if (recovered) {
        return execute(path, { ...options, isRetry: true });
      }
      setAccessToken(null);
      config.onSessionExpired?.();
    }
    throw apiError;
  }
}

/* ---------------------------------------------------------------- public */

export const apiClient = {
  /** Unwraps `{ data }` and returns the payload. */
  async get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' });
  },
  async post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'POST', body });
  },
  async patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'PATCH', body });
  },
  async delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
  /** Returns data + meta for collection endpoints (doc 04 §6). */
  list<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return requestPaginated<T>(path, { ...options, method: 'GET' });
  },
  /** Escape hatch when a route genuinely returns a bare array (e.g. GET /inventory). */
  async raw<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    const body = await execute(path, { ...options, method: 'GET' });
    return unwrapEnvelope<T>(body).data;
  },
};

/** Test helper — clear any in-memory session state. */
export function resetApiClientForTests(): void {
  tokenStore.accessToken = null;
  refreshTokenReader = null;
  refreshInFlight = null;
}

export { ApiError };

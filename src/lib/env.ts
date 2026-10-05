/**
 * Runtime configuration.
 *
 * Only `NEXT_PUBLIC_*` values reach the browser, and none of them may be a
 * secret (PROMPT.md §27). The refresh token lives in an httpOnly cookie set by
 * the backend, so no secret is ever needed here.
 */

const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false';

/**
 * In mock mode MSW serves `/api/v1/*` from the page's own origin, so the base
 * URL must be relative. With a real backend it is an absolute origin.
 */
const apiBaseUrl = useMockApi
  ? ''
  : (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000');

export const env = {
  apiBaseUrl,
  /** Set NEXT_PUBLIC_USE_MOCK_API=false once a backend is available. */
  useMockApi,
  isDev: process.env.NODE_ENV !== 'production',
} as const;

/** doc 04 §2.1 — the version prefix is mandatory on every path. */
export const API_PREFIX = '/api/v1';

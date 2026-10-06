/**
 * Runtime configuration.
 *
 * Only `NEXT_PUBLIC_*` values reach the browser, and none of them may be a
 * secret (PROMPT.md §27). The refresh token lives in an httpOnly cookie set by
 * the backend, so no secret is ever needed here.
 */

const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false';

/**
 * Mock: MSW serves `/api/v1/*` from the page's own origin.
 * Real: the base URL is empty by default, so requests stay same-origin and a
 * Next.js rewrite forwards them to the backend (`API_PROXY_TARGET`, see
 * `next.config.ts`). Setting `NEXT_PUBLIC_API_BASE_URL` calls the API origin
 * directly instead — the backend must then allow this origin in `CORS_ORIGIN`.
 * Both hosting styles are env-only switches; no code changes on deploy.
 */
const apiBaseUrl = useMockApi
  ? ''
  : (process.env.NEXT_PUBLIC_API_BASE_URL ?? '');

export const env = {
  apiBaseUrl,
  /** Set NEXT_PUBLIC_USE_MOCK_API=false once a backend is available. */
  useMockApi,
  /** Server-side target of the /api/v1 rewrite proxy (never sent to the browser). */
  apiProxyTarget: process.env.API_PROXY_TARGET ?? 'http://localhost:4000',
  isDev: process.env.NODE_ENV !== 'production',
} as const;

/** doc 04 §2.1 — the version prefix is mandatory on every path. */
export const API_PREFIX = '/api/v1';

import type { NextConfig } from 'next';

/**
 * Same-origin API proxy.
 *
 * With no `NEXT_PUBLIC_API_BASE_URL` configured the browser sends `/api/v1/*`
 * to its own origin and this rewrite forwards it to the backend target
 * (`API_PROXY_TARGET`, default http://localhost:4000 — mirrored in
 * `src/lib/env.ts`). Promoting localhost to a hosted API is then a single
 * server-side env change: no code, and nothing URL-related is baked into the
 * browser bundle.
 *
 * The rewrite is registered only when it is actually the transport — mock mode
 * must stay hermetic (MSW is the sole responder) and a direct base URL makes
 * the browser call the API origin itself.
 */
const useMockApi = process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false';
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const apiProxyTarget = (process.env.API_PROXY_TARGET ?? 'http://localhost:4000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    if (useMockApi || apiBaseUrl) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

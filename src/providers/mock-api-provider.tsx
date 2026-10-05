'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import { env } from '@/lib/env';

/**
 * Renders the MSW mock only when it is enabled.
 *
 * In mock mode the API client targets a relative base URL so the worker can
 * serve `/api/v1/*` from the page's own origin (see `env.apiBaseUrl`).
 *
 * `ssr: false` keeps `msw/browser` out of the server bundle entirely.
 */
const MockApiWorker = dynamic(() => import('./mock-api-worker'), { ssr: false });

export function MockApiProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {env.useMockApi ? <MockApiWorker /> : null}
      {children}
    </>
  );
}

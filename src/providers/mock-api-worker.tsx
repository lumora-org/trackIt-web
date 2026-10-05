'use client';

import { useEffect } from 'react';

import { env } from '@/lib/env';

/**
 * Starts the MSW service worker so the app is demoable before the backend
 * exists.
 *
 * This module is loaded via `next/dynamic({ ssr: false })` from
 * `MockApiProvider`, because `msw/browser` declares `"node": null` in its export
 * map and so cannot be resolved in a Node/SSR bundle at all.
 */
export default function MockApiWorker() {
  useEffect(() => {
    if (!env.useMockApi) return;

    let cancelled = false;
    void (async () => {
      const { worker } = await import('@/mocks/browser');
      await worker.start({
        quiet: true,
        serviceWorker: { url: '/mockServiceWorker.js' },
      });
      if (!cancelled) document.documentElement.setAttribute('data-mock-api', 'ready');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

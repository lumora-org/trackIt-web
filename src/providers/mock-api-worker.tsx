'use client';

import { useEffect } from 'react';

import { env } from '@/lib/env';

/**
 * Starts the MSW service worker so the app is demoable before the backend
 * exists.
 *
 * The start is a module-level singleton: React StrictMode (dev) mounts this
 * effect twice in quick succession, and a second `worker.start()` on an
 * already-enabled network throws MSW's "cannot configure an already enabled
 * network" invariant — which, rejected inside a fire-and-forget promise,
 * surfaces as a fatal unhandledRejection. Reusing one in-flight promise means
 * the second effect simply awaits the same start.
 *
 * This module is loaded via `next/dynamic({ ssr: false })` from
 * `MockApiProvider`, because `msw/browser` declares `"node": null` in its export
 * map and so cannot be resolved in a Node/SSR bundle at all.
 */
let startPromise: Promise<void> | null = null;

function ensureWorkerStarted(): Promise<void> {
  startPromise ??= (async () => {
    const { worker } = await import('@/mocks/browser');
    await worker.start({
      quiet: true,
      serviceWorker: { url: '/mockServiceWorker.js' },
    });
    // MSW v3 reports unhandled requests through the event emitter instead of
    // an `onUnhandledRequest` option. Without this, a missing handler
    // silently passes through to the Next.js server, which answers with a
    // 404 HTML page that the client renders as "We could not find what you
    // were looking for". Registered once, next to the single start.
    worker.events.on('request:unhandled', ({ request }) => {
      console.warn(`[msw] Unhandled request: ${request.method} ${request.url}`);
    });
  })();
  return startPromise;
}

export default function MockApiWorker() {
  useEffect(() => {
    if (!env.useMockApi) return;

    let cancelled = false;
    ensureWorkerStarted()
      .then(() => {
        if (!cancelled) document.documentElement.setAttribute('data-mock-api', 'ready');
      })
      .catch((err) => {
        // A failed worker start must never surface as an unhandledRejection —
        // the dev overlay treats those as fatal.
        console.error('[msw] Failed to start the mock API worker:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

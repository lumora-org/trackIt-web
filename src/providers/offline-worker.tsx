'use client';

import { useEffect } from 'react';

import { env } from '@/lib/env';

/**
 * Registers the offline caching service worker (`public/sw.js`).
 *
 * Gated to a production build with the mock API disabled:
 *   - In dev, Next.js serves unhashed/HMR assets that must not be cached.
 *   - With MSW enabled, `mockServiceWorker.js` already controls this scope, and
 *     two workers on one scope would fight — registering here would clobber the
 *     demo API. So the offline worker only turns on for a real deployment.
 */
export function OfflineWorker() {
  useEffect(() => {
    if (env.isDev || env.useMockApi) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        // A failed registration must never surface as an unhandled rejection.
        console.error('[sw] Offline worker registration failed:', err);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}

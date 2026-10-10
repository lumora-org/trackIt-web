/*
 * TrackIt offline service worker.
 *
 * Registered only from a production build with the mock API disabled
 * (see src/providers/offline-worker.tsx) so it never collides with the MSW
 * worker on the same scope during development/demo runs.
 *
 * Caching model:
 *   - /_next/static/*  immutable, content-hashed  -> cache-first
 *   - images & icons                                -> stale-while-revalidate
 *   - HTML navigations                              -> network-first, cached shell fallback
 *   - /api/* and /mockServiceWorker.js              -> untouched (pass through to network)
 *
 * Business data is intentionally NEVER cached: stale inventory/financial
 * figures served offline would be worse than an explicit offline miss.
 */

const VERSION = 'trackit-v1';
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_CACHE = `${VERSION}-shell`;
const IMAGE_CACHE = `${VERSION}-image`;

// Prerendered routes and assets that make up the offline app shell.
const SHELL_URLS = [
  '/',
  '/login',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/kby-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // allSettled so one unavailable URL cannot abort the whole install.
      await Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the API or the MSW worker itself.
  if (url.pathname.startsWith('/api/') || url.pathname === '/mockServiceWorker.js') {
    return;
  }

  // Immutable, content-hashed build assets.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Static images and icons.
  if (/\.(?:png|jpe?g|svg|webp|ico|gif|avif)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // HTML document navigations.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/'));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return offlineResponse();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return hit || (await network) || offlineResponse();
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return (await cache.match(request)) || (await cache.match(fallbackUrl)) || offlineResponse();
  }
}

function offlineResponse() {
  return new Response('You are offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}

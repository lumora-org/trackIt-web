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
 *
 * Push: the same worker also handles `push` events, turning a Web Push message
 * from the backend into an Android-style tray notification and keeping the
 * home-screen icon badge equal to the recipient's unread count. Payloads are
 * treated as untrusted text: only origin-relative paths are ever opened.
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

/* ------------------------------------------------------------------ push */

const NOTIFICATION_ICON = '/icons/icon-192.png';

/**
 * The backend sends { id, type, title, message, url, badgeCount, createdAt }.
 * Every field is optional here: a malformed or empty body degrades to a silent
 * badge refresh rather than throwing inside waitUntil().
 */
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = null;
      try {
        // `json()` returns a promise that REJECTS on a non-JSON body, so the
        // await has to sit inside the try for the fallback to ever happen.
        payload = event.data ? await event.data.json() : null;
      } catch (err) {
        payload = null;
      }
      await Promise.all([showPushNotification(payload), syncBadge(payload)]);
    })(),
  );
});

function showPushNotification(payload) {
  // No title means "just refresh the badge" — no tray noise.
  if (!payload || typeof payload.title !== 'string' || payload.title === '') {
    return Promise.resolve();
  }

  return self.registration.showNotification(payload.title, {
    body: typeof payload.message === 'string' ? payload.message : '',
    // `tag` dedupes: the same notification arriving on two subscriptions of one
    // device replaces instead of stacking.
    tag: `trackit-${payload.id ?? payload.title}`,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    data: { url: safeUrl(payload.url) },
  });
}

/**
 * Badging API: the count on the home-screen icon. Only meaningful once the PWA
 * is installed; elsewhere the call throws or simply does nothing, which must
 * not fail the push event.
 */
function syncBadge(payload) {
  const badge = payload ? Number(payload.badgeCount) : NaN;
  const navigator$ = self.navigator;
  if (!navigator$) return Promise.resolve();
  try {
    if (Number.isFinite(badge) && badge > 0 && typeof navigator$.setAppBadge === 'function') {
      return navigator$.setAppBadge(badge);
    }
    if (badge === 0 && typeof navigator$.clearAppBadge === 'function') {
      return navigator$.clearAppBadge();
    }
  } catch (err) {
    // A badge failure is never worth losing a delivered alert over.
  }
  return Promise.resolve();
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Reuse an open app window so the PWA does not spawn a second instance.
      // The page itself does the navigation — a client-side routed Next app
      // moves far more cheaply with its router than a reload would.
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'trackit:navigate', url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

/**
 * Subscriptions expire (browser reinstall, push-service rotation). Re-subscribing
 * needs an authenticated fetch, which only a page can do, so the open windows
 * are asked to re-register. If none is open the stale row is pruned by the
 * backend on the next 404/410 from the push service.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'trackit:resubscribe' });
      }
    })(),
  );
});

/**
 * Only ever open our own routes: a payload is server data, and a relative path
 * cannot escape the PWA origin the worker is registered on.
 */
function safeUrl(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/notifications';
}

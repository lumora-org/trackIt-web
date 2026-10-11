/**
 * Browser-side Web Push plumbing for the installed PWA.
 *
 * The server owns the subscription records; this module only talks to the
 * browser APIs and hands the resulting subscription to `notifications.api.ts`.
 *
 * Mock-API mode is a simulation, not real push: MSW's `mockServiceWorker.js`
 * owns the scope, has no `push` handler, and a synthetic `applicationServerKey`
 * cannot produce a genuine subscription. The toggle therefore keeps a local
 * device marker and fires page-context notifications so the flow stays demoable
 * offline. Real push needs a production build with `NEXT_PUBLIC_USE_MOCK_API=false`
 * served over HTTPS.
 */

import { env } from '@/lib/env';

export interface LocalPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Stable per-browser id for the simulated opt-in while the mock API is in use. */
const MOCK_DEVICE_KEY = 'trackit:push-mock-device';
/** The simulated equivalent of “this browser holds a push subscription”. */
const MOCK_ENABLED_KEY = 'trackit:push-mock-enabled';

function requireWindow(): void {
  if (typeof window === 'undefined') {
    throw new Error('Push is a browser-only capability.');
  }
}

/** Whether this browser can do Web Push at all (desktop Chrome, Android Chrome, Edge). */
export function isPushCapable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'PushManager' in window &&
    'serviceWorker' in navigator &&
    typeof Notification !== 'undefined'
  );
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/**
 * Must be called from inside the user's click handler: Chrome on Android
 * suppresses prompts that are not tied to a gesture.
 */
export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushCapable()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    // Some browsers only expose the legacy callback form, or throw in an
    // insecure context. Treat either as "the user has not decided".
    return Notification.permission;
  }
}

/** VAPID keys are url-safe base64; PushManager wants raw bytes. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = window.atob(padded);
  // Built on an explicit ArrayBuffer so the result satisfies BufferSource in the
  // TS 5.7+ typed-array generics.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null | undefined): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toLocalSubscription(subscription: PushSubscription): LocalPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64Url(subscription.getKey('auth')),
    },
  };
}

function mockSubscription(): LocalPushSubscription {
  requireWindow();
  let deviceId = window.localStorage.getItem(MOCK_DEVICE_KEY);
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}`;
    window.localStorage.setItem(MOCK_DEVICE_KEY, deviceId);
  }
  return {
    endpoint: `mock://trackit/${deviceId}`,
    keys: { p256dh: 'MOCK_P256DH', auth: 'MOCK_AUTH' },
  };
}

/** Marks the simulated opt-in on/off so a reload keeps the demo state. */
function setMockOptIn(on: boolean): void {
  requireWindow();
  if (on) window.localStorage.setItem(MOCK_ENABLED_KEY, '1');
  else window.localStorage.removeItem(MOCK_ENABLED_KEY);
}

/**
 * The device's current subscription, if the user already opted in. Used to
 * decide whether the UI should say "Alerts on" without prompting anything.
 */
export async function getLocalSubscription(): Promise<LocalPushSubscription | null> {
  if (typeof window === 'undefined') return null;

  if (env.useMockApi) {
    return window.localStorage.getItem(MOCK_ENABLED_KEY) ? mockSubscription() : null;
  }

  if (!isPushCapable()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? toLocalSubscription(subscription) : null;
  } catch {
    return null;
  }
}

/**
 * Subscribes this browser (silently when the user has already granted
 * permission) and returns the subscription the server will store.
 */
export async function subscribeToPush(applicationServerKey: string): Promise<LocalPushSubscription> {
  requireWindow();

  if (env.useMockApi) {
    const subscription = mockSubscription();
    setMockOptIn(true);
    return subscription;
  }

  if (!isPushCapable()) throw new Error('This browser does not support Web Push.');
  if (!applicationServerKey) throw new Error('The server has not published a VAPID key.');

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // Android Chrome requires user-visible notifications; silent push is not
      // offered to web apps, and every alert here is meant to be seen.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
    }));

  return toLocalSubscription(subscription);
}

/** Drops the browser-side subscription; the server row is deleted separately. */
export async function unsubscribeLocally(): Promise<void> {
  requireWindow();

  if (env.useMockApi) {
    setMockOptIn(false);
    return;
  }

  if (!isPushCapable()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch {
    // Already gone, or the worker is not active: nothing left to unsubscribe.
  }
}

/**
 * Mirrors the unread count onto the home-screen icon (Badging API).
 *
 * Outside an installed PWA the call rejects with a NotAllowedError or the method
 * is simply absent, which is normal — never surface it to the user.
 */
export async function syncAppBadge(count: number): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const navigatorWithBadge = navigator as Navigator & {
    setAppBadge?: (value?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };

  try {
    if (count > 0 && navigatorWithBadge.setAppBadge) {
      await navigatorWithBadge.setAppBadge(count);
      return;
    }
    if (count <= 0 && navigatorWithBadge.clearAppBadge) {
      await navigatorWithBadge.clearAppBadge();
    }
  } catch {
    // Badging is a nicety, not a feature the app may fail over.
  }
}

/**
 * Page-context notification used by the mock-API simulation (and by nothing on a
 * real deployment, where the service worker renders the tray alert).
 */
export function showLocalNotification(title: string, body: string, url = '/notifications'): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: 'trackit-test',
      icon: '/icons/icon-192.png',
      data: { url },
    });
  } catch {
    // Some builds throw when the origin is not secure; the demo simply continues.
  }
}

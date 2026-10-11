import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * `public/sw.js` is invisible to `tsc` and to ESLint (it lives outside `src/`),
 * so nothing else in the toolchain would notice a broken service worker. These
 * tests load the real file into a sandboxed global and drive its push events,
 * which is the only way to catch a typo or an unawaited promise in there.
 *
 * The worker is only ever registered in a production build with the mock API off
 * (see src/providers/offline-worker.tsx), so what runs below is exactly what an
 * installed Android PWA runs.
 */
// Vitest runs from the project root, and `import.meta.url` is rewritten to an
// http URL inside the jsdom environment, so the worker path is resolved here.
const WORKER_SOURCE = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

interface WorkerHarness {
  notifications: { title: string; options: Record<string, unknown> }[];
  badges: (number | 'cleared')[];
  opened: string[];
  messages: unknown[];
  dispatch: (type: string, event: Record<string, unknown>) => Promise<void>;
}

interface WorkerOptions {
  /** Whether an app window is already open when the event fires. */
  hasWindowClient?: boolean;
  /** False on browsers without the Badging API (older Android Chrome). */
  hasBadging?: boolean;
}

function loadWorker(options: WorkerOptions = {}): WorkerHarness {
  const listeners: Record<string, (event: never) => unknown> = {};
  const notifications: WorkerHarness['notifications'] = [];
  const badges: WorkerHarness['badges'] = [];
  const opened: WorkerHarness['opened'] = [];
  const messages: WorkerHarness['messages'] = [];
  // Each waitUntil() promise is awaited by dispatch, mirroring how the runtime
  // keeps the event alive: a rejection inside it fails the test instead of
  // vanishing, which is how a broken handler shows up here rather than on a phone.
  const pending: Promise<unknown>[] = [];

  const windowClient = {
    postMessage: (data: unknown) => messages.push(data),
    focus: () => Promise.resolve(),
  };

  const withBadging = options.hasBadging !== false;
  const self = {
    addEventListener: (type: string, handler: (event: never) => unknown) => {
      listeners[type] = handler;
    },
    registration: {
      showNotification: (title: string, args: Record<string, unknown>) => {
        notifications.push({ title, options: args });
        return Promise.resolve();
      },
    },
    clients: {
      matchAll: () => Promise.resolve(options.hasWindowClient === false ? [] : [windowClient]),
      openWindow: (url: string) => {
        opened.push(url);
        return Promise.resolve(null);
      },
    },
    navigator: withBadging
      ? {
          setAppBadge: (count: number) => {
            badges.push(count);
            return Promise.resolve();
          },
          clearAppBadge: () => {
            badges.push('cleared');
            return Promise.resolve();
          },
        }
      : {},
    location: { origin: 'https://trackit.example' },
    skipWaiting: () => Promise.resolve(),
  };

  // The worker is a classic script whose global is `self`; feeding it a stand-in
  // is all the push handlers need (the fetch handlers touch caches, which stay
  // out of scope here).
  new Function('self', WORKER_SOURCE)(self);

  return {
    notifications,
    badges,
    opened,
    messages,
    async dispatch(type, event) {
      const waitUntil = (promise: Promise<unknown>) => {
        pending.push(promise);
      };
      (listeners[type] as (event: unknown) => unknown)({ ...event, waitUntil });
      await Promise.all(pending.splice(0));
    },
  };
}

/** A push event whose body decodes to `body`, or rejects if `body` is an Error. */
function pushEvent(body: unknown): Record<string, unknown> {
  const json =
    body instanceof Error
      ? () => Promise.reject(body)
      : () => Promise.resolve(body as unknown);
  return { data: { json } };
}

function clickEvent(url: unknown) {
  const close = vi.fn();
  return { event: { notification: { data: { url }, close } }, close };
}

describe('service worker push event', () => {
  it('renders the payload as a tray notification and badges the unread count', async () => {
    const worker = loadWorker();

    await worker.dispatch(
      'push',
      pushEvent({
        id: '0f9d1a2b',
        type: 'SALE_RECORDED',
        title: 'Sale recorded',
        message: '120 L of AGO at KBY-BG',
        url: '/sales',
        badgeCount: 7,
      }),
    );

    expect(worker.notifications).toHaveLength(1);
    const { title, options } = worker.notifications[0]!;
    expect(title).toBe('Sale recorded');
    expect(options.body).toBe('120 L of AGO at KBY-BG');
    // `tag` is what stops one device showing the same alert twice.
    expect(options.tag).toBe('trackit-0f9d1a2b');
    expect(options.data).toEqual({ url: '/sales' });
    expect(worker.badges).toEqual([7]);
  });

  it('awaits the payload instead of reading the json() promise as the message', async () => {
    const worker = loadWorker();

    // Regression guard: `event.data.json()` returns a promise, so a handler that
    // forgets to await it sees no `title` and silently drops every alert.
    await worker.dispatch('push', pushEvent({ id: 'x', title: 'Real title', badgeCount: 2 }));

    expect(worker.notifications[0]!.title).toBe('Real title');
    expect(worker.badges).toEqual([2]);
  });

  it('treats a non-JSON body as a silent no-op rather than failing the event', async () => {
    const worker = loadWorker();

    await worker.dispatch('push', pushEvent(new SyntaxError('Unexpected token')));

    expect(worker.notifications).toHaveLength(0);
    expect(worker.badges).toHaveLength(0);
  });

  it('clears the badge when nothing is unread', async () => {
    const worker = loadWorker();

    await worker.dispatch('push', pushEvent({ badgeCount: 0 }));

    expect(worker.badges).toEqual(['cleared']);
    expect(worker.notifications).toHaveLength(0);
  });

  it('ignores a payload without a title but still corrects the badge', async () => {
    const worker = loadWorker();

    await worker.dispatch('push', pushEvent({ message: 'no title', badgeCount: 3 }));

    expect(worker.notifications).toHaveLength(0);
    expect(worker.badges).toEqual([3]);
  });

  it('still delivers the alert on a device with no badging support', async () => {
    const worker = loadWorker({ hasBadging: false });

    await worker.dispatch('push', pushEvent({ title: 'Alert', badgeCount: 4 }));

    expect(worker.notifications).toHaveLength(1);
    expect(worker.badges).toHaveLength(0);
  });
});

describe('service worker notificationclick', () => {
  it('routes an already-open window instead of reloading it', async () => {
    const worker = loadWorker();
    const { event, close } = clickEvent('/incidents/12');

    await worker.dispatch('notificationclick', event);

    expect(close).toHaveBeenCalled();
    expect(worker.messages).toEqual([{ type: 'trackit:navigate', url: '/incidents/12' }]);
    expect(worker.opened).toHaveLength(0);
  });

  it('opens a window when the app is not already open', async () => {
    const worker = loadWorker({ hasWindowClient: false });
    const { event } = clickEvent('/notifications');

    await worker.dispatch('notificationclick', event);

    expect(worker.opened).toEqual(['/notifications']);
  });

  it('refuses to leave the origin', async () => {
    const worker = loadWorker();
    const { event } = clickEvent('https://evil.example/steal');

    await worker.dispatch('notificationclick', event);

    // A payload is server data: anything but a single-slash path falls back.
    expect(worker.messages).toEqual([{ type: 'trackit:navigate', url: '/notifications' }]);
  });

  it('falls back for a protocol-relative url', async () => {
    const worker = loadWorker({ hasWindowClient: false });
    const { event } = clickEvent('//evil.example');

    await worker.dispatch('notificationclick', event);

    expect(worker.opened).toEqual(['/notifications']);
  });
});

describe('service worker pushsubscriptionchange', () => {
  it('asks every open page to re-register', async () => {
    const worker = loadWorker();

    await worker.dispatch('pushsubscriptionchange', {});

    expect(worker.messages).toEqual([{ type: 'trackit:resubscribe' }]);
  });
});

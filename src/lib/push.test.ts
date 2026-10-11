import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getLocalSubscription,
  isPushCapable,
  subscribeToPush,
  syncAppBadge,
  unsubscribeLocally,
  urlBase64ToUint8Array,
} from './push';

/**
 * The mock API is active under vitest (NEXT_PUBLIC_USE_MOCK_API is unset), which
 * is exactly the simulated branch these tests cover: no PushManager, no service
 * worker, no real network.
 */
describe('urlBase64ToUint8Array', () => {
  it('decodes a url-safe base64 key into raw bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
  });

  it('adds the padding a 43-character VAPID key is missing', () => {
    // 43 url-safe characters decode to 32 bytes only if "=" is supplied.
    const key = 'BAS7GfURO7ec1FwFTtxLL1rRS4_cosB5Wu0nKq8NmA0'.slice(0, 43);
    expect(urlBase64ToUint8Array(key)).toBeInstanceOf(Uint8Array);
    expect(urlBase64ToUint8Array(key).length).toBe(32);
  });

  it('maps - and _ to the standard base64 alphabet', () => {
    expect(Array.from(urlBase64ToUint8Array('z_-'))).toEqual(Array.from(urlBase64ToUint8Array('z//')));
  });
});

describe('isPushCapable', () => {
  it('is false where the browser has no PushManager (jsdom)', () => {
    expect(isPushCapable()).toBe(false);
  });
});

describe('syncAppBadge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never throws when badging is unavailable', async () => {
    await expect(syncAppBadge(3)).resolves.toBeUndefined();
  });

  it('sets the badge above zero and clears it at zero', async () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { setAppBadge, clearAppBadge });

    await syncAppBadge(4);
    expect(setAppBadge).toHaveBeenCalledWith(4);

    await syncAppBadge(0);
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('swallows a badging rejection instead of breaking the UI', async () => {
    vi.stubGlobal('navigator', {
      setAppBadge: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
    });
    await expect(syncAppBadge(2)).resolves.toBeUndefined();
  });
});

describe('simulated push opt-in (mock API)', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('subscribes without a service worker and reports the device back', async () => {
    const subscription = await subscribeToPush('IGNORED_IN_MOCK_MODE');

    expect(subscription.endpoint).toMatch(/^mock:\/\/trackit\//);
    expect(subscription.keys).toEqual({ p256dh: 'MOCK_P256DH', auth: 'MOCK_AUTH' });

    // The opt-in survives a reload, which is what the toggle reads.
    const again = await getLocalSubscription();
    expect(again?.endpoint).toBe(subscription.endpoint);
  });

  it('reports nothing subscribed before the user opts in', async () => {
    expect(await getLocalSubscription()).toBeNull();
  });

  it('forgetting the opt-in clears the local marker', async () => {
    await subscribeToPush('IGNORED_IN_MOCK_MODE');
    await unsubscribeLocally();
    expect(await getLocalSubscription()).toBeNull();
  });
});

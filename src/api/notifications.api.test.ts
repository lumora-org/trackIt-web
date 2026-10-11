import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import {
  getPushStatus,
  listNotifications,
  markAllAsRead,
  markAsRead,
  registerPushSubscription,
  removeAllPushSubscriptions,
  removePushSubscription,
  sendTestPush,
  unreadCount,
} from '@/api/notifications.api';
import { NOTIFICATIONS, PUSH_SUBSCRIPTIONS } from '@/mocks/data';

async function asAdmin() {
  resetApiClientForTests();
  const session = await login({ email: 'admin@kbyglobal.com', password: 'Password123!' });
  setAccessToken(session.accessToken);
}

describe('notification listing (doc 04 §72)', () => {
  it('returns the seeded notifications, newest first', async () => {
    await asAdmin();
    const { data } = await listNotifications();
    const times = data.map((n) => +new Date(n.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('filters by status (doc 03 §20 — UNREAD / READ)', async () => {
    await asAdmin();
    const { data } = await listNotifications({ status: 'UNREAD' });
    expect(data.every((n) => n.status === 'UNREAD')).toBe(true);
  });

  it('filters by type (doc 03 §19)', async () => {
    await asAdmin();
    const { data } = await listNotifications({ type: 'LOW_INVENTORY' });
    expect(data.every((n) => n.type === 'LOW_INVENTORY')).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('counts unread notifications from the pagination meta', async () => {
    await asAdmin();
    const expected = NOTIFICATIONS.filter((n) => n.status === 'UNREAD').length;
    expect(await unreadCount()).toBe(expected);
  });
});

describe('marking as read (doc 04 §73)', () => {
  it('sets status to READ and records readAt', async () => {
    await asAdmin();
    const unread = NOTIFICATIONS.find((n) => n.status === 'UNREAD')!;
    const updated = await markAsRead(unread.id);
    expect(updated.status).toBe('READ');
    expect(updated.readAt).toBeTruthy();
  });

  it('marks every notification read via the read-all sibling path', async () => {
    await asAdmin();
    // The static `read-all` route must not be swallowed by the `:id` matcher.
    await markAllAsRead();
    const { data } = await listNotifications({ status: 'UNREAD' });
    expect(data).toHaveLength(0);
  });

  it('is idempotent', async () => {
    await asAdmin();
    const n = NOTIFICATIONS[0]!;
    await markAsRead(n.id);
    const again = await markAsRead(n.id);
    expect(again.status).toBe('READ');
  });

  it('reduces the unread count', async () => {
    await asAdmin();
    const before = await unreadCount();
    await markAsRead(NOTIFICATIONS.find((n) => n.status === 'UNREAD')!.id);
    expect(await unreadCount()).toBe(before - 1);
  });
});

describe('push subscriptions (PWA alerts)', () => {
  const subscription = {
    endpoint: 'mock://trackit/device-1',
    keys: { p256dh: 'MOCK_P256DH', auth: 'MOCK_AUTH' },
  };

  it('reports the key the browser needs and no devices yet', async () => {
    await asAdmin();
    const status = await getPushStatus();
    expect(status.enabled).toBe(true);
    expect(status.applicationServerKey).toBeTruthy();
    expect(status.subscriptions).toHaveLength(0);
  });

  it('registers a device and keeps one row when it re-registers', async () => {
    await asAdmin();
    const first = await registerPushSubscription(subscription);
    expect(first.created).toBe(true);

    const second = await registerPushSubscription(subscription);
    expect(second).toEqual({ id: first.id, created: false });
    expect(PUSH_SUBSCRIPTIONS).toHaveLength(1);

    const status = await getPushStatus();
    expect(status.subscriptions.map((s) => s.id)).toEqual([first.id]);
    // A device record never exposes its endpoint or keys (write-only).
    expect(JSON.stringify(status)).not.toContain('MOCK_P256DH');
  });

  it('counts the registered devices for a test alert', async () => {
    await asAdmin();
    expect((await sendTestPush()).sent).toBe(0);
    await registerPushSubscription(subscription);
    expect((await sendTestPush()).sent).toBe(1);
  });

  it('unsubscribes one device, and all of them on sign-out', async () => {
    await asAdmin();
    const { id } = await registerPushSubscription(subscription);
    await removePushSubscription(id);
    expect(await getPushStatus()).toMatchObject({ subscriptions: [] });

    await registerPushSubscription(subscription);
    await registerPushSubscription({ ...subscription, endpoint: 'mock://trackit/device-2' });
    await removeAllPushSubscriptions();
    expect(PUSH_SUBSCRIPTIONS).toHaveLength(0);
  });
});

describe('notification security', () => {
  it('requires authentication', async () => {
    resetApiClientForTests();
    setAccessToken(null);
    await expect(listNotifications()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('requires authentication for the push routes too', async () => {
    resetApiClientForTests();
    setAccessToken(null);
    await expect(getPushStatus()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('404s for an unknown notification rather than leaking', async () => {
    await asAdmin();
    await expect(markAsRead('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

/** doc 04 §72–74 */
import { apiClient } from './client';
import type { AppNotification, PushStatus } from '@/types/domain';

/** A type alias so it satisfies the query-key index signature. */
export type NotificationFilters = {
  page?: number;
  limit?: number;
  status?: 'UNREAD' | 'READ';
  type?: string;
};

export async function listNotifications(filters: NotificationFilters = {}) {
  return apiClient.list<AppNotification>('/notifications', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      status: filters.status,
      type: filters.type,
    },
  });
}

/** doc 04 §73 — `read-all` is a static sibling path, not `:id`. */
export async function markAsRead(id: string): Promise<AppNotification> {
  return apiClient.patch<AppNotification>(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}

export async function unreadCount(): Promise<number> {
  const { meta } = await apiClient.list<AppNotification>('/notifications', {
    query: { status: 'UNREAD', limit: 1 },
  });
  return meta?.total ?? 0;
}

/* ----------------------------------------------------------------- push */

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/** Whether this server can deliver push, and the key needed to subscribe. */
export async function getPushStatus(): Promise<PushStatus> {
  return apiClient.get<PushStatus>('/notifications/push');
}

/** Idempotent on `endpoint`: re-registering a device refreshes its row. */
export async function registerPushSubscription(
  input: PushSubscriptionInput,
): Promise<{ id: string; created: boolean }> {
  return apiClient.post<{ id: string; created: boolean }>('/notifications/push/subscriptions', input);
}

export async function removePushSubscription(id: string): Promise<void> {
  await apiClient.delete(`/notifications/push/subscriptions/${id}`);
}

/** Sign-out: stop alerting every device of this account. */
export async function removeAllPushSubscriptions(): Promise<void> {
  await apiClient.delete('/notifications/push/subscriptions/all');
}

/** Test alert straight to the registered devices; writes no notification row. */
export async function sendTestPush(): Promise<{ sent: number }> {
  return apiClient.post<{ sent: number }>('/notifications/push/test');
}

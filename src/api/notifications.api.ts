/** doc 04 §72–74 */
import { apiClient } from './client';
import type { AppNotification } from '@/types/domain';

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

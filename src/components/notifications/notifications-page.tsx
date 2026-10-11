'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  Package,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  listNotifications,
  markAllAsRead,
  markAsRead,
  type NotificationFilters,
} from '@/api/notifications.api';
import { Badge, toneFor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterSelect } from '@/components/shared/search-input';
import { PushAlertsToggle } from '@/components/notifications/push-toggle';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { AppNotification, NotificationStatus, NotificationType } from '@/types/domain';

/**
 * Notification centre (PROMPT.md §31 step 16, §15).
 *
 * doc 03 §19 types map to icons here so a glance is enough. Unread items are
 * visually obvious and support mark-as-read, mark-all-as-read, and jumping to
 * the related resource.
 *
 * There is no notification preferences model anywhere in the docs (no table, no
 * endpoint), so no per-type opt-out is offered — see ASSUMPTIONS.md §3.11. The
 * device-level push opt-in is separate and lives in `PushAlertsToggle`.
 */

/** doc 03 §19 — notification_type enum, mapped to a recognisable icon. */
const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  REPORT_SUBMITTED: ClipboardCheck,
  REPORT_APPROVED: ShieldCheck,
  REPORT_REJECTED: AlertTriangle,
  DELIVERY_RECEIVED: Truck,
  DELIVERY_IN_TRANSIT: Truck,
  FUEL_ORDER_ASSIGNED: ClipboardCheck,
  DELIVERY_DISCREPANCY: Package,
  LOW_INVENTORY: Package,
  FUEL_PRICE_UPDATE: Tag,
  DAILY_REPORT_MISSING: AlertTriangle,
  INCIDENT_REPORTED: AlertTriangle,
  INCIDENT_REVIEWED: ShieldCheck,
  SALE_RECORDED: ShoppingCart,
  SALE_APPROVED: CheckCircle2,
  SALE_REJECTED: XCircle,
  SALES_NOT_RECORDED: AlertTriangle,
  SYSTEM: Bell,
};

/**
 * doc 03 §59 — `resourceType` + `resourceId` point at the related record.
 * These are the routes that exist today; anything else falls back to no link
 * rather than to a guessed URL.
 */
const RESOURCE_ROUTES: Record<string, (id: string) => string> = {
  DAILY_REPORT: (id) => `/daily-reports?report=${id}`,
  INCIDENT_REPORT: (id) => `/daily-reports?incident=${id}`,
  DELIVERY: (id) => `/deliveries?delivery=${id}`,
  FUEL_ORDER: () => '/fuel-orders',
  BRANCH: () => '/inventory',
  FUEL_PRICE: () => '/fuel-prices',
  SALE: () => '/sales',
};

function routeFor(notification: AppNotification): string | null {
  if (!notification.resourceType || !notification.resourceId) return null;
  return RESOURCE_ROUTES[notification.resourceType]?.(notification.resourceId) ?? null;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'' | NotificationStatus>('');
  const [typeFilter, setTypeFilter] = useState<'' | NotificationType>('');

  const filters: NotificationFilters = {
    page,
    limit: 20,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  };

  const listQuery = useQuery({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: () => listNotifications(filters),
  });

  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const { meta } = await listNotifications({ status: 'UNREAD', limit: 1 });
      return meta?.total ?? 0;
    },
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    },
  });

  const notifications = listQuery.data?.data ?? [];
  const unread = unreadQuery.data ?? 0;

  const columns: Column<AppNotification>[] = [
    {
      key: 'title',
      header: 'Notification',
      primary: true,
      render: (n) => <NotificationRow notification={n} onRead={readMutation.mutate} />,
    },
    {
      key: 'type',
      header: 'Type',
      secondary: true,
      render: (n) => (
        <Badge tone={toneFor('notification', n.type)} size="sm">
          {n.type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (n) => (
        <Badge tone={n.status === 'UNREAD' ? 'brand' : 'neutral'} size="sm">
          {n.status === 'UNREAD' ? 'Unread' : 'Read'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Received',
      align: 'right',
      mobileHidden: true,
      render: (n) => formatRelative(n.createdAt),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
            Notifications
            {unread > 0 ? (
              <span
                className="bg-danger-500 inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
                aria-label={`${unread} unread`}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-neutral-500">
            Price updates, delivery activity, incident reports and stock warnings.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PushAlertsToggle />
          {unread > 0 ? (
            <Button
              variant="outline"
              loading={readAllMutation.isPending}
              loadingText="Marking read"
              onClick={() => readAllMutation.mutate()}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all as read
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <FilterSelect
          className="sm:w-44"
          label="Filter by read status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as '' | NotificationStatus);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All' },
            { value: 'UNREAD', label: 'Unread' },
            { value: 'READ', label: 'Read' },
          ]}
        />
        <FilterSelect
          className="sm:w-56"
          label="Filter by type"
          value={typeFilter}
          onChange={(value) => {
            setTypeFilter(value as '' | NotificationType);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All types' },
            { value: 'REPORT_SUBMITTED', label: 'Report submitted' },
            { value: 'REPORT_APPROVED', label: 'Report approved' },
            { value: 'REPORT_REJECTED', label: 'Report rejected' },
            { value: 'DELIVERY_RECEIVED', label: 'Delivery received' },
            { value: 'DELIVERY_DISCREPANCY', label: 'Delivery discrepancy' },
            { value: 'DELIVERY_IN_TRANSIT', label: 'Delivery in transit' },
            { value: 'FUEL_ORDER_ASSIGNED', label: 'Fuel order assigned' },
            { value: 'LOW_INVENTORY', label: 'Low inventory' },
            { value: 'FUEL_PRICE_UPDATE', label: 'Price update' },
            { value: 'DAILY_REPORT_MISSING', label: 'Report missing' },
            { value: 'INCIDENT_REPORTED', label: 'Incident reported' },
            { value: 'INCIDENT_REVIEWED', label: 'Incident reviewed' },
            { value: 'SALES_NOT_RECORDED', label: 'Sales not recorded' },
            { value: 'SYSTEM', label: 'System' },
          ]}
        />
      </div>

      <DataTable
        caption="Notifications"
        columns={columns}
        data={notifications}
        rowKey={(n) => n.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading notifications"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        emptyTitle={statusFilter === 'UNREAD' ? 'No unread notifications' : 'No notifications'}
        emptyDescription={
          statusFilter === 'UNREAD'
            ? 'You are all caught up.'
            : 'Delivery activity and report decisions will appear here.'
        }
        emptyIcon={statusFilter === 'UNREAD' ? BellOff : Bell}
      />
    </div>
  );
}

/**
 * One notification. Clicking marks it read and, when the resource has a known
 * route, navigates there — PROMPT.md §15's "open related resource".
 */
function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const isUnread = notification.status === 'UNREAD';
  const Icon = TYPE_ICONS[notification.type] ?? Bell;
  const href = routeFor(notification);

  const body = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isUnread ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-500',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('text-sm', isUnread ? 'font-semibold' : 'font-medium')}>
            {notification.title}
          </span>
          {isUnread ? (
            <span className="bg-brand-600 size-2 shrink-0 rounded-full" aria-label="Unread" />
          ) : null}
        </span>
        {notification.message ? (
          <span className="mt-0.5 block text-sm text-neutral-600">{notification.message}</span>
        ) : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={() => {
          if (isUnread) onRead(notification.id);
        }}
        className="focus-visible:outline-brand-600 flex items-start gap-3 rounded-lg focus-visible:outline-2"
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (isUnread) onRead(notification.id);
      }}
      disabled={!isUnread}
      className="flex w-full items-start gap-3 rounded-lg text-left disabled:cursor-default"
    >
      {body}
    </button>
  );
}

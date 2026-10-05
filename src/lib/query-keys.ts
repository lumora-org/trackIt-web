/**
 * Centralised TanStack Query keys.
 *
 * Grouped by resource so mutations can invalidate precisely instead of
 * refetching everything (PROMPT.md §28).
 */

import type { UserRole } from '@/types/domain';

type ListFilters = Record<string, unknown>;

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },

  dashboard: {
    admin: (filters?: ListFilters) => ['dashboard', 'admin', filters ?? {}] as const,
    manager: ['dashboard', 'manager'] as const,
    inventory: ['dashboard', 'inventory'] as const,
  },

  businesses: {
    list: (filters?: ListFilters) => ['businesses', 'list', filters ?? {}] as const,
    detail: (id: string) => ['businesses', 'detail', id] as const,
  },

  branches: {
    list: (filters?: ListFilters) => ['branches', 'list', filters ?? {}] as const,
    detail: (id: string) => ['branches', 'detail', id] as const,
  },

  users: {
    list: (filters?: ListFilters) => ['users', 'list', filters ?? {}] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  fuelTypes: {
    list: (filters?: ListFilters) => ['fuel-types', 'list', filters ?? {}] as const,
    detail: (id: string) => ['fuel-types', 'detail', id] as const,
  },

  fuelPrices: {
    list: (filters?: ListFilters) => ['fuel-prices', 'list', filters ?? {}] as const,
    current: (fuelTypeId: string) => ['fuel-prices', 'current', fuelTypeId] as const,
    /** doc 04 §29.1 — history is derived from the list endpoint via date filters. */
    history: (fuelTypeId: string) => ['fuel-prices', 'history', fuelTypeId] as const,
  },

  suppliers: {
    list: (filters?: ListFilters) => ['suppliers', 'list', filters ?? {}] as const,
    detail: (id: string) => ['suppliers', 'detail', id] as const,
  },

  tankers: {
    list: (filters?: ListFilters) => ['tankers', 'list', filters ?? {}] as const,
    detail: (id: string) => ['tankers', 'detail', id] as const,
  },

  fuelOrders: {
    list: (filters?: ListFilters) => ['fuel-orders', 'list', filters ?? {}] as const,
    detail: (id: string) => ['fuel-orders', 'detail', id] as const,
  },

  deliveries: {
    list: (filters?: ListFilters) => ['deliveries', 'list', filters ?? {}] as const,
    detail: (id: string) => ['deliveries', 'detail', id] as const,
  },

  inventory: {
    stock: (filters?: ListFilters) => ['inventory', 'stock', filters ?? {}] as const,
    summary: (branchId?: string) => ['inventory', 'summary', branchId ?? null] as const,
    transactions: (filters?: ListFilters) => ['inventory', 'transactions', filters ?? {}] as const,
  },

  sales: {
    list: (filters?: ListFilters) => ['sales', 'list', filters ?? {}] as const,
    detail: (id: string) => ['sales', 'detail', id] as const,
  },

  dailyReports: {
    list: (filters?: ListFilters) => ['daily-reports', 'list', filters ?? {}] as const,
    detail: (id: string) => ['daily-reports', 'detail', id] as const,
  },

  notifications: {
    list: (filters?: ListFilters) => ['notifications', 'list', filters ?? {}] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },

  auditLogs: {
    list: (filters?: ListFilters) => ['audit-logs', 'list', filters ?? {}] as const,
  },

  reports: {
    sales: (filters?: ListFilters) => ['reports', 'sales', filters ?? {}] as const,
    inventory: (filters?: ListFilters) => ['reports', 'inventory', filters ?? {}] as const,
    deliveries: (filters?: ListFilters) => ['reports', 'deliveries', filters ?? {}] as const,
    dailyReports: (filters?: ListFilters) => ['reports', 'daily-reports', filters ?? {}] as const,
  },
} as const;

/**
 * Every key that a given mutation should invalidate. Keeping this adjacent to
 * the keys themselves avoids the usual scattered invalidation logic.
 */
export function invalidateForResource(resource: keyof typeof queryKeys): Array<readonly unknown[]> {
  switch (resource) {
    case 'inventory':
      return [
        queryKeys.inventory.stock(),
        queryKeys.inventory.summary(),
        queryKeys.dashboard.admin(),
        queryKeys.dashboard.manager,
        queryKeys.dailyReports.list(),
      ];
    case 'sales':
      return [
        queryKeys.sales.list(),
        queryKeys.inventory.stock(),
        queryKeys.inventory.transactions(),
        queryKeys.dashboard.admin(),
        queryKeys.dashboard.manager,
        queryKeys.dailyReports.list(),
      ];
    case 'deliveries':
      return [
        queryKeys.deliveries.list(),
        queryKeys.fuelOrders.list(),
        queryKeys.inventory.stock(),
        queryKeys.inventory.transactions(),
        queryKeys.dashboard.admin(),
        queryKeys.dashboard.manager,
        queryKeys.dailyReports.list(),
      ];
    case 'fuelOrders':
      return [queryKeys.fuelOrders.list()];
    case 'fuelPrices':
      return [queryKeys.fuelPrices.list(), queryKeys.fuelPrices.current('')];
    case 'fuelTypes':
      return [queryKeys.fuelTypes.list()];
    case 'suppliers':
      return [queryKeys.suppliers.list()];
    case 'tankers':
      return [queryKeys.tankers.list()];
    case 'dailyReports':
      return [
        queryKeys.dailyReports.list(),
        queryKeys.dashboard.manager,
        queryKeys.dashboard.admin(),
      ];
    case 'notifications':
      return [queryKeys.notifications.list(), queryKeys.notifications.unreadCount];
    case 'users':
      return [queryKeys.users.list()];
    case 'branches':
      return [queryKeys.branches.list(), queryKeys.dashboard.admin()];
    case 'businesses':
      return [queryKeys.businesses.list(), queryKeys.dashboard.admin()];
    case 'auditLogs':
      return [queryKeys.auditLogs.list()];
    default:
      return [];
  }
}

/** Nav is role-aware (PROMPT.md §5); this narrows a list to one role. */
export function keysForRole(role: UserRole): Record<string, unknown> {
  return { role };
}

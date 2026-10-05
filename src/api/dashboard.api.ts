import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';
import type { AdminDashboard, ManagerDashboard } from '@/types/domain';

/**
 * doc 04 §76 / §77 / §78.
 *
 * `/dashboard/inventory` is deliberately not called: doc 04 §78 describes its
 * contents in prose with no field names or query parameters, so the contract is
 * unknowable. See ASSUMPTIONS.md §3.7.
 */

/** doc 04 §76 — ADMIN, SUPER_ADMIN. Optional branchId filter. */
export function fetchAdminDashboard(filters?: { from?: string; to?: string; branchId?: string }) {
  return apiClient.get<AdminDashboard>('/dashboard/admin', { query: filters });
}

/** doc 04 §77 — MANAGER. Automatically scoped to the caller's branch. */
export function fetchManagerDashboard() {
  return apiClient.get<ManagerDashboard>('/dashboard/manager');
}

export function useAdminDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    // Wrapped so TanStack Query's context object is not passed as `filters`.
    queryFn: () => fetchAdminDashboard(),
    enabled,
    // doc 05 §117 — a dashboard summary may be cached briefly, but must not be
    // served stale for long.
    staleTime: 60_000,
  });
}

export function useManagerDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'manager'],
    queryFn: () => fetchManagerDashboard(),
    enabled,
    staleTime: 60_000,
  });
}

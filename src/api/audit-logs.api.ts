/**
 * Audit logs (doc 04 §86–88, doc 03 §60–62).
 *
 * Read-only and append-only: doc 03 §62 states normal users must never modify or
 * delete an audit record, so this module exposes no mutation at all — not even
 * a hidden one.
 *
 * doc 04 §86.1 documents no `branchId` filter even though the column exists, so
 * no branch filter is offered (ASSUMPTIONS.md §3.6).
 */
import { apiClient } from './client';
import type { AuditLog, PageMeta } from '@/types/domain';

export type AuditLogFilters = {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
};

export async function listAuditLogs(
  filters: AuditLogFilters = {},
): Promise<{ data: AuditLog[]; meta: PageMeta | null }> {
  return apiClient.list<AuditLog>('/audit-logs', {
    query: {
      page: filters.page ?? 1,
      // doc 04 §86.1 defaults this to 50 rather than 20.
      limit: filters.limit ?? 50,
      userId: filters.userId,
      action: filters.action,
      resourceType: filters.resourceType,
      from: filters.from,
      to: filters.to,
    },
  });
}

/** doc 04 §88 — read a single audit entry. */
export async function getAuditLog(id: string): Promise<AuditLog> {
  return apiClient.get<AuditLog>(`/audit-logs/${id}`);
}

/** doc 04 §88 — the canonical action list. */
export const AUDIT_ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'SALE_CREATED', label: 'Sale recorded' },
  { value: 'SALE_VOIDED', label: 'Sale voided' },
  { value: 'DELIVERY_RECEIVED', label: 'Delivery received' },
  { value: 'INVENTORY_ADJUSTED', label: 'Inventory adjusted' },
  { value: 'FUEL_ORDER_CREATED', label: 'Fuel order created' },
  { value: 'FUEL_ORDER_SUBMITTED', label: 'Fuel order submitted' },
  { value: 'FUEL_ORDER_CONFIRMED', label: 'Fuel order confirmed' },
  { value: 'FUEL_ORDER_CANCELLED', label: 'Fuel order cancelled' },
  { value: 'FUEL_PRICE_CREATED', label: 'Fuel price set' },
  { value: 'DAILY_REPORT_SUBMITTED', label: 'Daily report submitted' },
  { value: 'DAILY_REPORT_APPROVED', label: 'Daily report approved' },
  { value: 'DAILY_REPORT_REJECTED', label: 'Daily report rejected' },
  { value: 'USER_CREATED', label: 'User created' },
  { value: 'USER_UPDATED', label: 'User updated' },
  { value: 'USER_DEACTIVATED', label: 'User deactivated' },
  { value: 'LOGIN_SUCCESS', label: 'Login success' },
  { value: 'LOGIN_FAILED', label: 'Login failed' },
  { value: 'PASSWORD_RESET', label: 'Password reset' },
] as const;

export const AUDIT_RESOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All resource types' },
  { value: 'SALE', label: 'Sales' },
  { value: 'DELIVERY', label: 'Deliveries' },
  { value: 'DAILY_REPORT', label: 'Daily reports' },
  { value: 'FUEL_ORDER', label: 'Fuel orders' },
  { value: 'FUEL_PRICE', label: 'Fuel prices' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'USER', label: 'Users' },
  { value: 'AUTH', label: 'Authentication' },
] as const;

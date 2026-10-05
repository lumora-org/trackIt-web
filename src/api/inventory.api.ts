/**
 * Inventory (doc 04 §53–57, doc 03 §17, §45–49, §74).
 *
 * doc 03 §49 is the governing rule: a wrong transaction is never edited. Fix it
 * with a `CORRECTION` transaction. doc 05 §117 warns that current inventory must
 * not be served from a stale cache, so these queries use a short staleTime.
 */
import { z } from 'zod';

import { apiClient } from './client';
import type {
  InventoryStock,
  InventorySummary,
  InventoryTransaction,
  InventoryTransactionType,
  PageMeta,
} from '@/types/domain';

export type InventoryFilters = {
  page?: number;
  limit?: number;
  branchId?: string;
  fuelTypeId?: string;
  type?: InventoryTransactionType;
  from?: string;
  to?: string;
};

/**
 * doc 04 §54 — returns a bare array, not a paginated envelope. A manager is
 * automatically restricted to their assigned branch, so no branch filter is
 * required for them.
 */
export async function getInventoryStock(filters?: {
  branchId?: string;
  fuelTypeId?: string;
}): Promise<InventoryStock[]> {
  return apiClient.get<InventoryStock[]>('/inventory', { query: filters });
}

/** doc 04 §56 — the per-branch, per-fuel snapshot with `asOf`. */
export async function getInventorySummary(branchId?: string): Promise<InventorySummary> {
  return apiClient.get<InventorySummary>('/inventory/summary', { query: { branchId } });
}

export async function listInventoryTransactions(
  filters: InventoryFilters = {},
): Promise<{ data: InventoryTransaction[]; meta: PageMeta | null }> {
  return apiClient.list<InventoryTransaction>('/inventory/transactions', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
      branchId: filters.branchId,
      fuelTypeId: filters.fuelTypeId,
      type: filters.type,
      from: filters.from,
      to: filters.to,
    },
  });
}

export interface CreateAdjustmentInput {
  branchId: string;
  fuelTypeId: string;
  /** Signed: negative removes fuel. doc 03 §45 — ADJUSTMENT may be either way. */
  quantityLitres: number;
  /** PRD rule 10 — an adjustment requires an explanation. */
  reason: string;
}

/** doc 04 §57 — ADMIN, SUPER_ADMIN. Never directly modifies historical rows. */
export async function createAdjustment(
  input: CreateAdjustmentInput,
): Promise<InventoryTransaction> {
  return apiClient.post<InventoryTransaction>('/inventory/adjustments', input, {
    idempotencyKey: crypto.randomUUID(),
  });
}

export const adjustmentSchema = z.object({
  fuelTypeId: z.string().uuid('Select a fuel type'),
  /** Signed value; direction is chosen in the UI. */
  direction: z.enum(['increase', 'decrease']),
  quantityLitres: z
    .number({ message: 'Enter a quantity' })
    .positive('Quantity must be greater than 0')
    .max(1_000_000, 'Quantity looks too high'),
  reason: z.string().trim().min(1, 'A reason is required').max(500, 'Reason is too long'),
});

export type AdjustmentValues = z.infer<typeof adjustmentSchema>;

export function toAdjustmentPayload(
  values: AdjustmentValues,
  branchId: string,
): CreateAdjustmentInput {
  return {
    branchId,
    fuelTypeId: values.fuelTypeId,
    quantityLitres:
      values.direction === 'decrease' ? -values.quantityLitres : values.quantityLitres,
    reason: values.reason,
  };
}

/** doc 03 §17 — TRANSFER_* exist for future branch-to-branch movement only. */
export const ADJUSTABLE_TRANSACTION_TYPES: readonly InventoryTransactionType[] = [
  'ADJUSTMENT',
  'CORRECTION',
];

export const LEDGER_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All movement types' },
  { value: 'OPENING_BALANCE', label: 'Opening balance' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'SALE', label: 'Sale' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'CORRECTION', label: 'Correction' },
] as const;

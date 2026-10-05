/**
 * Deliveries and receiving (doc 04 §47–52, doc 03 §40–43, doc 05 §60).
 *
 * The single most important rule: only `actualQuantityLitres` is added to
 * inventory. Expected quantity must never be used as the authoritative movement
 * (doc 04 §49), which is exactly why the receiving form asks the manager for the
 * actual figure rather than confirming the expected one.
 */
import { z } from 'zod';

import { apiClient } from './client';
import type { Delivery, DeliveryStatus, PageMeta, ReceiveDeliveryItemInput } from '@/types/domain';

/**
 * Declared as a type alias rather than an interface so it satisfies the query-key
 * index-signature constraint.
 */
export type DeliveryFilters = {
  page?: number;
  limit?: number;
  status?: DeliveryStatus;
  branchId?: string;
  from?: string;
  to?: string;
};

export async function listDeliveries(
  filters: DeliveryFilters = {},
): Promise<{ data: Delivery[]; meta: PageMeta | null }> {
  return apiClient.list<Delivery>('/deliveries', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      status: filters.status,
      branchId: filters.branchId,
      from: filters.from,
      to: filters.to,
    },
  });
}

export async function getDelivery(id: string): Promise<Delivery> {
  return apiClient.get<Delivery>(`/deliveries/${id}`);
}

/** doc 04 §50 — only actual quantity and a per-item reason are sent. */
export async function receiveDelivery(
  id: string,
  items: ReceiveDeliveryItemInput[],
): Promise<Delivery> {
  return apiClient.post<Delivery>(
    `/deliveries/${id}/receive`,
    {
      items: items.map((item) => ({
        fuelTypeId: item.fuelTypeId,
        actualQuantityLitres: item.actualQuantityLitres,
        ...(item.discrepancyReason ? { discrepancyReason: item.discrepancyReason } : {}),
      })),
    },
    // doc 04 §103 — stops a double-tap adding the fuel to stock twice.
    { idempotencyKey: crypto.randomUUID() },
  );
}

/**
 * doc 04 §51 — the dispute body is a single `reason` string, not an items array.
 * A disputed delivery must not increase inventory (doc 09 §20).
 */
export async function disputeDelivery(id: string, reason: string): Promise<Delivery> {
  return apiClient.post<Delivery>(
    `/deliveries/${id}/dispute`,
    { reason },
    { idempotencyKey: crypto.randomUUID() },
  );
}

/* ------------------------------------------------------------ validation */

/*
 * doc 09 §13 — delivery quantities must be >= 0 (unlike an order's expected
 * quantity, which must be > 0). A zero delivery is legitimate.
 */
const receiveItemSchema = z.object({
  fuelTypeId: z.string().uuid('Missing fuel type'),
  actualQuantityLitres: z
    .number({ message: 'Enter the actual quantity' })
    .min(0, 'Quantity cannot be negative')
    .max(1_000_000, 'Quantity looks too high'),
  discrepancyReason: z.string().trim().max(500, 'Reason is too long').optional(),
});

export const receiveDeliverySchema = z.object({
  items: z.array(receiveItemSchema).min(1, 'Enter the quantity received for each fuel type'),
});

export type ReceiveDeliveryValues = z.infer<typeof receiveDeliverySchema>;

export const disputeDeliverySchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(1000, 'Reason is too long'),
});

export type DisputeDeliveryValues = z.infer<typeof disputeDeliverySchema>;

/**
 * doc 03 §42 — `difference = actual − expected`, so a shortage is negative.
 *
 * NOTE: no variance *tolerance* is documented anywhere (ASSUMPTIONS.md §3.2), so
 * this does not decide whether a delivery must be disputed. It only labels the
 * discrepancy; the manager chooses, and the backend remains authoritative.
 */
export function computeVariance(
  expected: number,
  actual: number | null,
): { variance: number | null; hasDiscrepancy: boolean; severity: 'none' | 'short' | 'over' } {
  if (actual === null || actual === undefined) {
    return { variance: null, hasDiscrepancy: false, severity: 'none' };
  }
  const variance = actual - expected;
  if (variance === 0) return { variance, hasDiscrepancy: false, severity: 'none' };
  return {
    variance,
    hasDiscrepancy: true,
    severity: variance < 0 ? 'short' : 'over',
  };
}

/** Common discrepancy reasons offered as quick-select options. */
export const DISCREPANCY_REASONS = [
  'Short delivery',
  'Over delivery',
  'Damaged tanker',
  'Meter reading mismatch',
  'Wrong fuel grade',
  'Contamination reported',
  'Late delivery',
] as const;

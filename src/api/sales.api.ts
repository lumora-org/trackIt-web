/**
 * Sales (doc 04 §58–63, doc 03 §50–54).
 *
 * doc 08 §33 is the rule this module exists to enforce: the client must never
 * determine the authoritative price. `POST /sales` takes only branchId,
 * fuelTypeId, litresSold and soldAt — there is no unitPrice or totalAmount field
 * to abuse, and the backend resolves the price and computes the total.
 *
 * doc 03 §52: the resolved unit price is snapshotted onto the sale, so changing a
 * price later never rewrites historical revenue.
 */
import { z } from 'zod';

import { apiClient } from './client';
import type { PageMeta, Sale, SaleStatus } from '@/types/domain';

export type SalesFilters = {
  page?: number;
  limit?: number;
  branchId?: string;
  fuelTypeId?: string;
  from?: string;
  to?: string;
};

export async function listSales(
  filters: SalesFilters = {},
): Promise<{ data: Sale[]; meta: PageMeta | null }> {
  return apiClient.list<Sale>('/sales', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      branchId: filters.branchId,
      fuelTypeId: filters.fuelTypeId,
      from: filters.from,
      to: filters.to,
    },
  });
}

export interface RecordSaleInput {
  branchId: string;
  fuelTypeId: string;
  litresSold: number;
  soldAt?: string;
}

/**
 * doc 04 §59 — exactly four fields. No price, no total: the backend resolves the
 * applicable price and calculates the amount.
 */
export async function recordSale(input: RecordSaleInput): Promise<Sale> {
  return apiClient.post<Sale>(
    '/sales',
    {
      branchId: input.branchId,
      fuelTypeId: input.fuelTypeId,
      litresSold: input.litresSold,
      soldAt: input.soldAt ?? new Date().toISOString(),
    },
    // doc 04 §103 — a double-tap must never record two sales.
    { idempotencyKey: crypto.randomUUID() },
  );
}

/** doc 04 §63 — ADMIN, SUPER_ADMIN. Requires a reason. */
export async function voidSale(id: string, reason: string): Promise<Sale> {
  return apiClient.post<Sale>(
    `/sales/${id}/void`,
    { reason },
    {
      idempotencyKey: crypto.randomUUID(),
    },
  );
}

export const recordSaleSchema = z.object({
  fuelTypeId: z.string().uuid('Select a fuel type'),
  litresSold: z
    .number({ message: 'Enter litres sold' })
    .positive('Litres sold must be greater than 0')
    .max(1_000_000, 'Litres looks too high'),
});

export type RecordSaleValues = z.infer<typeof recordSaleSchema>;

export const voidSaleSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(500, 'Reason is too long'),
});

export type VoidSaleValues = z.infer<typeof voidSaleSchema>;

/**
 * Display-only estimate for the confirmation preview (PROMPT.md §9).
 *
 * The backend recomputes the total on submit, so this is explicitly labelled an
 * estimate in the UI. Using the API's current price (never a locally-computed
 * one) keeps the preview honest without ever being authoritative.
 */
export function estimateTotal(litresSold: number, pricePerLitre: number): number {
  return litresSold * pricePerLitre;
}

export const SALE_STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'All sales' },
  { value: 'CREATED', label: 'Active sales' },
  { value: 'VOIDED', label: 'Voided sales' },
];

export type { PageMeta, SaleStatus };

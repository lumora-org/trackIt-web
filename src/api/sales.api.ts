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
import type {
  PageMeta,
  Sale,
  SaleApprovalStatus,
  SaleRecordMode,
  SaleStatus,
} from '@/types/domain';

export type SalesFilters = {
  page?: number;
  limit?: number;
  branchId?: string;
  fuelTypeId?: string;
  /** SINGLE = counter transactions; DAY_TOTAL = the manager's day figures. */
  recordMode?: SaleRecordMode;
  /** The admin confirmation gate (product decision 2026-10). */
  approvalStatus?: SaleApprovalStatus;
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
      recordMode: filters.recordMode,
      approvalStatus: filters.approvalStatus,
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

export interface RecordDayTotalInput {
  branchId: string;
  fuelTypeId: string;
  /** Running total litres sold for the day; 0 clears the day's record. */
  totalLitres: number;
  /** Business-timezone calendar day (YYYY-MM-DD); defaults to today. */
  date?: string;
}

/**
 * Product decision (2026-10) — the manager records the branch's TOTAL sales
 * for one fuel on one business day and revises it as the day goes on. The
 * backend books only the difference, so stock stays exact; there is again no
 * price and no amount on the wire. Returns null when the figure was cleared
 * (or a zero no-op), because there is no row to show.
 */
export async function recordDayTotal(input: RecordDayTotalInput): Promise<Sale | null> {
  return apiClient.post<Sale | null>(
    '/sales/day-total',
    {
      branchId: input.branchId,
      fuelTypeId: input.fuelTypeId,
      totalLitres: input.totalLitres,
      ...(input.date ? { date: input.date } : {}),
    },
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

/**
 * Product decision (2026-10) — an admin confirms a manager-recorded figure.
 * Approval is workflow metadata only: the litres and amount already count in
 * every aggregate, so nothing recomputes. A REJECTED figure can be approved
 * as well, reversing a refusal.
 */
export async function approveSale(id: string): Promise<Sale> {
  return apiClient.post<Sale>(
    `/sales/${id}/approve`,
    {},
    { idempotencyKey: crypto.randomUUID() },
  );
}

/**
 * Product decision (2026-10) — refuse a figure that is awaiting review, with a
 * mandatory reason. The figures stay on the books; the manager is notified
 * and their revision returns the row to PENDING.
 */
export async function rejectSale(id: string, reason: string): Promise<Sale> {
  return apiClient.post<Sale>(
    `/sales/${id}/reject`,
    { reason },
    { idempotencyKey: crypto.randomUUID() },
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

/** Product decision (2026-10) — 0 is valid: it clears the day's record. */
export const recordDayTotalSchema = z.object({
  fuelTypeId: z.string().uuid('Select a fuel type'),
  totalLitres: z
    .number({ message: 'Enter the total litres sold' })
    .min(0, 'Total litres cannot be negative')
    .max(1_000_000, 'Litres looks too high'),
});

export type RecordDayTotalValues = z.infer<typeof recordDayTotalSchema>;

export const voidSaleSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(500, 'Reason is too long'),
});

export type VoidSaleValues = z.infer<typeof voidSaleSchema>;

/** Product decision (2026-10) — a rejection is refused without a reason. */
export const rejectSaleSchema = z.object({
  reason: z.string().trim().min(3, 'A reason is required').max(500, 'Reason is too long'),
});

export type RejectSaleValues = z.infer<typeof rejectSaleSchema>;

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

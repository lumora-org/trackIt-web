/**
 * Fuel pricing (doc 04 §29–31, doc 08 §14–52).
 *
 * Pricing is effective-dated. Intervals are `[effectiveFrom, effectiveTo)` —
 * start inclusive, end exclusive (doc 08 §17) — and the backend guarantees they
 * never overlap for the same business + fuel type (doc 08 §20).
 *
 * doc 08 proposes `/history`, `/scheduled`, `/change` and `/:id/cancel`; doc 04
 * specifies only `/fuel-prices`, `/fuel-prices/current/:fuelTypeId` and
 * `POST /fuel-prices`. This module implements doc 04 and derives history and the
 * schedule by filtering the list endpoint. See ASSUMPTIONS.md §2.8.
 */
import { z } from 'zod';

import { apiClient } from './client';
import type { FuelPrice, PageMeta } from '@/types/domain';

export interface FuelPriceFilters {
  page?: number;
  limit?: number;
  fuelTypeId?: string;
  /** doc 04 §29.1 — `active=true` returns only currently-applicable prices. */
  active?: boolean;
  from?: string;
  to?: string;
}

export async function listFuelPrices(
  filters: FuelPriceFilters = {},
): Promise<{ data: FuelPrice[]; meta: PageMeta | null }> {
  return apiClient.list<FuelPrice>('/fuel-prices', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 100,
      fuelTypeId: filters.fuelTypeId,
      active: filters.active === true ? 'true' : undefined,
      from: filters.from,
      to: filters.to,
    },
  });
}

/** doc 04 §30 — returns a single price object. */
export async function getCurrentPrice(fuelTypeId: string) {
  return apiClient.get<{
    fuelTypeId: string;
    pricePerLitre: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>(`/fuel-prices/current/${fuelTypeId}`);
}

/**
 * doc 08 §31 — resolve the price whose interval contains `at`, newest first.
 * The backend does this authoritatively for sales; this helper only labels
 * prices in the UI and must never be used to price a sale.
 */
export function applicablePrice<T extends FuelPrice>(
  prices: readonly T[],
  at: Date = new Date(),
): T | null {
  const timestamp = at.getTime();
  return (
    prices
      .filter((p) => {
        const start = new Date(p.effectiveFrom).getTime();
        if (Number.isNaN(start) || start > timestamp) return false;
        if (p.effectiveTo === null) return true;
        const end = new Date(p.effectiveTo).getTime();
        return !Number.isNaN(end) && end > timestamp;
      })
      .sort((a, b) => +new Date(b.effectiveFrom) - +new Date(a.effectiveFrom))[0] ?? null
  );
}

/** doc 08 §26 / §47 — a price whose effectiveFrom is in the future. */
export function isScheduled(price: FuelPrice, now: Date = new Date()): boolean {
  return +new Date(price.effectiveFrom) > now.getTime();
}

/**
 * doc 08 §71 — `@IsPositive()`: price must be greater than 0.
 * doc 08 §27 — backdating is not allowed through the normal UI, so the form
 * refuses a past date even though the API does not forbid it.
 */
export const createFuelPriceSchema = z
  .object({
    fuelTypeId: z.string().uuid('Select a fuel type'),
    pricePerLitre: z
      .number({ message: 'Enter a price' })
      .positive('Price must be greater than 0')
      .max(1_000_000, 'Price looks too high'),
    effectiveFrom: z.string().min(1, 'Effective date is required'),
  })
  .refine(
    (v) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return +new Date(v.effectiveFrom) >= +today;
    },
    {
      message: 'Backdated prices are not allowed. Choose today or a future date.',
      path: ['effectiveFrom'],
    },
  );

export type CreateFuelPriceInput = z.infer<typeof createFuelPriceSchema>;

/** doc 04 §31 — the backend closes the previous interval and creates this one. */
export async function createFuelPrice(input: CreateFuelPriceInput): Promise<FuelPrice> {
  return apiClient.post<FuelPrice>('/fuel-prices', {
    fuelTypeId: input.fuelTypeId,
    pricePerLitre: input.pricePerLitre,
    effectiveFrom: new Date(input.effectiveFrom).toISOString(),
  });
}

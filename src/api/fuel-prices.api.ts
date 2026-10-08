/**
 * Fuel pricing (doc 04 §29–31, doc 08 §14–52).
 *
 * Pricing is effective-dated. Intervals are `[effectiveFrom, effectiveTo)` —
 * start inclusive, end exclusive (doc 08 §17) — and the backend guarantees they
 * never overlap for the same business + fuel type (doc 08 §20).
 *
 * A price change takes effect immediately (product decision 2026-10): the
 * server stamps the effective instant, so there is no scheduling and no date
 * is ever sent from this client. doc 08 proposes `/history`, `/scheduled`,
 * `/change` and `/:id/cancel`; doc 04 specifies only `/fuel-prices`,
 * `/fuel-prices/current/:fuelTypeId` and `POST /fuel-prices`. This module
 * implements doc 04 and derives history by filtering the list endpoint.
 * See ASSUMPTIONS.md §2.8.
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
  /** SUPER_ADMIN only: scope the list to one business. */
  businessId?: string;
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
      businessId: filters.businessId,
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

/**
 * doc 08 §71 — `@IsPositive()`: price must be greater than 0.
 * Product decision 2026-10 — changes are immediate, so there is deliberately
 * no effective date on the form or in the payload.
 */
export const createFuelPriceSchema = z.object({
  fuelTypeId: z.string().uuid('Select a fuel type'),
  pricePerLitre: z
    .number({ message: 'Enter a price' })
    .positive('Price must be greater than 0')
    .max(1_000_000, 'Price looks too high'),
});

export type CreateFuelPriceInput = z.infer<typeof createFuelPriceSchema>;

/** doc 04 §31 — the server closes the previous interval and opens this one now. */
export async function createFuelPrice(input: CreateFuelPriceInput): Promise<FuelPrice> {
  return apiClient.post<FuelPrice>('/fuel-prices', {
    fuelTypeId: input.fuelTypeId,
    pricePerLitre: input.pricePerLitre,
  });
}

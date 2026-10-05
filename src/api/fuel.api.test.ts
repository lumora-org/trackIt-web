import { describe, expect, it } from 'vitest';

import { createFuelType, createFuelTypeSchema, listFuelTypes } from '@/api/fuel-types.api';
import { applicablePrice, createFuelPriceSchema, isScheduled } from '@/api/fuel-prices.api';
import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import { listFuelPrices } from '@/api/fuel-prices.api';
import { FUEL_PRICES, FUEL_TYPES } from '@/mocks/data';
import { FUEL_TYPE_CODE_PATTERN } from '@/api/fuel-types.api';

async function asAdmin() {
  resetApiClientForTests();
  const session = await login({ email: 'admin@kbyglobal.com', password: 'Password123!' });
  setAccessToken(session.accessToken);
}

describe('fuel type code validation (doc 08 §70)', () => {
  it('accepts PMS / AGO / DPK', () => {
    for (const code of ['PMS', 'AGO', 'DPK']) {
      expect(FUEL_TYPE_CODE_PATTERN.test(code)).toBe(true);
      expect(createFuelTypeSchema.safeParse({ name: 'Fuel', code }).success).toBe(true);
    }
  });

  it('uppercases a lowercase code', () => {
    const parsed = createFuelTypeSchema.parse({ name: 'Fuel', code: 'pms' });
    expect(parsed.code).toBe('PMS');
  });

  it('trims surrounding whitespace on the code', () => {
    const parsed = createFuelTypeSchema.parse({ name: 'Fuel', code: '  pms  ' });
    expect(parsed.code).toBe('PMS');
  });

  it('rejects spaces, dots and lowercase-only input before transform', () => {
    for (const code of ['P M S', 'P.M.S', 'pm s']) {
      expect(FUEL_TYPE_CODE_PATTERN.test(code.toUpperCase())).toBe(!/[.\s]/.test(code));
      expect(createFuelTypeSchema.safeParse({ name: 'Fuel', code }).success).toBe(false);
    }
  });

  it('allows hyphens and underscores', () => {
    expect(createFuelTypeSchema.safeParse({ name: 'X', code: 'A-B_C1' }).success).toBe(true);
  });
});

describe('fuel type CRUD', () => {
  it('lists the seeded fuel types', async () => {
    await asAdmin();
    const { data } = await listFuelTypes({ limit: 100 });
    expect(data.map((f) => f.code).sort()).toEqual(['AGO', 'DPK', 'PMS']);
  });

  it('rejects a duplicate code with 409 (doc 03 §30)', async () => {
    await asAdmin();
    const code = FUEL_TYPES[0]!.code;
    await expect(createFuelType({ name: 'Duplicate', code })).rejects.toMatchObject({
      statusCode: 409,
      code: 'RESOURCE_ALREADY_EXISTS',
    });
  });

  it('trims the name before sending', async () => {
    await asAdmin();
    // Normalisation is the schema's job, which is the path the form always takes.
    const values = createFuelTypeSchema.parse({ name: '  Premium Grade  ', code: 'PGX' });
    const created = await createFuelType(values);
    expect(created.name).toBe('Premium Grade');
    expect(created.code).toBe('PGX');
  });
});

describe('applicablePrice (doc 08 §17)', () => {
  const prices = FUEL_PRICES.filter((p) => p.fuelTypeId === FUEL_TYPES[0]!.id);

  it('picks the price whose [from, to) interval contains the instant', () => {
    // Between the second and third price windows.
    const at = new Date(new Date(prices[2]!.effectiveFrom).getTime() + 60_000);
    expect(applicablePrice(prices, at)?.pricePerLitre).toBe(1600);
  });

  it('treats effectiveFrom as inclusive and effectiveTo as exclusive', () => {
    const boundary = new Date(prices[1]!.effectiveFrom);
    // Exactly at the boundary the newer price applies (doc 08 §18).
    expect(applicablePrice(prices, boundary)?.pricePerLitre).toBe(1550);
  });

  it('returns null before any price exists', () => {
    expect(applicablePrice(prices, new Date('2020-01-01T00:00:00Z'))).toBeNull();
  });

  it('ignores a future price for a present instant', () => {
    const now = new Date();
    expect(applicablePrice(prices, now)?.pricePerLitre).toBe(1600);
  });
});

describe('isScheduled (doc 08 §26)', () => {
  it('flags a future price', () => {
    const future = FUEL_PRICES.find((p) => isScheduled(p));
    expect(future).toBeDefined();
  });

  it('does not flag a past or present price', () => {
    expect(FUEL_PRICES.filter((p) => isScheduled(p)).length).toBe(1);
  });
});

describe('fuel price validation (doc 08 §71)', () => {
  const valid = {
    fuelTypeId: FUEL_TYPES[0]!.id,
    pricePerLitre: 1650,
    effectiveFrom: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  };

  it('accepts a positive future price', () => {
    expect(createFuelPriceSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects zero and negative prices (@IsPositive)', () => {
    expect(createFuelPriceSchema.safeParse({ ...valid, pricePerLitre: 0 }).success).toBe(false);
    expect(createFuelPriceSchema.safeParse({ ...valid, pricePerLitre: -5 }).success).toBe(false);
  });

  it('rejects a backdated price (doc 08 §27)', () => {
    const past = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const result = createFuelPriceSchema.safeParse({ ...valid, effectiveFrom: past });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/backdated/i);
    }
  });

  it('accepts today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(createFuelPriceSchema.safeParse({ ...valid, effectiveFrom: today }).success).toBe(true);
  });
});

describe('fuel prices listing', () => {
  it('filters by fuel type', async () => {
    await asAdmin();
    const { data } = await listFuelPrices({ fuelTypeId: FUEL_TYPES[0]!.id, limit: 100 });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((p) => p.fuelTypeId === FUEL_TYPES[0]!.id)).toBe(true);
  });

  it('returns only currently-applicable prices when active=true', async () => {
    await asAdmin();
    const { data } = await listFuelPrices({ active: true, limit: 100 });
    const now = Date.now();
    expect(
      data.every(
        (p) =>
          +new Date(p.effectiveFrom) <= now &&
          (p.effectiveTo === null || +new Date(p.effectiveTo) > now),
      ),
    ).toBe(true);
    // The seeded future PMS price must not appear as active.
    expect(data.some((p) => p.pricePerLitre === 1650)).toBe(false);
  });
});

describe('price overlap protection (doc 08 §20)', () => {
  it('rejects a price period that overlaps an existing one', async () => {
    await asAdmin();
    const existing = FUEL_PRICES.find(
      (p) => p.effectiveTo === null && p.fuelTypeId === FUEL_TYPES[1]!.id,
    )!;
    const { createFuelPrice } = await import('@/api/fuel-prices.api');

    await expect(
      createFuelPrice({
        fuelTypeId: existing.fuelTypeId,
        pricePerLitre: 1900,
        // Lands inside the existing open-ended interval.
        effectiveFrom: new Date(new Date(existing.effectiveFrom).getTime() + 86_400_000)
          .toISOString()
          .slice(0, 10),
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_FUEL_PRICE' });
  });
});

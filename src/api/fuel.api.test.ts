import { describe, expect, it } from 'vitest';

import { createFuelType, createFuelTypeSchema, listFuelTypes } from '@/api/fuel-types.api';
import {
  applicablePrice,
  createFuelPrice,
  createFuelPriceSchema,
  getCurrentPrice,
  listFuelPrices,
} from '@/api/fuel-prices.api';
import { login } from '@/api/auth.api';
import { apiClient, resetApiClientForTests, setAccessToken } from '@/api/client';
import { FUEL_PRICES, FUEL_TYPES } from '@/mocks/data';
import { FUEL_TYPE_CODE_PATTERN } from '@/api/fuel-types.api';

async function asAdmin() {
  resetApiClientForTests();
  const session = await login({ email: 'admin@kbyglobal.com', password: 'Password123!' });
  setAccessToken(session.accessToken);
}

async function asManager() {
  resetApiClientForTests();
  const session = await login({ email: 'manager@kbyglobal.com', password: 'Password123!' });
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

  it('has no future-dated fixtures — a price is never scheduled', () => {
    const now = Date.now();
    expect(FUEL_PRICES.every((p) => +new Date(p.effectiveFrom) <= now)).toBe(true);
  });
});

describe('fuel price validation (doc 08 §71)', () => {
  const valid = {
    fuelTypeId: FUEL_TYPES[0]!.id,
    pricePerLitre: 1650,
  };

  it('accepts a positive price', () => {
    expect(createFuelPriceSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects zero and negative prices (@IsPositive)', () => {
    expect(createFuelPriceSchema.safeParse({ ...valid, pricePerLitre: 0 }).success).toBe(false);
    expect(createFuelPriceSchema.safeParse({ ...valid, pricePerLitre: -5 }).success).toBe(false);
  });

  it('carries no effective date — the server stamps the instant', () => {
    const legacyPayload = { ...valid, effectiveFrom: new Date().toISOString() };
    const parsed = createFuelPriceSchema.parse(legacyPayload);
    expect('effectiveFrom' in parsed).toBe(false);
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
    // The seeded PMS price in force today.
    expect(data.some((p) => p.pricePerLitre === 1600)).toBe(true);
  });
});

describe('immediate price changes (product decision 2026-10)', () => {
  it('applies the new price at once, closing the current period at the same instant', async () => {
    await asAdmin();
    const before = await getCurrentPrice(FUEL_TYPES[0]!.id);
    expect(before.pricePerLitre).toBe(1600);

    const created = await createFuelPrice({ fuelTypeId: FUEL_TYPES[0]!.id, pricePerLitre: 1725 });
    expect(+new Date(created.effectiveFrom)).toBeLessThanOrEqual(Date.now());
    expect(created.effectiveTo).toBeNull();

    const after = await getCurrentPrice(FUEL_TYPES[0]!.id);
    expect(after.pricePerLitre).toBe(1725);

    const { data } = await listFuelPrices({ fuelTypeId: FUEL_TYPES[0]!.id, limit: 100 });
    const previous = data.find((p) => p.pricePerLitre === 1600)!;
    expect(previous.effectiveTo).toBe(created.effectiveFrom);
  });

  it('drops a legacy scheduled period instead of scheduling around it', async () => {
    await asAdmin();
    FUEL_PRICES.push({
      id: crypto.randomUUID(),
      fuelTypeId: FUEL_TYPES[1]!.id,
      pricePerLitre: 9999,
      effectiveFrom: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      effectiveTo: null,
    });

    await createFuelPrice({ fuelTypeId: FUEL_TYPES[1]!.id, pricePerLitre: 1800 });

    const { data } = await listFuelPrices({ fuelTypeId: FUEL_TYPES[1]!.id, limit: 100 });
    expect(data.some((p) => p.pricePerLitre === 9999)).toBe(false);
    const after = await getCurrentPrice(FUEL_TYPES[1]!.id);
    expect(after.pricePerLitre).toBe(1800);
  });

  it('rejects an effectiveFrom outright — scheduling no longer exists', async () => {
    await asAdmin();
    await expect(
      apiClient.post('/fuel-prices', {
        fuelTypeId: FUEL_TYPES[0]!.id,
        pricePerLitre: 1700,
        effectiveFrom: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('lets a manager read prices but not change them', async () => {
    await asAdmin();
    await createFuelPrice({ fuelTypeId: FUEL_TYPES[0]!.id, pricePerLitre: 1680 });

    await asManager();
    const { data } = await listFuelPrices({ fuelTypeId: FUEL_TYPES[0]!.id, limit: 100 });
    expect(data.length).toBeGreaterThan(0);
    const current = await getCurrentPrice(FUEL_TYPES[0]!.id);
    expect(current.pricePerLitre).toBe(1680);
    await expect(
      createFuelPrice({ fuelTypeId: FUEL_TYPES[0]!.id, pricePerLitre: 1700 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

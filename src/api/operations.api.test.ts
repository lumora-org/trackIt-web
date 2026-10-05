import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import {
  createAdjustment,
  getInventoryStock,
  listInventoryTransactions,
  adjustmentSchema,
} from '@/api/inventory.api';
import { listSales, recordSale, recordSaleSchema, voidSale } from '@/api/sales.api';
import { BRANCHES, FUEL_TYPES, INVENTORY_STOCK, SALES } from '@/mocks/data';

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

const ikeja = BRANCHES[0]!.id;
const pms = FUEL_TYPES[0]!.id;

describe('inventory stock', () => {
  it('returns a bare array, not a paginated envelope (doc 04 §54)', async () => {
    await asManager();
    const stock = await getInventoryStock({ branchId: ikeja });
    expect(Array.isArray(stock)).toBe(true);
    expect(stock.every((s) => s.branchId === ikeja)).toBe(true);
  });

  it('scopes a manager to their branch even without a filter', async () => {
    await asManager();
    const stock = await getInventoryStock();
    expect(stock.every((s) => s.branchId === ikeja)).toBe(true);
  });
});

describe('inventory ledger', () => {
  it('filters by transaction type', async () => {
    await asManager();
    const { data } = await listInventoryTransactions({ branchId: ikeja, type: 'SALE', limit: 100 });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((t) => t.transactionType === 'SALE')).toBe(true);
  });

  it('uses negative quantities for SALE and positive for DELIVERY (doc 03 §45)', async () => {
    await asManager();
    const { data } = await listInventoryTransactions({ branchId: ikeja, limit: 100 });
    const sales = data.filter((t) => t.transactionType === 'SALE');
    const deliveries = data.filter((t) => t.transactionType === 'DELIVERY');
    expect(sales.every((t) => t.quantityLitres < 0)).toBe(true);
    expect(deliveries.every((t) => t.quantityLitres > 0)).toBe(true);
  });

  it('carries a running balance', async () => {
    await asManager();
    const { data } = await listInventoryTransactions({ branchId: ikeja, limit: 100 });
    expect(data.every((t) => typeof t.balanceAfter === 'number')).toBe(true);
  });
});

describe('inventory adjustments', () => {
  it('requires a reason (PRD rule 10)', async () => {
    await asAdmin();
    await expect(
      createAdjustment({
        branchId: ikeja,
        fuelTypeId: pms,
        quantityLitres: -10,
        reason: '',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('accepts a signed adjustment and appends an immutable transaction', async () => {
    await asAdmin();
    const before = INVENTORY_STOCK.find(
      (s) => s.branchId === ikeja && s.fuelTypeId === pms,
    )!.currentQuantityLitres;

    await createAdjustment({
      branchId: ikeja,
      fuelTypeId: pms,
      quantityLitres: -100,
      reason: 'Physical stock count discrepancy',
    });

    const after = INVENTORY_STOCK.find(
      (s) => s.branchId === ikeja && s.fuelTypeId === pms,
    )!.currentQuantityLitres;
    expect(after).toBe(before - 100);
  });

  it('rejects an adjustment that would drive stock negative', async () => {
    await asAdmin();
    await expect(
      createAdjustment({
        branchId: ikeja,
        fuelTypeId: pms,
        quantityLitres: -99_000_000,
        reason: 'Typo',
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INSUFFICIENT_INVENTORY' });
  });

  it("refuses a manager's adjustment (doc 04 §57 — ADMIN, SUPER_ADMIN)", async () => {
    await asManager();
    await expect(
      createAdjustment({
        branchId: ikeja,
        fuelTypeId: pms,
        quantityLitres: 10,
        reason: 'test',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('validates direction and a positive magnitude', () => {
    expect(
      adjustmentSchema.safeParse({
        fuelTypeId: pms,
        direction: 'decrease',
        quantityLitres: 0,
        reason: 'x',
      }).success,
    ).toBe(false);
    expect(
      adjustmentSchema.safeParse({
        fuelTypeId: pms,
        direction: 'increase',
        quantityLitres: 5,
        reason: 'x',
      }).success,
    ).toBe(true);
  });
});

describe('recording a sale (doc 08 §33 — the client never prices)', () => {
  it('resolves the price server-side and computes the total', async () => {
    await asAdmin();
    const sale = await recordSale({ branchId: ikeja, fuelTypeId: pms, litresSold: 100 });

    expect(sale.unitPrice).toBeGreaterThan(0);
    expect(sale.totalAmount).toBe(sale.litresSold * sale.unitPrice);
    expect(sale.saleNumber).toMatch(/^SALE-\d{4}-\d{6}$/);
  });

  it('decrements inventory by the litres sold', async () => {
    await asAdmin();
    const before = INVENTORY_STOCK.find(
      (s) => s.branchId === ikeja && s.fuelTypeId === pms,
    )!.currentQuantityLitres;

    await recordSale({ branchId: ikeja, fuelTypeId: pms, litresSold: 8500 });

    const after = INVENTORY_STOCK.find(
      (s) => s.branchId === ikeja && s.fuelTypeId === pms,
    )!.currentQuantityLitres;
    expect(after).toBe(before - 8500);
  });

  it('writes a negative SALE transaction (doc 03 §54)', async () => {
    await asAdmin();
    await recordSale({ branchId: ikeja, fuelTypeId: pms, litresSold: 100 });
    const { data } = await listInventoryTransactions({ branchId: ikeja, type: 'SALE', limit: 1 });
    expect(data[0]?.quantityLitres).toBe(-100);
  });

  it('rejects more litres than available with INSUFFICIENT_INVENTORY (doc 03 §73)', async () => {
    await asAdmin();
    await expect(
      recordSale({ branchId: ikeja, fuelTypeId: pms, litresSold: 99_000_000 }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INSUFFICIENT_INVENTORY' });
  });

  it('rejects a non-positive quantity', () => {
    expect(recordSaleSchema.safeParse({ fuelTypeId: pms, litresSold: 0 }).success).toBe(false);
    expect(recordSaleSchema.safeParse({ fuelTypeId: pms, litresSold: -1 }).success).toBe(false);
    expect(recordSaleSchema.safeParse({ fuelTypeId: pms, litresSold: 1 }).success).toBe(true);
  });

  it('refuses a manager selling for another branch (doc 04 §93)', async () => {
    await asManager();
    await expect(
      recordSale({ branchId: BRANCHES[1]!.id, fuelTypeId: pms, litresSold: 10 }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
  });

  it('allows a manager to sell for their own branch', async () => {
    await asManager();
    const sale = await recordSale({ branchId: ikeja, fuelTypeId: pms, litresSold: 100 });
    expect(sale.branchId).toBe(ikeja);
  });
});

describe('voiding a sale (doc 04 §63)', () => {
  it('restores inventory with a CORRECTION rather than deleting history', async () => {
    await asAdmin();
    const before = INVENTORY_STOCK.find(
      (s) => s.branchId === ikeja && s.fuelTypeId === pms,
    )!.currentQuantityLitres;

    const target = SALES.find((s) => !s.voidedAt && s.branchId === ikeja)!;
    await voidSale(target.id, 'Duplicate sale entry');

    const after = INVENTORY_STOCK.find(
      (s) => s.branchId === ikeja && s.fuelTypeId === pms,
    )!.currentQuantityLitres;
    // The correction is positive and the original sale row still exists.
    expect(after).toBe(before + target.litresSold);
    expect(
      (await listSales({ branchId: ikeja, limit: 100 })).data.some((s) => s.id === target.id),
    ).toBe(true);
  });

  it('requires a reason', async () => {
    await asAdmin();
    const target = SALES.find((s) => !s.voidedAt)!;
    await expect(voidSale(target.id, '')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses to void an already-voided sale', async () => {
    await asAdmin();
    const voided = SALES.find((s) => s.voidedAt)!;
    await expect(voidSale(voided.id, 'again')).rejects.toMatchObject({ statusCode: 422 });
  });

  it("refuses a manager's void (doc 04 §63 — ADMIN, SUPER_ADMIN)", async () => {
    await asManager();
    const target = SALES.find((s) => !s.voidedAt)!;
    await expect(voidSale(target.id, 'nope')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('sales listing', () => {
  it('returns most recent first', async () => {
    await asAdmin();
    const { data } = await listSales({ limit: 100 });
    const timestamps = data.map((s) => +new Date(s.soldAt));
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it('scopes a manager to their branch', async () => {
    await asManager();
    const { data } = await listSales({ limit: 100 });
    expect(data.every((s) => s.branchId === ikeja)).toBe(true);
  });
});

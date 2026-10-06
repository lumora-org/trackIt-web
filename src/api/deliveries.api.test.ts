import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import {
  computeVariance,
  listDeliveries,
  receiveDelivery,
  receiveDeliverySchema,
} from '@/api/deliveries.api';
import { BRANCHES, DELIVERIES, FUEL_TYPES } from '@/mocks/data';
import { INVENTORY_STOCK } from '@/mocks/data';

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

describe('computeVariance (doc 03 §42: difference = actual − expected)', () => {
  it('reports a shortage as negative', () => {
    // doc 08 §11 worked example.
    const result = computeVariance(45000, 44850);
    expect(result.variance).toBe(-150);
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.severity).toBe('short');
  });

  it('reports an over-delivery as positive', () => {
    const result = computeVariance(45000, 46500);
    expect(result.variance).toBe(1500);
    expect(result.severity).toBe('over');
  });

  it('reports an exact match with no discrepancy', () => {
    const result = computeVariance(45000, 45000);
    expect(result.variance).toBe(0);
    expect(result.hasDiscrepancy).toBe(false);
  });

  it('treats an unreceived delivery as unknown, not a discrepancy', () => {
    expect(computeVariance(45000, null)).toEqual({
      variance: null,
      hasDiscrepancy: false,
      severity: 'none',
    });
  });

  it('treats a zero delivery as a discrepancy, not "no data"', () => {
    expect(computeVariance(45000, 0).hasDiscrepancy).toBe(true);
  });
});

describe('receive delivery validation (doc 09 §13 — quantity >= 0)', () => {
  it('accepts zero (unlike an order, which must be > 0)', () => {
    expect(
      receiveDeliverySchema.safeParse({
        items: [{ fuelTypeId: FUEL_TYPES[0]!.id, actualQuantityLitres: 0 }],
      }).success,
    ).toBe(true);
  });

  it('rejects a negative quantity', () => {
    expect(
      receiveDeliverySchema.safeParse({
        items: [{ fuelTypeId: FUEL_TYPES[0]!.id, actualQuantityLitres: -1 }],
      }).success,
    ).toBe(false);
  });

  it('requires at least one item', () => {
    expect(receiveDeliverySchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe('receiving a delivery', () => {
  it('adds the ACTUAL quantity to inventory, not the expected quantity', async () => {
    await asAdmin();
    const pending = DELIVERIES.find((d) => d.status === 'PENDING')!;
    const item = pending.items[0]!;

    const stockBefore = INVENTORY_STOCK.find(
      (s) => s.branchId === pending.destinationBranchId && s.fuelTypeId === item.fuelTypeId,
    )!.currentQuantityLitres;

    await receiveDelivery(pending.id, [
      { fuelTypeId: item.fuelTypeId, actualQuantityLitres: 44000 },
    ]);

    const stockAfter = INVENTORY_STOCK.find(
      (s) => s.branchId === pending.destinationBranchId && s.fuelTypeId === item.fuelTypeId,
    )!.currentQuantityLitres;

    // doc 04 §49 — expected (45,000) must never be the inventory movement.
    expect(stockAfter - stockBefore).toBe(44000);
    expect(stockAfter - stockBefore).not.toBe(item.expectedQuantityLitres);
  });

  it('records the signed difference and marks the delivery RECEIVED', async () => {
    await asAdmin();
    const pending = DELIVERIES.find((d) => d.status === 'PENDING')!;
    const item = pending.items[0]!;

    const updated = await receiveDelivery(pending.id, [
      {
        fuelTypeId: item.fuelTypeId,
        actualQuantityLitres: item.expectedQuantityLitres - 150,
        discrepancyReason: 'Short delivery',
      },
    ]);

    expect(updated.status).toBe('RECEIVED');
    expect(updated.items[0]?.differenceLitres).toBe(-150);
    expect(updated.items[0]?.discrepancyReason).toBe('Short delivery');
  });

  it('rejects receiving an already-received delivery', async () => {
    await asAdmin();
    const received = DELIVERIES.find((d) => d.status === 'RECEIVED')!;
    await expect(
      receiveDelivery(received.id, [
        { fuelTypeId: received.items[0]!.fuelTypeId, actualQuantityLitres: 100 },
      ]),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_DELIVERY_STATUS' });
  });

  it('lets a branch manager receive their own branch delivery', async () => {
    await asManager();
    const pending = DELIVERIES.find(
      (d) => d.status === 'PENDING' && d.destinationBranchId === BRANCHES[0]!.id,
    );
    expect(pending).toBeDefined();
    const updated = await receiveDelivery(pending!.id, [
      { fuelTypeId: pending!.items[0]!.fuelTypeId, actualQuantityLitres: 45000 },
    ]);
    expect(updated.status).toBe('RECEIVED');
  });

  it("refuses a manager receiving another branch's delivery (doc 04 §93)", async () => {
    await asManager();
    const otherBranch = DELIVERIES.find((d) => d.destinationBranchId !== BRANCHES[0]!.id)!;
    await expect(
      receiveDelivery(otherBranch.id, [
        { fuelTypeId: otherBranch.items[0]!.fuelTypeId, actualQuantityLitres: 100 },
      ]),
    ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
  });
});

describe('delivery listing', () => {
  it('filters by status', async () => {
    await asAdmin();
    const { data } = await listDeliveries({ status: 'PENDING', limit: 100 });
    expect(data.every((d) => d.status === 'PENDING')).toBe(true);
  });

  it('scopes a manager to their own branch', async () => {
    await asManager();
    const { data } = await listDeliveries({ limit: 100 });
    expect(data.every((d) => d.destinationBranchId === BRANCHES[0]!.id)).toBe(true);
  });
});

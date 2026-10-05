import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import {
  cancelFuelOrder,
  confirmFuelOrder,
  createFuelOrder,
  createFuelOrderSchema,
  listFuelOrders,
  markFuelOrderInTransit,
  submitFuelOrder,
} from '@/api/fuel-orders.api';
import { BRANCHES, FUEL_ORDERS, FUEL_TYPES, SUPPLIERS } from '@/mocks/data';
import { FUEL_ORDER_TRANSITIONS } from '@/types/domain';

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

describe('fuel order validation', () => {
  const valid = {
    supplierId: SUPPLIERS[0]!.id,
    destinationBranchId: BRANCHES[0]!.id,
    expectedDeliveryAt: '2026-11-01T09:00',
    items: [{ fuelTypeId: FUEL_TYPES[0]!.id, expectedQuantityLitres: 45000, unitCost: 1200 }],
  };

  it('accepts a well-formed order', () => {
    expect(createFuelOrderSchema.safeParse(valid).success).toBe(true);
  });

  it('requires at least one item (an assumption — doc 09 is silent)', () => {
    expect(createFuelOrderSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it('rejects a non-positive expected quantity (doc 09 §13)', () => {
    expect(
      createFuelOrderSchema.safeParse({
        ...valid,
        items: [{ ...valid.items[0]!, expectedQuantityLitres: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a non-positive unit cost', () => {
    expect(
      createFuelOrderSchema.safeParse({
        ...valid,
        items: [{ ...valid.items[0]!, unitCost: 0 }],
      }).success,
    ).toBe(false);
  });

  it('requires a supplier and a destination branch', () => {
    expect(createFuelOrderSchema.safeParse({ ...valid, supplierId: '' }).success).toBe(false);
    expect(createFuelOrderSchema.safeParse({ ...valid, destinationBranchId: '' }).success).toBe(
      false,
    );
  });
});

describe('fuel order creation', () => {
  it('creates a DRAFT with a server-generated order number (doc 09 §8)', async () => {
    await asAdmin();
    const values = createFuelOrderSchema.parse({
      supplierId: SUPPLIERS[0]!.id,
      destinationBranchId: BRANCHES[0]!.id,
      expectedDeliveryAt: '2026-11-01T09:00',
      items: [{ fuelTypeId: FUEL_TYPES[0]!.id, expectedQuantityLitres: 45000, unitCost: 1200 }],
    });
    const order = await createFuelOrder(values);

    expect(order.status).toBe('DRAFT');
    // The frontend must never generate this (doc 09 §8).
    expect(order.orderNumber).toMatch(/^ORD-\d{4}-\d{6}$/);
    expect(order.items[0]?.fuelTypeName).toBe('PMS');
  });

  it('rejects order creation by a manager (doc 04 §43)', async () => {
    await asManager();
    await expect(
      createFuelOrder({
        supplierId: SUPPLIERS[0]!.id,
        destinationBranchId: BRANCHES[0]!.id,
        expectedDeliveryAt: '2026-11-01T09:00',
        items: [{ fuelTypeId: FUEL_TYPES[0]!.id, expectedQuantityLitres: 100, unitCost: 10 }],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('fuel order lifecycle (doc 09 §9, doc 04 §43-46)', () => {
  it('submits a draft', async () => {
    await asAdmin();
    const draft = FUEL_ORDERS.find((o) => o.status === 'DRAFT')!;
    const updated = await submitFuelOrder(draft.id);
    expect(updated.status).toBe('SUBMITTED');
  });

  it('confirms a submitted order', async () => {
    await asAdmin();
    const submitted = FUEL_ORDERS.find((o) => o.status === 'SUBMITTED')!;
    const updated = await confirmFuelOrder(submitted.id);
    expect(updated.status).toBe('CONFIRMED');
  });

  it('marks a confirmed order in transit', async () => {
    await asAdmin();
    const confirmed = FUEL_ORDERS.find((o) => o.status === 'CONFIRMED')!;
    const updated = await markFuelOrderInTransit(confirmed.id);
    expect(updated.status).toBe('IN_TRANSIT');
  });

  it('rejects an illegal transition with INVALID_ORDER_STATUS', async () => {
    await asAdmin();
    const draft = FUEL_ORDERS.find((o) => o.status === 'DRAFT')!;
    // A draft cannot jump straight to in transit.
    await expect(markFuelOrderInTransit(draft.id)).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_ORDER_STATUS',
    });
  });

  it('rejects a transition out of a terminal state', async () => {
    await asAdmin();
    const cancelled = FUEL_ORDERS.find((o) => o.status === 'CANCELLED')!;
    await expect(submitFuelOrder(cancelled.id)).rejects.toMatchObject({
      code: 'INVALID_ORDER_STATUS',
    });
  });

  it('requires a cancellation reason (doc 04 §46)', async () => {
    await asAdmin();
    const draft = FUEL_ORDERS.find((o) => o.status === 'DRAFT')!;
    await expect(cancelFuelOrder(draft.id, '   ')).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('cancels with a reason', async () => {
    await asAdmin();
    const draft = FUEL_ORDERS.find((o) => o.status === 'DRAFT')!;
    const updated = await cancelFuelOrder(draft.id, 'Supplier could not fulfil the order.');
    expect(updated.status).toBe('CANCELLED');
  });

  it('refuses lifecycle transitions for a manager', async () => {
    await asManager();
    const draft = FUEL_ORDERS.find((o) => o.status === 'DRAFT')!;
    await expect(submitFuelOrder(draft.id)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('fuel order state machine', () => {
  it('has no transitions out of DELIVERED or CANCELLED', () => {
    expect(FUEL_ORDER_TRANSITIONS.DELIVERED).toEqual([]);
    expect(FUEL_ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('allows cancellation only before transit', () => {
    expect(FUEL_ORDER_TRANSITIONS.DRAFT).toContain('CANCELLED');
    expect(FUEL_ORDER_TRANSITIONS.SUBMITTED).toContain('CANCELLED');
    expect(FUEL_ORDER_TRANSITIONS.CONFIRMED).toContain('CANCELLED');
    // doc 09 §9 — cancelling once delivery has started needs intervention.
    expect(FUEL_ORDER_TRANSITIONS.IN_TRANSIT).not.toContain('CANCELLED');
  });

  it('follows the documented forward path', () => {
    expect(FUEL_ORDER_TRANSITIONS.DRAFT).toContain('SUBMITTED');
    expect(FUEL_ORDER_TRANSITIONS.SUBMITTED).toContain('CONFIRMED');
    expect(FUEL_ORDER_TRANSITIONS.CONFIRMED).toContain('IN_TRANSIT');
    expect(FUEL_ORDER_TRANSITIONS.IN_TRANSIT).toContain('PARTIALLY_DELIVERED');
    expect(FUEL_ORDER_TRANSITIONS.PARTIALLY_DELIVERED).toContain('DELIVERED');
  });
});

describe('fuel order listing', () => {
  it('filters by status', async () => {
    await asAdmin();
    const { data } = await listFuelOrders({ status: 'DRAFT', limit: 100 });
    expect(data.every((o) => o.status === 'DRAFT')).toBe(true);
  });

  it('scopes a manager to their own branch (doc 04 §93)', async () => {
    await asManager();
    const { data } = await listFuelOrders({ limit: 100 });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((o) => o.destinationBranch.id === BRANCHES[0]!.id)).toBe(true);
  });

  it('ignores a manager-supplied branchId rather than honouring it', async () => {
    await asManager();
    const { data } = await listFuelOrders({
      branchId: BRANCHES[2]!.id,
      limit: 100,
    });
    expect(data.every((o) => o.destinationBranch.id === BRANCHES[0]!.id)).toBe(true);
  });

  it('paginates with the documented meta shape', async () => {
    await asAdmin();
    const { meta } = await listFuelOrders({ page: 1, limit: 2 });
    expect(meta).toEqual({
      page: 1,
      limit: 2,
      total: FUEL_ORDERS.length,
      totalPages: Math.ceil(FUEL_ORDERS.length / 2),
    });
  });
});

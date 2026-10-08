/**
 * Fuel orders (doc 04 §40–46, doc 09 §6–13).
 *
 * doc 09 §1 is the single most important rule in this module: an order is a
 * procurement commitment, NOT stock. Inventory only moves when a delivery is
 * received, so nothing here touches inventory.
 */
import { z } from 'zod';

import { apiClient } from './client';
import type { FuelOrder, FuelOrderItemInput, FuelOrderStatus, PageMeta } from '@/types/domain';

export interface FuelOrderFilters {
  page?: number;
  limit?: number;
  status?: FuelOrderStatus;
  branchId?: string;
  supplierId?: string;
  from?: string;
  to?: string;
}

export async function listFuelOrders(
  filters: FuelOrderFilters = {},
): Promise<{ data: FuelOrder[]; meta: PageMeta | null }> {
  return apiClient.list<FuelOrder>('/fuel-orders', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      status: filters.status,
      branchId: filters.branchId,
      supplierId: filters.supplierId,
      from: filters.from,
      to: filters.to,
    },
  });
}

export async function getFuelOrder(id: string): Promise<FuelOrder> {
  return apiClient.get<FuelOrder>(`/fuel-orders/${id}`);
}

/**
 * doc 04 §41 — exactly five top-level fields. `businessId` is absent because the
 * backend derives it, and `status` is absent because an order is always created
 * as DRAFT. `tankerId` is optional (product decision, 2026-10): attach it now
 * when known, otherwise dispatch sets it when the order goes IN_TRANSIT.
 */
export async function createFuelOrder(input: CreateFuelOrderInput): Promise<FuelOrder> {
  return apiClient.post<FuelOrder>(
    '/fuel-orders',
    {
      supplierId: input.supplierId,
      destinationBranchId: input.destinationBranchId,
      expectedDeliveryAt: new Date(input.expectedDeliveryAt).toISOString(),
      tankerId: input.tankerId ? input.tankerId : undefined,
      notes: input.notes ? input.notes : undefined,
      items: input.items.map((item) => ({
        fuelTypeId: item.fuelTypeId,
        expectedQuantityLitres: item.expectedQuantityLitres,
        unitCost: item.unitCost,
      })),
    },
    // doc 04 §103 — POST /fuel-orders is idempotency-key eligible, which stops a
    // double-tap on a slow network creating two orders.
    { idempotencyKey: crypto.randomUUID() },
  );
}

/*
 * doc 04 §43-46 — submit, confirm, in-transit and cancel. Only cancel takes a
 * body, and it requires a reason.
 */
const transition = (id: string, action: string, body?: unknown) =>
  apiClient.post<FuelOrder>(`/fuel-orders/${id}/${action}`, body, {
    idempotencyKey: crypto.randomUUID(),
  });

export const submitFuelOrder = (id: string) => transition(id, 'submit');
export const confirmFuelOrder = (id: string) => transition(id, 'confirm');
export const markFuelOrderInTransit = (id: string) => transition(id, 'in-transit');
export const cancelFuelOrder = (id: string, reason: string) => transition(id, 'cancel', { reason });

/* ------------------------------------------------------------ validation */

/*
 * doc 09 §13 — expected quantities must be > 0 and there is no documented upper
 * bound. doc 09 never states that an order must have at least one item; requiring
 * one is an explicit assumption (ASSUMPTIONS.md §3.12).
 */
const orderItemSchema = z.object({
  fuelTypeId: z.string().uuid('Select a fuel type'),
  expectedQuantityLitres: z
    .number({ message: 'Enter a quantity' })
    .positive('Quantity must be greater than 0')
    .max(10_000_000, 'Quantity looks too high'),
  unitCost: z
    .number({ message: 'Enter a unit cost' })
    .positive('Unit cost must be greater than 0')
    .max(10_000_000, 'Unit cost looks too high'),
});

export const createFuelOrderSchema = z.object({
  supplierId: z.string().uuid('Select a supplier'),
  destinationBranchId: z.string().uuid('Select a destination branch'),
  expectedDeliveryAt: z.string().min(1, 'Expected delivery date is required'),
  /** Optional (product decision, 2026-10) — '' means "not assigned yet". */
  tankerId: z.union([z.literal(''), z.string().uuid()]).optional(),
  notes: z.string().trim().max(1000, 'Notes are too long').optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'Add at least one fuel type to the order')
    .max(20, 'An order cannot have more than 20 line items'),
});

export type CreateFuelOrderInput = z.infer<typeof createFuelOrderSchema>;

/** doc 09 §7 — procurement cost is entirely separate from the retail price. */
export function estimatedProcurementValue(item: FuelOrderItemInput): number {
  return item.expectedQuantityLitres * item.unitCost;
}

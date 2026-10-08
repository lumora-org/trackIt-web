/**
 * Role-aware capability map.
 *
 * PROMPT.md §6: the frontend must provide role-aware UX, but the backend is the
 * authority (doc 06 §56 — "Frontend authorization = UX / Backend authorization =
 * Security"). Nothing here is a security control; it only decides what to render.
 *
 * Matrix source: doc 06 §28 and doc 07 §56, adjusted by product decisions
 * (2026-10): SUPER_ADMIN no longer manages branches or users — that is the
 * ADMIN's job; the platform role adds businesses as a whole. Managers record
 * the day's totals, and every manager recording passes an admin approval
 * gate, so the ADMIN view has a Sales page for review (approval) alongside
 * the manager's recording view.
 */

import type { UserRole } from '@/types/domain';

export const CAPABILITIES = [
  'platform.manage',
  'business.view',
  'business.manage',
  'branch.view',
  'branch.manage',
  'user.view',
  'user.manage',
  'fuelType.view',
  'fuelType.manage',
  'fuelPrice.view',
  'fuelPrice.manage',
  'supplier.view',
  'supplier.manage',
  'tanker.view',
  'tanker.manage',
  'fuelOrder.view',
  'fuelOrder.manage',
  'delivery.view',
  'delivery.receive',
  'inventory.view',
  'inventory.adjust',
  'sales.view',
  'sales.record',
  'sales.approve',
  'sales.void',
  'dailyReport.view',
  'dailyReport.submit',
  'dailyReport.review',
  'dashboard.admin',
  'dashboard.manager',
  'auditLog.view',
  'notification.view',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * doc 06 §28. "Own business" means the backend scopes it to the caller's
 * businessId — the frontend never asserts ownership itself.
 */
const ROLE_CAPABILITIES: Record<UserRole, ReadonlySet<Capability>> = {
  SUPER_ADMIN: new Set<Capability>([
    'platform.manage',
    'business.view',
    'business.manage',
    'branch.view',
    'user.view',
    'fuelType.view',
    'fuelType.manage',
    'fuelPrice.view',
    'fuelPrice.manage',
    'supplier.view',
    'supplier.manage',
    'tanker.view',
    'tanker.manage',
    'fuelOrder.view',
    'fuelOrder.manage',
    'delivery.view',
    'delivery.receive',
    'inventory.view',
    'inventory.adjust',
    'sales.view',
    'sales.record',
    'sales.approve',
    'sales.void',
    'dailyReport.view',
    'dailyReport.review',
    'dashboard.admin',
    'auditLog.view',
    'notification.view',
  ]),

  ADMIN: new Set<Capability>([
    'business.view',
    'branch.view',
    'branch.manage',
    'user.view',
    'user.manage',
    'fuelType.view',
    'fuelType.manage',
    'fuelPrice.view',
    'fuelPrice.manage',
    'supplier.view',
    'supplier.manage',
    'tanker.view',
    'tanker.manage',
    'fuelOrder.view',
    'fuelOrder.manage',
    'delivery.view',
    'delivery.receive',
    'inventory.view',
    'inventory.adjust',
    // Product decision (2026-10): managers record the day's totals and an
    // admin confirms each figure, so the admin view carries the Sales review
    // queue (sales.view) with approve/reject (sales.approve). Admins do not
    // record sales themselves — that stays with the branch managers.
    'sales.view',
    'sales.approve',
    'sales.void',
    'dailyReport.view',
    'dailyReport.review',
    'dashboard.admin',
    'auditLog.view',
    'notification.view',
  ]),

  MANAGER: new Set<Capability>([
    'branch.view',
    'fuelType.view',
    'fuelPrice.view',
    'supplier.view',
    'tanker.view',
    'fuelOrder.view',
    'delivery.view',
    'delivery.receive',
    'inventory.view',
    'sales.view',
    'sales.record',
    'dailyReport.view',
    'dailyReport.submit',
    'dashboard.manager',
    'notification.view',
  ]),
};

export function can(role: UserRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role].has(capability);
}

/** Any-of helper, so navigation entries can declare several capabilities. */
export function canAny(
  role: UserRole | null | undefined,
  capabilities: readonly Capability[],
): boolean {
  return capabilities.some((c) => can(role, c));
}

/** doc 06 §5 — MANAGER is pinned to exactly one branch. */
export function isBranchScoped(role: UserRole | null | undefined): boolean {
  return role === 'MANAGER';
}

/**
 * doc 06 §5 / doc 03 §22 scope invariants. Returns the reason the invariants
 * are broken, or null when they hold. Useful for surfacing a support message
 * rather than rendering an app that cannot function.
 */
export function scopeViolation(
  role: UserRole,
  businessId: string | null,
  branchId: string | null,
): string | null {
  switch (role) {
    case 'SUPER_ADMIN':
      if (businessId || branchId)
        return 'A super administrator must not be scoped to a business or branch.';
      return null;
    case 'ADMIN':
      if (!businessId) return 'An administrator must belong to a business.';
      if (branchId) return 'An administrator must not be assigned to a branch.';
      return null;
    case 'MANAGER':
      if (!businessId) return 'A manager must belong to a business.';
      if (!branchId) return 'A manager must be assigned to a branch.';
      return null;
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
};

import { describe, expect, it } from 'vitest';

import { can, canAny, isBranchScoped, scopeViolation } from './permissions';

describe('can', () => {
  it('gives a manager the operational actions but not configuration (doc 06 §28)', () => {
    expect(can('MANAGER', 'sales.record')).toBe(true);
    expect(can('MANAGER', 'dailyReport.submit')).toBe(true);
    expect(can('MANAGER', 'fuelPrice.manage')).toBe(false);
    expect(can('MANAGER', 'dailyReport.review')).toBe(false);
    expect(can('MANAGER', 'user.manage')).toBe(false);
  });

  it('gives an admin configuration but never record-sale (doc 04 §59/§63)', () => {
    expect(can('ADMIN', 'fuelPrice.manage')).toBe(true);
    expect(can('ADMIN', 'fuelOrder.manage')).toBe(true);
    expect(can('ADMIN', 'sales.void')).toBe(true);
    expect(can('ADMIN', 'sales.record')).toBe(false);
  });

  it('gives a super admin platform management', () => {
    expect(can('SUPER_ADMIN', 'platform.manage')).toBe(true);
    expect(can('SUPER_ADMIN', 'business.manage')).toBe(true);
  });

  it('denies everything when there is no role', () => {
    expect(can(null, 'sales.record')).toBe(false);
    expect(can(undefined, 'sales.record')).toBe(false);
  });
});

describe('canAny', () => {
  it('passes when at least one capability is held', () => {
    expect(canAny('MANAGER', ['fuelPrice.manage', 'sales.record'])).toBe(true);
    expect(canAny('MANAGER', ['fuelPrice.manage', 'user.manage'])).toBe(false);
  });
});

describe('isBranchScoped', () => {
  it('is true only for a manager (doc 06 §5)', () => {
    expect(isBranchScoped('MANAGER')).toBe(true);
    expect(isBranchScoped('ADMIN')).toBe(false);
    expect(isBranchScoped('SUPER_ADMIN')).toBe(false);
  });
});

describe('scopeViolation', () => {
  it('accepts a correctly scoped SUPER_ADMIN', () => {
    expect(scopeViolation('SUPER_ADMIN', null, null)).toBeNull();
  });

  it('rejects a SUPER_ADMIN carrying a business', () => {
    expect(scopeViolation('SUPER_ADMIN', 'b1', null)).toMatch(/super administrator/i);
  });

  it('requires a business for an ADMIN and forbids a branch', () => {
    expect(scopeViolation('ADMIN', 'b1', null)).toBeNull();
    expect(scopeViolation('ADMIN', null, null)).toMatch(/belong to a business/i);
    expect(scopeViolation('ADMIN', 'b1', 'br1')).toMatch(/must not be assigned/i);
  });

  it('requires both business and branch for a MANAGER', () => {
    expect(scopeViolation('MANAGER', 'b1', 'br1')).toBeNull();
    expect(scopeViolation('MANAGER', 'b1', null)).toMatch(/assigned to a branch/i);
  });
});

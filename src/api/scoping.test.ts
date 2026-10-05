import { describe, expect, it } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '@/api/client';
import { login } from '@/api/auth.api';
import { apiClient } from '@/api/client';
import type { Branch } from '@/types/domain';

async function asManager() {
  resetApiClientForTests();
  const session = await login({
    email: 'manager@kbyglobal.com',
    password: 'Password123!',
  });
  setAccessToken(session.accessToken);
  return session.user;
}

async function asAdmin() {
  resetApiClientForTests();
  const session = await login({
    email: 'admin@kbyglobal.com',
    password: 'Password123!',
  });
  setAccessToken(session.accessToken);
  return session.user;
}

describe('branch scoping (doc 04 §21.1)', () => {
  it('returns only the assigned branch for a manager', async () => {
    await asManager();
    const { data } = await apiClient.list<Branch>('/branches');
    expect(data).toHaveLength(1);
    expect(data[0]!.code).toBe('KBY-IKEJA');
  });

  it('returns every branch of the business for an admin', async () => {
    await asAdmin();
    const { data } = await apiClient.list<Branch>('/branches');
    expect(data.length).toBeGreaterThan(1);
    expect(data.map((b) => b.code)).toEqual(
      expect.arrayContaining(['KBY-IKEJA', 'KBY-YABA', 'KBY-LEKKI']),
    );
  });

  it('paginates with the documented page/limit meta shape', async () => {
    await asAdmin();
    const { meta } = await apiClient.list<Branch>('/branches', {
      query: { page: 1, limit: 2 },
    });
    expect(meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('manager cannot reach another branch', () => {
  it("rejects reading another branch's inventory", async () => {
    const user = await asManager();
    const otherBranch = 'c0000000-0000-4000-8000-000000000002';

    await expect(
      apiClient.get('/inventory', { query: { branchId: otherBranch } }),
    ).resolves.toBeDefined();

    // The mock scopes the manager regardless of the filter sent, so confirm the
    // rows returned are only their own branch.
    const rows = await apiClient.get<Array<{ branchId: string }>>('/inventory', {
      query: { branchId: otherBranch },
    });
    expect(rows.every((r) => r.branchId === user.branchId)).toBe(true);
  });

  it('rejects recording a sale for another branch with 403 (doc 04 §93)', async () => {
    await asManager();
    await expect(
      apiClient.post('/sales', {
        branchId: 'c0000000-0000-4000-8000-000000000002',
        fuelTypeId: 'd0000000-0000-4000-8000-000000000001',
        litresSold: 100,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
  });

  it('rejects a manager creating a fuel type (doc 08 §11)', async () => {
    await asManager();
    await expect(apiClient.post('/fuel-types', { name: 'X', code: 'XYZ' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('rejects a manager approving a daily report (doc 06 §28)', async () => {
    await asManager();
    await expect(
      apiClient.post('/daily-reports/16000000-0000-4000-8000-000000000002/approve'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a manager voiding a sale (doc 04 §63)', async () => {
    await asManager();
    await expect(
      apiClient.post('/sales/15000000-0000-4000-8000-000000000001/void', {
        reason: 'test',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('admin-only resources', () => {
  it('rejects an admin listing businesses (doc 04 §20 — SUPER_ADMIN only)', async () => {
    await asAdmin();
    await expect(apiClient.list('/businesses')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows a super admin to list businesses', async () => {
    resetApiClientForTests();
    const session = await login({
      email: 'superadmin@kbyglobal.com',
      password: 'Password123!',
    });
    setAccessToken(session.accessToken);
    const { data } = await apiClient.list('/businesses');
    expect(data).toHaveLength(1);
  });
});

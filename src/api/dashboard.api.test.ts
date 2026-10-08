import { describe, expect, it } from 'vitest';

import { fetchAdminDashboard } from '@/api/dashboard.api';
import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import { BRANCHES, SALES } from '@/mocks/data';

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

describe('admin dashboard branch filter (doc 04 §76)', () => {
  it('aggregates every branch when no filter is sent', async () => {
    await asAdmin();
    const data = await fetchAdminDashboard();
    expect(data.summary.totalBranches).toBe(BRANCHES.length);
    expect(data.branches.map((b) => b.branchId)).toEqual(BRANCHES.map((b) => b.id));
  });

  it('keeps the summary consistent with the per-branch rows', async () => {
    await asAdmin();
    const data = await fetchAdminDashboard();
    expect(data.summary.totalFuelSoldLitres).toBe(
      data.branches.reduce((sum, b) => sum + b.fuelSoldLitres, 0),
    );
    expect(data.summary.totalRevenue).toBe(data.branches.reduce((sum, b) => sum + b.revenue, 0));
  });

  it('narrows every figure to the selected branch', async () => {
    await asAdmin();
    const branch = BRANCHES[1]!; // KBY Kwaga — the only fixture with branch-1 sales.
    const data = await fetchAdminDashboard({ branchId: branch.id });

    expect(data.summary.totalBranches).toBe(1);
    expect(data.branches).toHaveLength(1);
    expect(data.branches[0]!.branchId).toBe(branch.id);

    const rows = SALES.filter((s) => s.branchId === branch.id);
    expect(data.summary.totalFuelSoldLitres).toBe(rows.reduce((sum, s) => sum + s.litresSold, 0));
    expect(data.summary.totalRevenue).toBe(rows.reduce((sum, s) => sum + s.totalAmount, 0));
    // No DELIVERY ledger row exists for the branch, so nothing was received.
    expect(data.summary.totalFuelReceivedLitres).toBe(0);
  });

  it('still lists a branch with zero sales, showing zeros', async () => {
    await asAdmin();
    const branch = BRANCHES[2]!; // KBY Mando — no sales fixtures at all.
    const data = await fetchAdminDashboard({ branchId: branch.id });

    expect(data.branches).toHaveLength(1);
    expect(data.branches[0]!.fuelSoldLitres).toBe(0);
    expect(data.branches[0]!.revenue).toBe(0);
  });

  it('returns an empty overview for a branch outside the business', async () => {
    await asAdmin();
    // The business scope discards a foreign branch id rather than leaking it
    // (the real API resolves businessId AND branchId together).
    const data = await fetchAdminDashboard({
      branchId: '00000000-0000-4000-8000-00000000dead',
    });
    expect(data.summary.totalBranches).toBe(0);
    expect(data.branches).toEqual([]);
    expect(data.summary.totalRevenue).toBe(0);
  });

  it('rejects a manager from the admin overview (doc 04 §76)', async () => {
    await asManager();
    await expect(fetchAdminDashboard()).rejects.toMatchObject({ statusCode: 403 });
  });
});

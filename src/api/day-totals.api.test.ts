import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import { getSalesSummary } from '@/api/daily-reports.api';
import { createIncidentReport } from '@/api/incidents.api';
import { listNotifications } from '@/api/notifications.api';
import {
  approveSale,
  listSales,
  recordDayTotal,
  recordSale,
  rejectSale,
} from '@/api/sales.api';
import { createFuelPrice } from '@/api/fuel-prices.api';
import { BRANCHES, FUEL_TYPES } from '@/mocks/data';

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

const doka = BRANCHES[0]!.id;
const kwaga = BRANCHES[1]!.id;
const pms = FUEL_TYPES[0]!.id;

/**
 * Mirrors the fixtures' day math (`daysAgo` in mocks/data.ts): the local
 * calendar day minus `daysBack`, pinned to `hour`, as a YYYY-MM-DD string.
 */
function dayAt(daysBack: number, hour = 11): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function liveDayTotalRows(branchId: string) {
  const { data } = await listSales({ branchId, recordMode: 'DAY_TOTAL', limit: 100 });
  return data.filter((s) => !s.voidedAt);
}

describe('recording a day total', () => {
  it('records the figure once and revises the same row in place', async () => {
    await asManager();
    const created = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 500 });
    expect(created).not.toBeNull();
    expect(created!.recordMode).toBe('DAY_TOTAL');
    expect(created!.litresSold).toBe(500);

    const revised = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 800 });
    expect(revised!.id).toBe(created!.id);
    expect(revised!.litresSold).toBe(800);

    const rows = await liveDayTotalRows(doka);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.litresSold).toBe(800);
  });

  it('an unchanged figure is a no-op returning the current row', async () => {
    await asManager();
    const created = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 500 });
    const again = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 500 });
    expect(again!.id).toBe(created!.id);
    expect(again!.litresSold).toBe(500);
    expect(await liveDayTotalRows(doka)).toHaveLength(1);
  });

  it('clearing with 0 voids the day row and returns null', async () => {
    await asManager();
    const created = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 500 });
    const cleared = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 0 });
    expect(cleared).toBeNull();

    expect(await liveDayTotalRows(doka)).toHaveLength(0);
    const { data } = await listSales({ branchId: doka, recordMode: 'DAY_TOTAL', limit: 100 });
    const voided = data.find((s) => s.id === created!.id);
    expect(voided?.voidedAt).toBeTruthy();
  });

  it('0 with nothing recorded yet is a no-op returning null', async () => {
    await asManager();
    expect(await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 0 })).toBeNull();
  });

  it('refuses a future day', async () => {
    await asManager();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await expect(
      recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 100, date: tomorrow }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_OPERATION' });
  });

  it('refuses a manager recording for another branch (doc 04 §93)', async () => {
    await asManager();
    await expect(
      recordDayTotal({ branchId: kwaga, fuelTypeId: pms, totalLitres: 100 }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
  });
});

describe('pricing at the price in force (product decision 2026-10)', () => {
  it('prices litres recorded after a price change at the new price', async () => {
    await asAdmin();
    // The admin raises the PMS price; the new interval opens now.
    await createFuelPrice({ fuelTypeId: pms, pricePerLitre: 1999 });

    await asManager();
    // A backdated day pins sold_at to yesterday noon, but the recording
    // happens NOW — so the price in force now applies, not the day's noon
    // price (the old behaviour missed changes made after noon).
    const sale = await recordDayTotal({
      branchId: doka,
      fuelTypeId: pms,
      totalLitres: 250,
      date: dayAt(1),
    });
    expect(sale).not.toBeNull();
    expect(sale!.unitPrice).toBe(1999);
    expect(sale!.totalAmount).toBe(499_750);
  });
});

describe('notifying admins of recorded sales (product decision 2026-10)', () => {
  it('notifies admins when a manager records a day total', async () => {
    await asManager();
    const sale = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 120 });
    expect(sale).not.toBeNull();

    await asAdmin();
    const { data } = await listNotifications({ limit: 100 });
    const notification = data.find((n) => n.type === 'SALE_RECORDED');
    expect(notification).toMatchObject({
      status: 'UNREAD',
      resourceType: 'SALE',
      resourceId: sale!.id,
    });
    expect(notification!.title).toContain('Day total recorded');
    expect(notification!.message).toContain('120');
  });

  it('notifies admins when a manager revises a day total', async () => {
    await asManager();
    const sale = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 100 });
    await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 300 });

    await asAdmin();
    const { data } = await listNotifications({ limit: 100 });
    const revised = data.find(
      (n) => n.type === 'SALE_RECORDED' && n.title.startsWith('Day total revised'),
    );
    expect(revised).toBeDefined();
    expect(revised!.resourceId).toBe(sale!.id);
    expect(revised!.message).toContain('100 L -> 300 L');
  });

  it('notifies admins when a manager records a single sale', async () => {
    await asManager();
    const sale = await recordSale({ branchId: doka, fuelTypeId: pms, litresSold: 50 });

    await asAdmin();
    const { data } = await listNotifications({ limit: 100 });
    expect(data.some((n) => n.type === 'SALE_RECORDED' && n.resourceId === sale.id)).toBe(true);
  });
});

describe('the admin approval gate (product decision 2026-10)', () => {
  it('keeps a manager recording pending until an admin approves it', async () => {
    await asManager();
    const sale = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 150 });
    expect(sale!.approvalStatus).toBe('PENDING');
    expect(sale!.approvedAt).toBeNull();

    await asAdmin();
    const approved = await approveSale(sale!.id);
    expect(approved.approvalStatus).toBe('APPROVED');
    expect(approved.approvedAt).toBeTruthy();

    // The manager is told the outcome.
    await asManager();
    const { data } = await listNotifications({ limit: 100 });
    expect(data.some((n) => n.type === 'SALE_APPROVED' && n.resourceId === sale!.id)).toBe(true);
  });

  it('confirms an admin recording by definition', async () => {
    await asAdmin();
    const sale = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 90 });
    expect(sale!.approvalStatus).toBe('APPROVED');
    await expect(approveSale(sale!.id)).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_OPERATION',
    });
  });

  it('refuses a manager trying to approve', async () => {
    await asManager();
    const sale = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 90 });
    await expect(approveSale(sale!.id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'BUSINESS_ACCESS_DENIED',
    });
  });

  it('rejects a pending figure with a reason and notifies the manager', async () => {
    await asManager();
    const sale = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 120 });

    await asAdmin();
    const rejected = await rejectSale(sale!.id, 'Figure does not match the pump reading');
    expect(rejected.approvalStatus).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Figure does not match the pump reading');

    await asManager();
    const { data } = await listNotifications({ limit: 100 });
    expect(data.some((n) => n.type === 'SALE_REJECTED' && n.resourceId === sale!.id)).toBe(true);
  });

  it('a revision re-opens the gate', async () => {
    await asManager();
    const sale = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 100 });

    await asAdmin();
    await approveSale(sale!.id);

    await asManager();
    const revised = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 140 });
    expect(revised!.id).toBe(sale!.id);
    expect(revised!.approvalStatus).toBe('PENDING');
    expect(revised!.rejectionReason).toBeNull();
  });

  it('filters the ledger by approval status', async () => {
    await asAdmin();
    const { data } = await listSales({ approvalStatus: 'REJECTED', limit: 100 });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((s) => s.approvalStatus === 'REJECTED')).toBe(true);
  });
});

describe('re-pricing a revision at the current price (product decision 2026-10)', () => {
  it('re-values the whole figure when the admin changes the price mid-day', async () => {
    await asAdmin();
    await createFuelPrice({ fuelTypeId: pms, pricePerLitre: 1200 });

    await asManager();
    const first = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 100 });
    expect(first!.unitPrice).toBe(1200);
    expect(first!.totalAmount).toBe(120_000);

    await asAdmin();
    await createFuelPrice({ fuelTypeId: pms, pricePerLitre: 1500 });

    await asManager();
    const revised = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 200 });
    expect(revised!.id).toBe(first!.id);
    // litres x the price in force NOW — never a weighted average of the
    // day's intervals (the old behaviour produced 1,285.71-style prices).
    expect(revised!.unitPrice).toBe(1500);
    expect(revised!.totalAmount).toBe(300_000);
  });

  it('re-values a downward correction at the current price too', async () => {
    await asAdmin();
    await createFuelPrice({ fuelTypeId: pms, pricePerLitre: 1200 });

    await asManager();
    await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 100 });

    await asAdmin();
    await createFuelPrice({ fuelTypeId: pms, pricePerLitre: 1500 });

    await asManager();
    const revised = await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 80 });
    expect(revised!.unitPrice).toBe(1500);
    expect(revised!.totalAmount).toBe(120_000);
  });
});

describe('the admin sales roll-up', () => {
  it('groups non-voided records per branch-day with per-fuel sums', async () => {
    await asAdmin();
    const { data: rows } = await getSalesSummary({ from: dayAt(10), to: dayAt(0, 23), limit: 100 });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.saleCount).toBeGreaterThan(0);
      const fuelLitres = row.fuels.reduce((sum, f) => sum + f.litresSold, 0);
      const fuelRevenue = row.fuels.reduce((sum, f) => sum + f.revenue, 0);
      expect(fuelLitres).toBe(row.totalLitres);
      expect(fuelRevenue).toBe(row.totalRevenue);
    }

    const dokaToday = rows.find((r) => r.branchId === doka && r.date === dayAt(0, 11));
    expect(dokaToday).toMatchObject({
      saleCount: 2,
      totalLitres: 24_500,
      totalRevenue: 39_875_000,
    });

    const kwagaToday = rows.find((r) => r.branchId === kwaga);
    expect(kwagaToday).toMatchObject({ saleCount: 1, totalLitres: 6_000 });
  });

  it('excludes a voided sale from the roll-up', async () => {
    await asAdmin();
    const { data: rows } = await getSalesSummary({ from: dayAt(10), to: dayAt(0, 23), limit: 100 });
    // The only Doka sale two days ago is voided, so that branch-day produces no row.
    expect(rows.some((r) => r.branchId === doka && r.date === dayAt(2, 13))).toBe(false);
  });

  it('attaches incidents to a day that has sale records', async () => {
    const day = dayAt(20, 12);

    await asManager();
    await recordDayTotal({ branchId: doka, fuelTypeId: pms, totalLitres: 300, date: day });
    await createIncidentReport({
      branchId: doka,
      incidentDate: day,
      title: 'Government vehicle left without paying',
      description: 'A ministry pickup collected 120 L of PMS and drove off without payment.',
    });

    await asAdmin();
    const { data: rows } = await getSalesSummary({
      branchId: doka,
      from: day,
      to: day,
      limit: 100,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: day,
      saleCount: 1,
      totalLitres: 300,
      incidentCount: 1,
      openIncidentCount: 1,
    });
  });

  it('scopes the roll-up to a single branch', async () => {
    await asAdmin();
    const { data: rows } = await getSalesSummary({ branchId: kwaga, limit: 100 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.branchId === kwaga)).toBe(true);
  });

  it('refuses a manager (doc 06 §28)', async () => {
    await asManager();
    await expect(getSalesSummary({})).rejects.toMatchObject({
      statusCode: 403,
      code: 'BUSINESS_ACCESS_DENIED',
    });
  });
});

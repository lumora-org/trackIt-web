import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import {
  approveDailyReport,
  createDailyReport,
  createDailyReportSchema,
  listDailyReports,
  reconcileReport,
  rejectDailyReport,
  resubmitDailyReport,
  submitDailyReport,
} from '@/api/daily-reports.api';
import { BRANCHES, DAILY_REPORTS } from '@/mocks/data';
import { DAILY_REPORT_TRANSITIONS, type DailyReport } from '@/types/domain';

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

describe('daily report validation', () => {
  it('requires a YYYY-MM-DD date', () => {
    expect(createDailyReportSchema.safeParse({ reportDate: '05/10/2026' }).success).toBe(false);
    expect(createDailyReportSchema.safeParse({ reportDate: '2026-10-05' }).success).toBe(true);
  });

  it('refuses a future date', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    expect(createDailyReportSchema.safeParse({ reportDate: future }).success).toBe(false);
  });
});

describe('creating a daily report (doc 04 §66)', () => {
  it('calculates every figure server-side and starts as DRAFT', async () => {
    await asManager();
    const report = await createDailyReport({
      branchId: ikeja,
      reportDate: '2026-09-01',
      managerNotes: 'Quiet day.',
    });

    expect(report.status).toBe('DRAFT');
    expect(typeof report.openingStockLitres).toBe('number');
    expect(typeof report.totalReceivedLitres).toBe('number');
    expect(typeof report.totalSoldLitres).toBe('number');
    expect(typeof report.closingStockLitres).toBe('number');
    expect(typeof report.totalRevenue).toBe('number');
  });

  it('rejects a duplicate (branch, date) with REPORT_ALREADY_EXISTS (doc 03 §56)', async () => {
    await asManager();
    const existing = DAILY_REPORTS.find((r) => r.branchId === ikeja)!;
    await expect(
      createDailyReport({ branchId: ikeja, reportDate: existing.reportDate }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'REPORT_ALREADY_EXISTS' });
  });

  it('refuses a manager reporting for another branch (doc 04 §93)', async () => {
    await asManager();
    await expect(
      createDailyReport({ branchId: BRANCHES[1]!.id, reportDate: '2026-09-02' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
  });
});

describe('report lifecycle (doc 04 §68-71)', () => {
  it('a manager submits a draft', async () => {
    await asManager();
    const draft = DAILY_REPORTS.find((r) => r.status === 'DRAFT')!;
    expect((await submitDailyReport(draft.id)).status).toBe('SUBMITTED');
  });

  it('an administrator approves a submitted report', async () => {
    await asAdmin();
    const submitted = DAILY_REPORTS.find((r) => r.status === 'SUBMITTED')!;
    const approved = await approveDailyReport(submitted.id);
    expect(approved.status).toBe('APPROVED');
    // doc 04 §69 — the response includes reviewer information.
    expect(approved.reviewedAt).toBeTruthy();
    expect(approved.reviewedBy).toBeTruthy();
  });

  it('a rejection requires a reason (doc 04 §70)', async () => {
    await asAdmin();
    const submitted = DAILY_REPORTS.find((r) => r.status === 'SUBMITTED')!;
    await expect(rejectDailyReport(submitted.id, '')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('a rejected report can be resubmitted to DRAFT (doc 04 §71)', async () => {
    await asManager();
    const rejected = DAILY_REPORTS.find((r) => r.status === 'REJECTED')!;
    const resubmitted = await resubmitDailyReport(rejected.id);
    expect(resubmitted.status).toBe('DRAFT');
  });

  it('refuses to submit a report that is not a draft', async () => {
    await asManager();
    const approved = DAILY_REPORTS.find((r) => r.status === 'APPROVED')!;
    await expect(submitDailyReport(approved.id)).rejects.toMatchObject({
      code: 'REPORT_NOT_SUBMITTABLE',
    });
  });

  it('refuses to resubmit a report that was not rejected', async () => {
    await asManager();
    const draft = DAILY_REPORTS.find((r) => r.status === 'DRAFT')!;
    await expect(resubmitDailyReport(draft.id)).rejects.toMatchObject({
      code: 'INVALID_REPORT_STATUS',
    });
  });

  it('refuses a manager approving a report (doc 06 §28)', async () => {
    await asManager();
    const submitted = DAILY_REPORTS.find((r) => r.status === 'SUBMITTED')!;
    await expect(approveDailyReport(submitted.id)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('report state machine', () => {
  it('has no transitions out of APPROVED', () => {
    expect(DAILY_REPORT_TRANSITIONS.APPROVED).toEqual([]);
  });

  it('returns a REJECTED report to DRAFT rather than a new row (doc 03 §56)', () => {
    expect(DAILY_REPORT_TRANSITIONS.REJECTED).toEqual(['DRAFT']);
  });

  it('never targets UNDER_REVIEW, which has no endpoint (ASSUMPTIONS.md §3.3)', () => {
    // UNDER_REVIEW exists in the enum but no documented operation sets it, so
    // no other state lists it as a target.
    for (const targets of Object.values(DAILY_REPORT_TRANSITIONS)) {
      if (targets.length > 0) {
        expect(targets).not.toContain('UNDER_REVIEW');
      }
    }
  });
});

describe('reconcileReport (doc 03 §58)', () => {
  const base: DailyReport = {
    id: 'x',
    branchId: 'b',
    reportDate: '2026-10-05',
    status: 'DRAFT',
    openingStockLitres: 1000,
    totalReceivedLitres: 500,
    totalSoldLitres: 300,
    closingStockLitres: 1200,
    totalRevenue: 0,
    managerNotes: null,
  };

  it('reports a balanced report', () => {
    // 1000 + 500 − 300 = 1200
    expect(reconcileReport(base)).toEqual({
      balanced: true,
      computedClosing: 1200,
      difference: 0,
    });
  });

  it('surfaces a mismatch rather than hiding it', () => {
    const result = reconcileReport({ ...base, closingStockLitres: 1100 });
    expect(result.balanced).toBe(false);
    expect(result.difference).toBe(-100);
  });
});

describe('daily report listing', () => {
  it('scopes a manager to their branch', async () => {
    await asManager();
    const { data } = await listDailyReports({ limit: 100 });
    expect(data.every((r) => r.branchId === ikeja)).toBe(true);
  });

  it('filters by status', async () => {
    await asAdmin();
    const { data } = await listDailyReports({ status: 'APPROVED', limit: 100 });
    expect(data.every((r) => r.status === 'APPROVED')).toBe(true);
  });
});

/**
 * Daily reports (doc 04 §64–71, doc 03 §18, §55–58).
 *
 * doc 04 §66: the client sends only branchId, reportDate and managerNotes.
 * Every figure — opening stock, received, sold, closing, revenue — is calculated
 * by the backend, so this module has no way to submit a total even by accident.
 *
 * doc 03 §93: a daily report is a business summary and creates NO inventory
 * transactions.
 */
import { z } from 'zod';

import { apiClient } from './client';
import type { DailyReport, DailyReportStatus, PageMeta } from '@/types/domain';

export type DailyReportFilters = {
  page?: number;
  limit?: number;
  branchId?: string;
  status?: DailyReportStatus;
  from?: string;
  to?: string;
};

export async function listDailyReports(
  filters: DailyReportFilters = {},
): Promise<{ data: DailyReport[]; meta: PageMeta | null }> {
  return apiClient.list<DailyReport>('/daily-reports', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      branchId: filters.branchId,
      status: filters.status,
      from: filters.from,
      to: filters.to,
    },
  });
}

export async function getDailyReport(id: string): Promise<DailyReport> {
  return apiClient.get<DailyReport>(`/daily-reports/${id}`);
}

/** doc 04 §66 — exactly three fields; all figures are backend-calculated. */
export async function createDailyReport(
  input: CreateDailyReportValues & { branchId: string },
): Promise<DailyReport> {
  return apiClient.post<DailyReport>('/daily-reports', {
    branchId: input.branchId,
    reportDate: input.reportDate,
    ...(input.managerNotes ? { managerNotes: input.managerNotes } : {}),
  });
}

export const submitDailyReport = (id: string) =>
  apiClient.post<DailyReport>(`/daily-reports/${id}/submit`);

export const approveDailyReport = (id: string) =>
  apiClient.post<DailyReport>(`/daily-reports/${id}/approve`);

/** doc 04 §70 — a rejection reason is mandatory (doc 01 §19). */
export const rejectDailyReport = (id: string, reason: string) =>
  apiClient.post<DailyReport>(`/daily-reports/${id}/reject`, { reason });

/** doc 04 §71 — REJECTED → DRAFT, so the manager edits and resubmits. */
export const resubmitDailyReport = (id: string) =>
  apiClient.post<DailyReport>(`/daily-reports/${id}/resubmit`);

export const createDailyReportSchema = z.object({
  reportDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
    .refine((v) => v <= new Date().toISOString().slice(0, 10), {
      message: 'A report cannot be dated in the future',
    }),
  managerNotes: z.string().trim().max(1000, 'Notes are too long').optional(),
});

export type CreateDailyReportValues = z.infer<typeof createDailyReportSchema>;

export const rejectReportSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'A rejection reason is required')
    .max(1000, 'Reason is too long'),
});

/**
 * doc 03 §58 — Opening + Deliveries − Sales + Adjustments = Closing.
 *
 * Used only to show the manager whether the backend's figures reconcile. The
 * backend is authoritative; a mismatch is surfaced, never "corrected" locally.
 */
export function reconcileReport(report: DailyReport): {
  balanced: boolean;
  computedClosing: number;
  difference: number;
} {
  const computedClosing =
    report.openingStockLitres + report.totalReceivedLitres - report.totalSoldLitres;
  const difference = report.closingStockLitres - computedClosing;
  return { balanced: difference === 0, computedClosing, difference };
}

/** doc 03 §18 — statuses a manager can act on directly. */
export const REPORT_STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

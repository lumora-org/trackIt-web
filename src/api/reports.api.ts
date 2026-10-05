/**
 * Reports and exports (doc 04 §79–85).
 *
 * doc 01 §29 puts "Excel/PDF reporting where practical" in MVP scope, and doc 04
 * §83 specifies `format=xlsx` with a `Content-Disposition: attachment` response
 * (doc 05 §115).
 *
 * IMPORTANT: the four report endpoints (GET /reports/sales, /inventory,
 * /deliveries, /daily-reports) have documented query parameters but **no
 * documented response schema**. This module therefore renders report screens from
 * the underlying resource endpoints, which *are* fully specified, rather than
 * guessing at an undefined shape. See ASSUMPTIONS.md §3.13.
 *
 * The export URLs are wired directly because a download must not go through the
 * JSON envelope.
 */
import { apiClient, getApiBaseUrl, type QueryValue } from './client';

export interface ReportDateRange {
  from?: string;
  to?: string;
  branchId?: string;
}

/** Build a query object shared by the list and export endpoints. */
export function reportQuery(range: ReportDateRange): Record<string, QueryValue> {
  return {
    from: range.from,
    to: range.to,
    branchId: range.branchId,
  };
}

/**
 * doc 04 §79-85 — report endpoints. Called only once their response shape is
 * documented; the screens currently use the resource endpoints instead.
 */
export function fetchSalesReport(range: ReportDateRange) {
  return apiClient.get('/reports/sales', { query: reportQuery(range) });
}

export function fetchInventoryReport(range: ReportDateRange) {
  return apiClient.get('/reports/inventory', { query: reportQuery(range) });
}

export function fetchDeliveriesReport(range: ReportDateRange) {
  return apiClient.get('/reports/deliveries', { query: reportQuery(range) });
}

export function fetchDailyReportsReport(range: ReportDateRange) {
  return apiClient.get('/reports/daily-reports', { query: reportQuery(range) });
}

export type ReportKind = 'sales' | 'inventory' | 'deliveries' | 'daily-reports';

/**
 * Absolute URL for a report download.
 *
 * doc 05 §115 — the response is an attachment, so this must be a plain browser
 * navigation rather than a JSON fetch. `format=xlsx` is the only documented MVP
 * format (doc 04 §83).
 */
export function exportUrl(kind: ReportKind, range: ReportDateRange): string {
  const params = new URLSearchParams({ format: 'xlsx' });
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  if (range.branchId) params.set('branchId', range.branchId);
  return `${getApiBaseUrl()}/api/v1/reports/${kind}/export?${params.toString()}`;
}

/** doc 04 §83 — filename pattern sales-report-2026-10-01-to-2026-10-31.xlsx. */
export function exportFilename(kind: ReportKind, range: ReportDateRange): string {
  const label = kind === 'daily-reports' ? 'daily-reports' : `${kind}-report`;
  if (range.from && range.to) {
    return `${label}-${range.from}-to-${range.to}.xlsx`;
  }
  return `${label}.xlsx`;
}

/**
 * Incident reports (product decision, 2026-10).
 *
 * An incident is the manager's free-text exception log — government vehicles
 * collecting fuel without paying, stock variances, equipment failures. It
 * carries no financial figure: sales live in the day-total flow, this module
 * only records what went wrong. An admin acknowledges a report with a single
 * OPEN -> REVIEWED flip; there is no approve/reject workflow.
 */
import { z } from 'zod';

import { apiClient } from './client';
import type { IncidentReport, IncidentStatus, PageMeta } from '@/types/domain';

export type IncidentReportFilters = {
  page?: number;
  limit?: number;
  branchId?: string;
  status?: IncidentStatus;
  from?: string;
  to?: string;
};

export async function listIncidentReports(
  filters: IncidentReportFilters = {},
): Promise<{ data: IncidentReport[]; meta: PageMeta | null }> {
  return apiClient.list<IncidentReport>('/incident-reports', {
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

export async function getIncidentReport(id: string): Promise<IncidentReport> {
  return apiClient.get<IncidentReport>(`/incident-reports/${id}`);
}

export interface CreateIncidentReportInput {
  branchId: string;
  /** Business-timezone calendar day (YYYY-MM-DD); defaults to today. */
  incidentDate?: string;
  title: string;
  description: string;
}

export async function createIncidentReport(
  input: CreateIncidentReportInput,
): Promise<IncidentReport> {
  return apiClient.post<IncidentReport>(
    '/incident-reports',
    {
      branchId: input.branchId,
      ...(input.incidentDate ? { incidentDate: input.incidentDate } : {}),
      title: input.title,
      description: input.description,
    },
    // A double-tap must never file two copies of the same incident.
    { idempotencyKey: crypto.randomUUID() },
  );
}

/** ADMIN, SUPER_ADMIN — OPEN -> REVIEWED, once. */
export async function reviewIncidentReport(id: string): Promise<IncidentReport> {
  return apiClient.post<IncidentReport>(`/incident-reports/${id}/review`, undefined, {
    idempotencyKey: crypto.randomUUID(),
  });
}

export const createIncidentReportSchema = z.object({
  incidentDate: z
    .union([
      z.literal(''),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
        .refine((v) => v <= new Date().toISOString().slice(0, 10), {
          message: 'An incident cannot be dated in the future',
        }),
    ])
    .optional(),
  title: z.string().trim().min(3, 'Give the incident a short title').max(200, 'Title is too long'),
  description: z
    .string()
    .trim()
    .min(3, 'Describe what happened')
    .max(5000, 'Description is too long'),
});

export type CreateIncidentReportValues = z.infer<typeof createIncidentReportSchema>;

export const INCIDENT_STATUS_FILTERS = [
  { value: '', label: 'All incidents' },
  { value: 'OPEN', label: 'Open' },
  { value: 'REVIEWED', label: 'Reviewed' },
] as const;

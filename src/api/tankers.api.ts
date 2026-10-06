/** doc 04 §36–39, doc 09 §5.1, doc 03 §35 */
import { z } from 'zod';

import { apiClient } from './client';
import type { PageMeta, ResourceStatus, Tanker } from '@/types/domain';
import { PHONE_PATTERN } from './suppliers.api';

export interface TankerFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: ResourceStatus;
  /** SUPER_ADMIN only: scope the list to one business. */
  businessId?: string;
}

export async function listTankers(
  filters: TankerFilters = {},
): Promise<{ data: Tanker[]; meta: PageMeta | null }> {
  return apiClient.list<Tanker>('/tankers', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      search: filters.search,
      status: filters.status,
      businessId: filters.businessId,
    },
  });
}

export async function createTanker(input: TankerInput): Promise<Tanker> {
  return apiClient.post<Tanker>('/tankers', input);
}

export async function updateTanker(id: string, input: Partial<TankerInput>) {
  return apiClient.patch<Tanker>(`/tankers/${id}`, input);
}

/*
 * doc 03 §36 — registration_number NOT NULL and UNIQUE per business;
 * CHECK (capacity_litres > 0). doc 09 documents no other validation
 * (ASSUMPTIONS.md §3.10), so driver fields are optional and tanker_code is free
 * text because it has no unique constraint.
 */
export const tankerSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(1, 'Registration number is required')
    .max(50, 'Registration number is too long')
    .transform((v) => v.toUpperCase()),
  tankerCode: z.string().trim().max(50, 'Too long').optional(),
  capacityLitres: z
    .number({ message: 'Capacity is required' })
    .positive('Capacity must be greater than 0')
    .max(1_000_000, 'Capacity looks too high'),
  driverName: z.string().trim().max(255, 'Too long').optional(),
  driverPhone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid phone number')
    .optional(),
});

export type TankerInput = z.infer<typeof tankerSchema>;

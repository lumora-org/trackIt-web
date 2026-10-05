/** doc 04 §20, doc 03 §26, §13 */
import { z } from 'zod';

import { apiClient } from './client';
import type { Business, PageMeta } from '@/types/domain';

export async function listBusinesses(): Promise<{ data: Business[]; meta: PageMeta | null }> {
  // doc 04 §20 — SUPER_ADMIN only.
  return apiClient.list<Business>('/businesses', { query: { limit: 100 } });
}

export async function getBusiness(id: string): Promise<Business> {
  return apiClient.get<Business>(`/businesses/${id}`);
}

export const createBusinessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required').max(255),
  registrationNumber: z.string().trim().max(100).optional(),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address')
    .optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[+]?[\d\s()-]{7,20}$/.test(v), 'Enter a valid phone number')
    .optional(),
  address: z.string().trim().max(1000).optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  return apiClient.post<Business>('/businesses', {
    name: input.name,
    registrationNumber: input.registrationNumber || undefined,
    email: input.email || undefined,
    phone: input.phone || undefined,
    address: input.address || undefined,
  });
}

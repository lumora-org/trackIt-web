/** doc 04 §32–35, doc 09 §3.1, doc 03 §34 */
import { z } from 'zod';

import { apiClient } from './client';
import type { PageMeta, ResourceStatus, Supplier } from '@/types/domain';

export interface SupplierFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: ResourceStatus;
  /** SUPER_ADMIN only: scope the list to one business. */
  businessId?: string;
}

export async function listSuppliers(
  filters: SupplierFilters = {},
): Promise<{ data: Supplier[]; meta: PageMeta | null }> {
  return apiClient.list<Supplier>('/suppliers', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      search: filters.search,
      status: filters.status,
      businessId: filters.businessId,
    },
  });
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  return apiClient.post<Supplier>('/suppliers', input);
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
  return apiClient.patch<Supplier>(`/suppliers/${id}`, input);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Nigerian numbers, permissive about spacing, dashes and a +234 prefix. */
const PHONE_PATTERN = /^[+]?[\d\s()-]{7,20}$/;

/*
 * doc 09 documents no DTOs for suppliers, so required/optional status is an
 * assumption (ASSUMPTIONS.md §3.10): name and code are required because they are
 * NOT NULL / uniquely constrained in doc 03 §34; the rest are optional columns.
 */
export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name is too long'),
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(50, 'Code is too long')
    .transform((v) => v.toUpperCase()),
  contactPerson: z.string().trim().max(255, 'Too long').optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid phone number')
    .optional(),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || EMAIL_PATTERN.test(v), 'Enter a valid email address')
    .optional(),
  address: z.string().trim().max(1000, 'Too long').optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export { EMAIL_PATTERN, PHONE_PATTERN };

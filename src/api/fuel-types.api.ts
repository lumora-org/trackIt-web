/** doc 04 §25–28, doc 08 §10–13 */
import { z } from 'zod';

import { apiClient } from './client';
import type { FuelType, PageMeta, ResourceStatus } from '@/types/domain';

export interface FuelTypeFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: ResourceStatus;
}

export async function listFuelTypes(
  filters: FuelTypeFilters = {},
): Promise<{ data: FuelType[]; meta: PageMeta | null }> {
  return apiClient.list<FuelType>('/fuel-types', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      search: filters.search,
      status: filters.status,
    },
  });
}

export async function getFuelType(id: string): Promise<FuelType> {
  return apiClient.get<FuelType>(`/fuel-types/${id}`);
}

/** doc 04 §26 — businessId is derived server-side and must never be sent. */
export async function createFuelType(input: CreateFuelTypeInput): Promise<FuelType> {
  return apiClient.post<FuelType>('/fuel-types', {
    name: input.name,
    code: input.code,
    description: normalizeDescription(input.description),
  });
}

/** doc 08 §13 — `code` is treated as immutable after creation; only send `name`. */
export async function updateFuelType(
  id: string,
  input: { name?: string; description?: string | null },
): Promise<FuelType> {
  return apiClient.patch<FuelType>(`/fuel-types/${id}`, input);
}

/**
 * doc 08 §70 — `code` matches /^[A-Z0-9_-]+$/ and is unique per business
 * (doc 03 §30). Mirrored client-side for fast feedback; the server is still
 * authoritative.
 */
export const FUEL_TYPE_CODE_PATTERN = /^[A-Z0-9_-]+$/;

export const createFuelTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  /*
   * Zod 4 runs `.regex()` against the raw string, so upper-casing must happen in a
   * transform *before* validation — otherwise a legitimately lowercase `pms`
   * would be rejected before it could be normalised.
   */
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(30, 'Code is too long')
    .transform((v) => v.toUpperCase())
    .refine(
      (v) => FUEL_TYPE_CODE_PATTERN.test(v),
      'Use uppercase letters, numbers, hyphens or underscores only',
    ),
  description: z.string().trim().max(500, 'Description is too long').optional(),
});

export type CreateFuelTypeInput = z.infer<typeof createFuelTypeSchema>;

/** An empty description means "no description", not an empty string. */
function normalizeDescription(value?: string): string | undefined {
  return value ? value : undefined;
}

export const updateFuelTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  description: z.string().trim().max(500, 'Description is too long').nullable().optional(),
});

export type UpdateFuelTypeInput = z.infer<typeof updateFuelTypeSchema>;

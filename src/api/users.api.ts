/** doc 04 §17–19, doc 03 §21–22 */
import { z } from 'zod';

import { apiClient } from './client';
import { PASSWORD_MIN_LENGTH } from './auth.api';
import type { AccountStatus, PageMeta, User, UserRole } from '@/types/domain';

export type UserFilters = {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: AccountStatus;
  branchId?: string;
};

export async function listUsers(
  filters: UserFilters = {},
): Promise<{ data: User[]; meta: PageMeta | null }> {
  return apiClient.list<User>('/users', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      search: filters.search,
      role: filters.role,
      status: filters.status,
      branchId: filters.branchId,
    },
  });
}

/**
 * doc 04 §18 — businessId is derived from the authenticated caller, so an admin
 * can never create a user for another business.
 *
 * doc 03 §22 — a MANAGER requires a branchId; an ADMIN must not have one.
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  return apiClient.post<User>('/users', {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ? input.phone : undefined,
    password: input.password,
    role: input.role,
    branchId: input.branchId ? input.branchId : undefined,
  });
}

/** doc 04 §19 — deactivation rather than physical deletion is preferred. */
export async function setUserStatus(id: string, status: AccountStatus): Promise<User> {
  return apiClient.patch<User>(`/users/${id}/status`, { status });
}

export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    // doc 03 §23 — emails are normalised to lowercase and unique on LOWER(email).
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .transform((v) => v.toLowerCase())
      .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[+]?[\d\s()-]{7,20}$/.test(v), 'Enter a valid phone number')
      .optional(),
    role: z.enum(['ADMIN', 'MANAGER']),
    branchId: z.string().optional(),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
    confirmPassword: z.string().min(1, 'Confirm the password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  // doc 06 §34 / doc 03 §22 — a MANAGER must have a branch.
  .refine((v) => v.role !== 'MANAGER' || Boolean(v.branchId), {
    message: 'Select a branch for the manager',
    path: ['branchId'],
  })
  // doc 07 §57 — an admin manages managers, not other admins.
  .refine((v) => v.role !== 'ADMIN' || !v.branchId, {
    message: 'An administrator cannot be assigned to a branch',
    path: ['branchId'],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'ADMIN', label: 'Administrators' },
  { value: 'MANAGER', label: 'Managers' },
  { value: 'SUPER_ADMIN', label: 'Super admins' },
] as const;

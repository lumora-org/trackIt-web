/** doc 04 §21–24, doc 03 §27 */
import { apiClient } from './client';
import type { Branch, PageMeta } from '@/types/domain';

export interface BranchFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: Branch['status'];
  /** SUPER_ADMIN only: scope the list to one business (doc 04 §21.1). */
  businessId?: string;
}

/**
 * doc 04 §21.1 — the response is already scoped by the backend: an admin receives
 * their business's branches, a manager only their assigned branch. A businessId
 * is only ever sent by a SUPER_ADMIN viewing a specific business.
 */
export async function listBranches(
  filters: BranchFilters = {},
): Promise<{ data: Branch[]; meta: PageMeta | null }> {
  return apiClient.list<Branch>('/branches', {
    query: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 100,
      search: filters.search,
      status: filters.status,
      businessId: filters.businessId,
    },
  });
}

export interface CreateBranchInput {
  name: string;
  code: string;
  address: string;
  phone?: string;
}

/** doc 04 §22 — ADMIN, SUPER_ADMIN. `code` is unique within the business. */
export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  return apiClient.post<Branch>('/branches', {
    name: input.name,
    code: input.code,
    address: input.address,
    phone: input.phone ? input.phone : undefined,
  });
}

/**
 * doc 04 §23 — there is no `PATCH /branches/:id/status`, so a status change goes
 * through the branch's own PATCH (see ASSUMPTIONS.md §2.9).
 */
export async function updateBranch(
  id: string,
  input: Partial<CreateBranchInput> & { status?: Branch['status'] },
): Promise<Branch> {
  return apiClient.patch<Branch>(`/branches/${id}`, input);
}

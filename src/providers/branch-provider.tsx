'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { apiClient } from '@/api/client';
import { isBranchScoped } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { Branch, Business } from '@/types/domain';

import { useAuth } from './auth-provider';

interface BranchContextValue {
  branches: Branch[];
  /**
   * The branch every branch-scoped screen should use.
   * - MANAGER: pinned to `user.branchId` — never switchable (PROMPT.md §7).
   * - ADMIN/SUPER_ADMIN: the user's selected branch, or null for "all branches".
   */
  activeBranch: Branch | null;
  /** Branch ids to filter list requests with; empty means "do not filter". */
  activeBranchIds: string[];
  /** False when an administrator is viewing every branch at once. */
  isViewingAllBranches: boolean;
  /** True only for an admin, who may switch. A manager must never see this. */
  canSwitchBranch: boolean;
  setActiveBranchId: (branchId: string | null) => void;
  isLoading: boolean;
  /**
   * SUPER_ADMIN only: the platform businesses. Picking one scopes the
   * session (dashboard, and the business detail view); null means the
   * platform-wide view across every business.
   */
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  canSwitchBusiness: boolean;
  setActiveBusinessId: (businessId: string | null) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

/**
 * doc 04 §21.1 — the list endpoint already scopes itself: a manager receives only
 * their assigned branch, an admin receives their business's branches. So the
 * client sends no branch filter by default and never has to guess at tenancy.
 */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const branchesQuery = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.list<Branch>('/branches', { query: { limit: 100 } }),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  // The business list is a SUPER_ADMIN endpoint; admins and managers would
  // only get a 403, so the query is disabled for them.
  const businessesQuery = useQuery({
    queryKey: queryKeys.businesses.list(),
    queryFn: () => apiClient.list<Business>('/businesses', { query: { limit: 100 } }),
    enabled: Boolean(isSuperAdmin),
    staleTime: 5 * 60_000,
  });

  const branches = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data]);
  const businesses = useMemo(() => businessesQuery.data?.data ?? [], [businessesQuery.data]);

  /**
   * Selection is intentionally *not* persisted to storage: a stale branch id from
   * a previous session would silently scope a manager to the wrong data. Keeping it
   * in component state means it always resets with the session.
   */
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(user?.branchId ?? null);

  /**
   * The SUPER_ADMIN's business scope. Like the branch selection it is session
   * state: null means the platform-wide view across every business.
   */
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  /*
   * A manager's branch is fixed. If the stored selection ever diverges from
   * `user.branchId`, the user's value wins — the UI must never offer a manager a
   * branch they are not assigned to.
   */
  const effectiveSelectedId = isBranchScoped(user?.role)
    ? (user?.branchId ?? null)
    : selectedBranchId;

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === effectiveSelectedId) ?? null,
    [branches, effectiveSelectedId],
  );

  const activeBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId],
  );

  const value = useMemo<BranchContextValue>(() => {
    const canSwitchBranch = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    // For a manager the filter is always their own branch, so it is always sent.
    const activeBranchIds = isBranchScoped(user?.role)
      ? user?.branchId
        ? [user.branchId]
        : []
      : effectiveSelectedId
        ? [effectiveSelectedId]
        : [];

    return {
      branches,
      activeBranch,
      activeBranchIds,
      isViewingAllBranches: activeBranchIds.length === 0,
      canSwitchBranch,
      setActiveBranchId: setSelectedBranchId,
      isLoading: branchesQuery.isLoading,
      businesses,
      activeBusiness,
      activeBusinessId: isSuperAdmin ? selectedBusinessId : null,
      canSwitchBusiness: Boolean(isSuperAdmin),
      setActiveBusinessId: setSelectedBusinessId,
    };
  }, [
    branches,
    activeBranch,
    effectiveSelectedId,
    user,
    setSelectedBranchId,
    branchesQuery.isLoading,
    businesses,
    activeBusiness,
    isSuperAdmin,
    selectedBusinessId,
  ]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranchContext(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranchContext must be used inside <BranchProvider>.');
  return ctx;
}

/** Convenience for list endpoints that accept an optional branch filter. */
export function useActiveBranchFilter(): {
  branchId: string | null;
  branchFilter: Record<string, string>;
} {
  const { activeBranchIds } = useBranchContext();
  const branchId = activeBranchIds.length === 1 ? (activeBranchIds[0] ?? null) : null;
  return { branchId, branchFilter: branchId ? { branchId } : {} };
}

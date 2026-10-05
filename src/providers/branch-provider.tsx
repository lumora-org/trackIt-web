'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { apiClient } from '@/api/client';
import { isBranchScoped } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { Branch } from '@/types/domain';

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
}

const BranchContext = createContext<BranchContextValue | null>(null);

/**
 * doc 04 §21.1 — the list endpoint already scopes itself: a manager receives only
 * their assigned branch, an admin receives their business's branches. So the
 * client sends no branch filter by default and never has to guess at tenancy.
 */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const branchesQuery = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.list<Branch>('/branches', { query: { limit: 100 } }),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const branches = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data]);

  /**
   * Selection is intentionally *not* persisted to storage: a stale branch id from
   * a previous session would silently scope a manager to the wrong data. Keeping it
   * in component state means it always resets with the session.
   */
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(user?.branchId ?? null);

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
    };
  }, [
    branches,
    activeBranch,
    effectiveSelectedId,
    user,
    setSelectedBranchId,
    branchesQuery.isLoading,
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

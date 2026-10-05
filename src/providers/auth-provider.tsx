'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';

import * as authApi from '@/api/auth.api';
import { setAccessToken, setRefreshTokenReader } from '@/api/client';
import { isApiError } from '@/api/errors';
import { scopeViolation } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { AuthenticatedUser } from '@/types/domain';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  /** True while the initial session is being resolved. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: authApi.LoginInput) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /**
   * Set when a user is authenticated but their business/branch scope violates the
   * doc 06 §5 invariants. Rendered as a support message rather than a broken app.
   */
  scopeError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  /**
   * The session is held in memory only. A full page load starts with no token
   * and relies on the httpOnly refresh cookie to silently re-establish it
   * (PROMPT.md §21, see ASSUMPTIONS.md §3.9).
   */
  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.getCurrentUser,
    retry: false,
    // Do not refetch the identity on every window focus; role changes are rare
    // and a 401 here would bounce the user to login mid-task.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });

  /*
   * The API client cannot read an httpOnly cookie, so it asks for the refresh
   * token through this reader. With a real backend this must be wired to a
   * server-side value; with the mock it echoes a placeholder so the flow is
   * exercised end to end.
   */
  useEffect(() => {
    setRefreshTokenReader(() => null);
    return () => setRefreshTokenReader(null);
  }, []);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => {
      setAccessToken(session.accessToken);
      queryClient.setQueryData(queryKeys.auth.me, session.user);
      // Any data cached under a previous identity must not leak to the new one.
      queryClient.clear();
      queryClient.setQueryData(queryKeys.auth.me, session.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } finally {
        // The local session is cleared even if the network call fails.
        setAccessToken(null);
      }
    },
    onSettled: () => {
      queryClient.clear();
    },
  });

  const login = useCallback(
    async (input: authApi.LoginInput) => {
      const session = await loginMutation.mutateAsync(input);
      return session.user;
    },
    [loginMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const refreshUser = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
  }, [queryClient]);

  const user = meQuery.data ?? null;

  const scopeError = useMemo(() => {
    if (!user) return null;
    return scopeViolation(user.role, user.businessId, user.branchId);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      // Only the very first resolution counts as loading; otherwise the whole
      // app flashes a spinner on each background refetch.
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshUser,
      scopeError,
    }),
    [user, meQuery.isLoading, login, logout, refreshUser, scopeError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

/**
 * Narrowed accessor for screens that require authentication. Throwing rather
 * than returning null means a missing provider is a loud bug, not a silent
 * render of `null`.
 */
export function useCurrentUser(): AuthenticatedUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser requires an authenticated user.');
  return user;
}

/** Convenience for mutations that must clear the session on a 401. */
export function isSessionExpired(err: unknown): boolean {
  return isApiError(err) && err.isUnauthorized;
}

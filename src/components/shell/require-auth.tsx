'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { BranchProvider } from '@/providers/branch-provider';
import { useAuth } from '@/providers/auth-provider';
import { canAny, type Capability } from '@/lib/permissions';

/**
 * Authenticated route guard.
 *
 * The session lives in memory (see ASSUMPTIONS.md §3.9), so this cannot be a
 * Next.js middleware — there is no cookie for middleware to read. The guard runs
 * on the client and redirects once `me` resolves.
 *
 * PROMPT.md §6: this is UX, not security. The backend independently rejects any
 * request the user is not entitled to make.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, scopeError } = useAuth();

  useEffect(() => {
    // Wait for `me` to settle before deciding, otherwise a valid session would be
    // bounced to login on every hard refresh.
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // doc 06 §5 — a scope violation means the app cannot function correctly, so
  // stop and explain rather than rendering misleading screens.
  if (scopeError) return <ScopeError message={scopeError} />;
  if (isLoading || !isAuthenticated) return <FullPageLoader />;

  return <BranchProvider>{children}</BranchProvider>;
}

/** Wraps every authenticated screen; used by `src/app/(app)/layout.tsx`. */
export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

/**
 * Guards a single screen by capability, so navigating straight to a forbidden URL
 * explains itself instead of rendering an empty page.
 *
 * PROMPT.md §6 — hiding a button is not security, so this only affects UX. The
 * backend remains the authority.
 */
export function RequireCapability({
  anyOf,
  children,
}: {
  anyOf: readonly Capability[];
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (!canAny(user?.role, anyOf)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
          <ShieldAlert className="size-6 text-neutral-500" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-neutral-900">Not available</h1>
          <p className="max-w-sm text-sm text-neutral-600">
            Your role does not have access to this section. Contact your administrator if you
            believe this is wrong.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function FullPageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50"
    >
      <Loader2 className="text-brand-600 size-7 animate-spin" aria-hidden="true" />
      <p className="text-sm text-neutral-600">Loading your workspace&hellip;</p>
    </div>
  );
}

function ScopeError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-warning-50 flex size-12 items-center justify-center rounded-full">
        <ShieldAlert className="text-warning-700 size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-neutral-900">Account configuration problem</h1>
        <p className="max-w-sm text-sm text-neutral-600">{message}</p>
      </div>
      <Button onClick={() => router.replace('/login')}>Sign in again</Button>
    </div>
  );
}

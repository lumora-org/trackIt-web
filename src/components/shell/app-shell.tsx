'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, LogOut, MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { apiClient } from '@/api/client';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/format';
import { PROFILE_ITEM, visibleBottomBar, visibleGroups } from '@/lib/navigation';
import { ROLE_LABELS } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { Business } from '@/types/domain';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Drawer } from '@/components/ui/dialog';
import { NavLink } from './nav-link';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Responsive application shell (PROMPT.md §5).
 *
 *   mobile  : TopBar + BottomNavigation + drawer for everything else
 *   desktop : Sidebar + main content
 *
 * Rendered by `src/app/(app)/layout.tsx` only after authentication succeeds, so
 * no route below it needs its own guard.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, scopeError } = useAuth();
  const { activeBranch, branches, canSwitchBranch, setActiveBranchId, isViewingAllBranches } =
    useBranchContext();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const router = useRouter();

  const businessQuery = useQuery({
    queryKey: queryKeys.businesses.detail(user?.businessId ?? 'none'),
    // A manager may not be permitted to read /businesses; the name is optional
    // decoration, so a failure must not break the shell.
    queryFn: () => apiClient.get<Business>(`/businesses/${user!.businessId}`),
    enabled: Boolean(user?.businessId),
    retry: false,
    staleTime: 10 * 60_000,
  });

  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const { meta } = await apiClient.list('/notifications', {
        query: { status: 'UNREAD', limit: 1 },
      });
      return meta?.total ?? 0;
    },
    enabled: Boolean(user),
    // No polling interval is documented anywhere (see ASSUMPTIONS.md §3.8); this
    // is a pragmatic assumption for an in-app badge.
    refetchInterval: 60_000,
  });

  const bottomBar = visibleBottomBar(user?.role);
  const role = user?.role ?? null;

  async function handleSignOut() {
    setSignOutOpen(false);
    await logout();
    // `logout` clears the query cache, so no in-memory data survives.
    router.replace('/login');
  }

  return (
    <div className="flex min-h-dvh bg-neutral-50">
      <Sidebar
        role={role}
        roleLabel={user ? ROLE_LABELS[user.role] : null}
        businessName={businessQuery.data?.name ?? null}
        onSignOut={() => setSignOutOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          businessName={businessQuery.data?.name ?? 'K.B.Y GLOBAL INVESTMENT'}
          branchName={activeBranch?.name ?? null}
          userLabel={user ? fullName(user) : null}
          roleLabel={user ? ROLE_LABELS[user.role] : null}
          onOpenDrawer={() => setDrawerOpen(true)}
          unreadCount={unreadQuery.data}
        />

        {/*
          The business/branch context bar is desktop-only; on mobile it lives in
          the TopBar so it stays visible without consuming vertical space.
        */}
        <div className="hidden items-center gap-3 border-b border-neutral-200 bg-white px-6 py-2 lg:flex">
          <span className="flex items-center gap-1.5 text-sm text-neutral-600">
            <Building2 className="size-4 text-neutral-400" aria-hidden="true" />
            {businessQuery.data?.name ?? '—'}
          </span>

          <BranchSwitcher
            branches={branches}
            activeBranchId={activeBranch?.id ?? null}
            canSwitch={canSwitchBranch}
            viewingAll={isViewingAllBranches}
            onChange={setActiveBranchId}
          />

          {user ? (
            <Badge tone="brand" size="sm" className="ml-auto">
              {ROLE_LABELS[user.role]}
            </Badge>
          ) : null}
        </div>

        {scopeError ? (
          <div
            role="alert"
            className="border-warning-500/30 bg-warning-50 text-warning-700 border-b px-4 py-2.5 text-sm"
          >
            {scopeError} Please contact your administrator.
          </div>
        ) : null}

        <main id="main-content" className="flex-1 px-4 py-4 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ------------------------------------------- mobile bottom bar */}
      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-0.5 border-t border-neutral-200 bg-white/95 px-1 pt-1 backdrop-blur lg:hidden"
      >
        {bottomBar.map((item) => (
          <NavLink key={item.href} item={item} variant="bottom" />
        ))}

        {/*
          "More" is a button, not a link: on mobile there is no room for every
          destination in the bar, so it opens the drawer instead of navigating to
          a page that would just re-explain the menu.
        */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu with all sections"
          aria-expanded={drawerOpen}
          className={cn(
            'min-h-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.6875rem] font-medium text-neutral-500 transition-colors hover:text-neutral-700',
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {/* ------------------------------------------------- mobile drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Menu"
        description={`Signed in as ${user ? fullName(user) : ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button variant="danger" onClick={() => setSignOutOpen(true)}>
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </>
        }
      >
        <BranchSwitcher
          branches={branches}
          activeBranchId={activeBranch?.id ?? null}
          canSwitch={canSwitchBranch}
          viewingAll={isViewingAllBranches}
          onChange={(id) => {
            setActiveBranchId(id);
            setDrawerOpen(false);
          }}
        />

        <nav aria-label="All sections" className="mt-4 space-y-5">
          {visibleGroups(role).map((group) => (
            <div key={group.title ?? 'root'}>
              {group.title ? (
                <p className="mb-1.5 px-3 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
                  {group.title}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} onNavigate={() => setDrawerOpen(false)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="mb-1.5 px-3 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              Account
            </p>
            <ul className="space-y-0.5">
              <li>
                <NavLink item={PROFILE_ITEM} onNavigate={() => setDrawerOpen(false)} />
              </li>
            </ul>
          </div>
        </nav>
      </Drawer>

      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={handleSignOut}
        title="Sign out?"
        description="You will need to sign in again to continue."
        confirmLabel="Sign out"
      />
    </div>
  );
}

/* ------------------------------------------------------- branch switcher */

/**
 * PROMPT.md §7 — an administrator may filter by branch; a manager may not.
 * The switcher is simply not rendered for a manager, and `canSwitchBranch`
 * additionally guards the handler.
 */
function BranchSwitcher({
  branches,
  activeBranchId,
  canSwitch,
  viewingAll,
  onChange,
}: {
  branches: Array<{ id: string; name: string; code: string; status: string }>;
  activeBranchId: string | null;
  canSwitch: boolean;
  viewingAll: boolean;
  onChange: (branchId: string | null) => void;
}) {
  if (!canSwitch) {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
        {branches.find((b) => b.id === activeBranchId)?.name ?? 'All branches'}
      </span>
    );
  }

  if (branches.length === 0) {
    return <span className="text-sm text-neutral-500">All branches</span>;
  }

  return (
    <div className="relative">
      <label htmlFor="branch-switcher" className="sr-only">
        Filter by branch
      </label>
      <select
        id="branch-switcher"
        value={activeBranchId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="focus:border-brand-500 focus:ring-brand-500 min-h-9 appearance-none rounded-lg border border-neutral-300 bg-white py-1 pr-8 pl-2.5 text-sm font-medium text-neutral-800 focus:ring-2 focus:outline-none"
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-neutral-500"
        aria-hidden="true"
      />
      {viewingAll ? <span className="sr-only">Showing all branches</span> : null}
    </div>
  );
}

'use client';

import { Fuel, LogOut } from 'lucide-react';

import { PROFILE_ITEM, visibleGroups, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/cn';
import type { UserRole } from '@/types/domain';

import { NavLink } from './nav-link';

/**
 * Navigation tree used by both the desktop sidebar and the mobile drawer, so the
 * two can never drift apart (PROMPT.md §5 requires grouped, role-aware nav).
 */
export function NavTree({
  role,
  onNavigate,
  className,
}: {
  role: UserRole | null;
  onNavigate?: () => void;
  className?: string;
}) {
  const groups = visibleGroups(role);

  return (
    <nav aria-label="Main" className={cn('space-y-5', className)}>
      {groups.map((group) => (
        <div key={group.title ?? 'root'}>
          {group.title ? (
            <p className="mb-1.5 px-3 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              {group.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Desktop-only persistent sidebar. */
export function Sidebar({
  role,
  roleLabel,
  businessName,
  onSignOut,
}: {
  role: UserRole | null;
  roleLabel: string | null;
  businessName: string | null;
  onSignOut: () => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-surface lg:flex">
      <div className="flex items-center gap-2.5 border-b border-neutral-200 px-4 py-4">
        <span className="bg-brand-600 flex size-9 shrink-0 items-center justify-center rounded-xl text-white">
          <Fuel className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-900">TrackIt</p>
          <p className="truncate text-xs text-neutral-500">
            {businessName ?? roleLabel ?? 'Operations'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavTree role={role} />
      </div>

      <div className="border-t border-neutral-200 p-3">
        <ul className="space-y-0.5">
          <li>
            <NavLink item={PROFILE_ITEM} />
          </li>
          <li>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-touch text-danger-700 hover:bg-danger-50 flex w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors"
            >
              <LogOut className="size-5 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}

export type { NavItem };

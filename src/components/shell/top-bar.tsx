'use client';

import { Menu } from 'lucide-react';

import { ROLE_LABELS } from '@/lib/permissions';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

import { Button } from '@/components/ui/button';

/**
 * Compact header for mobile. The business/branch context lives here so a manager
 * can always see which branch they are operating (PROMPT.md §7).
 */
export function TopBar({
  businessName,
  branchName,
  userLabel,
  roleLabel,
  onOpenDrawer,
  unreadCount,
  className,
}: {
  businessName: string | null;
  branchName: string | null;
  userLabel: string | null;
  roleLabel: string | null;
  onOpenDrawer: () => void;
  unreadCount?: number;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'safe-top sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenDrawer}
          aria-label="Open navigation menu"
          aria-expanded={false}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {businessName ?? 'TrackIt'}
          </p>
          {/* PROMPT.md §7 — branch context must always be visible to a manager. */}
          {branchName ? <p className="truncate text-xs text-neutral-500">{branchName}</p> : null}
        </div>

        {unreadCount ? (
          <span
            className="bg-danger-500 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}

        <span
          className="bg-brand-100 text-brand-800 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          title={userLabel ? `${userLabel} · ${roleLabel ?? ''}` : undefined}
        >
          {userLabel ? initials(...splitName(userLabel)) : '—'}
        </span>
      </div>
    </header>
  );
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  return [parts[0] ?? '', parts.slice(1).join(' ')];
}

export { ROLE_LABELS };

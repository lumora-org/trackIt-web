'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';

import { PROFILE_ITEM } from '@/lib/navigation';
import { ROLE_LABELS } from '@/lib/permissions';
import { cn } from '@/lib/cn';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { ThemeToggle } from './theme-toggle';

/**
 * Compact header for mobile. The business/branch context lives here so a manager
 * can always see which branch they are operating (PROMPT.md §7).
 */
export function TopBar({
  businessName,
  branchName,
  userLabel,
  avatarUrl,
  roleLabel,
  onOpenDrawer,
  unreadCount,
  className,
}: {
  businessName: string | null;
  branchName: string | null;
  userLabel: string | null;
  avatarUrl: string | null;
  roleLabel: string | null;
  onOpenDrawer: () => void;
  unreadCount?: number;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'safe-top bg-surface/95 sticky top-0 z-30 border-b border-neutral-200 backdrop-blur',
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
          <Link
            href="/notifications"
            aria-label={`${unreadCount} unread notifications — open notifications`}
            className="bg-danger-500 hover:opacity-80 inline-flex min-w-5 cursor-pointer items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold text-white transition-opacity"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Link>
        ) : null}

        <ThemeToggle />

        <Link
          href={PROFILE_ITEM.href}
          aria-label="Open your profile"
          className="hover:opacity-80 shrink-0 cursor-pointer rounded-full transition-opacity"
          title={userLabel ? `${userLabel} · ${roleLabel ?? ''}` : undefined}
        >
          <Avatar name={userLabel} src={avatarUrl} />
        </Link>
      </div>
    </header>
  );
}

export { ROLE_LABELS };

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import type { NavItem } from '@/lib/navigation';

/**
 * A navigation link.
 *
 * Active state is computed from the pathname rather than a click handler so it is
 * correct on first render and on browser back/forward. The parent segment is
 * matched so `/sales/123` still highlights "Sales".
 */
export function NavLink({
  item,
  className,
  activeClassName,
  variant = 'sidebar',
  onNavigate,
}: {
  item: NavItem;
  className?: string;
  activeClassName?: string;
  variant?: 'sidebar' | 'bottom';
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || (pathname !== '/' && pathname.startsWith(`${item.href}/`));

  const Icon = item.icon;

  if (variant === 'bottom') {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'min-h-touch flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.6875rem] font-medium transition-colors',
          isActive ? 'text-brand-700' : 'text-neutral-500 hover:text-neutral-700',
          className,
          activeClassName,
        )}
      >
        <Icon className={cn('size-5', isActive && 'stroke-[2.25]')} aria-hidden="true" />
        <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'min-h-touch flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
        isActive
          ? 'bg-brand-50 text-brand-800'
          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
        className,
        activeClassName,
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {isActive ? (
        <span className="bg-brand-600 ml-auto size-1.5 rounded-full" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

'use client';

import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Skeleton } from './states';

/**
 * StatCard — the dashboard building block (PROMPT.md §8).
 *
 * Renders the label, a large value, and an optional trend/footnote. Loading
 * preserves the card's height so the grid does not reflow on every refresh.
 */

const iconTone = cva('flex size-10 shrink-0 items-center justify-center rounded-xl', {
  variants: {
    tone: {
      brand: 'bg-brand-50 text-brand-700',
      success: 'bg-success-50 text-success-700',
      warning: 'bg-warning-50 text-warning-700',
      danger: 'bg-danger-50 text-danger-700',
      info: 'bg-info-50 text-info-700',
      neutral: 'bg-neutral-100 text-neutral-700',
    },
  },
  defaultVariants: { tone: 'brand' },
});

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Rendered small under the value — e.g. "Across 3 branches". */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  loading = false,
  className,
}: StatCardProps) {
  return (
    <div className={cn('rounded-card border border-neutral-200 bg-white p-4 shadow-xs', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        {Icon ? (
          <span className={iconTone({ tone })}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        <p className="mt-1.5 text-2xl leading-tight font-bold tracking-tight text-neutral-900 tabular-nums">
          {value}
        </p>
      )}

      {loading ? (
        <Skeleton className="mt-2 h-3 w-24" />
      ) : hint ? (
        <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Label/value row used inside cards. Mobile-first: stacks by default and
 * becomes a two-column row from `sm` up.
 */
export function DetailRow({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 border-b border-neutral-100 py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4',
        className,
      )}
    >
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd
        className={cn(
          'text-sm tabular-nums',
          emphasis ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-800',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Section heading used to break long detail views into scannable groups. */
export function SectionHeading({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex items-center justify-between gap-3', className)}>
      <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">{title}</h3>
      {action}
    </div>
  );
}

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { PageMeta } from '@/types/domain';

import { Button } from './button';
import { EmptyState, ErrorState, LoadingState } from './states';

/**
 * Responsive data presentation (PROMPT.md §16).
 *
 * Mobile must not render enormous desktop tables, and the UI must not depend on
 * hover. So each row has two renderings driven by one column definition:
 *
 *  - `md+`  : a real `<table>`
 *  - `<md`  : a stacked card, with `primary` as the card heading and `secondary`
 *             as the muted subtitle
 *
 * Columns marked `mobileHidden` are omitted from the card entirely; anything
 * else becomes a label/value pair.
 */

export interface Column<T> {
  /** Stable key, also used as the mobile label. */
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Right-align numeric columns on desktop. */
  align?: 'left' | 'right';
  /** Column class for desktop cells. */
  className?: string;
  /** Omit from the mobile card. Use for wide/low-priority fields. */
  mobileHidden?: boolean;
  /** Render first and bold on mobile. */
  primary?: boolean;
  /** Render directly under the primary line on mobile. */
  secondary?: boolean;
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  data: readonly T[];
  rowKey: (row: T) => string;
  /** Shown on mobile when there is no data. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick?: () => void };
  /** Icon for the empty state (PROMPT.md §19 — a meaningful empty state). */
  emptyIcon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  /** Accessible label for the table element. */
  caption: string;
  meta?: PageMeta | null;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyTitle = 'Nothing to show yet',
  emptyDescription,
  emptyAction,
  emptyIcon,
  loading = false,
  loadingLabel,
  error,
  onRetry,
  onRowClick,
  caption,
  meta,
  onPageChange,
  className,
}: DataTableProps<T>) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        icon={emptyIcon}
      />
    );
  }

  const cardColumns = columns.filter((c) => !c.mobileHidden);
  const primary = columns.find((c) => c.primary) ?? cardColumns[0];
  const secondary = columns.filter((c) => c.secondary && c.key !== primary?.key);
  // Any remaining non-primary column still shows on mobile.
  const details = cardColumns.filter(
    (c) => c.key !== primary?.key && !secondary.some((s) => s.key === c.key),
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* ------------------------------------------------ desktop: table */}
      <div className="rounded-card hidden overflow-x-auto border border-neutral-200 bg-white md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-xs font-semibold tracking-wide text-neutral-600 uppercase',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-neutral-100 last:border-0',
                  onRowClick && 'cursor-pointer focus-within:bg-neutral-50 hover:bg-neutral-50',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 align-middle text-neutral-800',
                      col.align === 'right' && 'text-right',
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------- mobile: cards */}
      <ul className="space-y-3 md:hidden">
        {data.map((row) => {
          const interactive = Boolean(onRowClick);
          return (
            <li key={rowKey(row)}>
              <div
                className={cn(
                  'rounded-card border border-neutral-200 bg-white p-4 shadow-xs',
                  interactive && 'active:bg-neutral-50',
                )}
              >
                {primary ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {primary.secondary === true ? null : (
                        <div className="font-semibold text-neutral-900">{primary.render(row)}</div>
                      )}
                      {secondary.map((col) => (
                        <p key={col.key} className="mt-0.5 truncate text-sm text-neutral-600">
                          {col.render(row)}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {details.length > 0 ? (
                  <dl className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                    {details.map((col) => (
                      <div key={col.key} className="flex items-baseline justify-between gap-3">
                        <dt className="text-xs text-neutral-500">{col.header}</dt>
                        <dd className="text-right text-sm font-medium text-neutral-800">
                          {col.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {interactive ? (
                  <button
                    type="button"
                    onClick={() => onRowClick?.(row)}
                    className="sr-only focus:not-sr-only focus:mt-3 focus:w-full focus:rounded-lg focus:bg-neutral-100 focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
                  >
                    Open details
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {meta && onPageChange && meta.totalPages > 1 ? (
        <Pagination meta={meta} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}

/** doc 04 §89 — page/limit with 1-indexed pages. */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  const { page, limit, total, totalPages } = meta;
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-sm text-neutral-600" aria-live="polite">
        Showing <span className="font-medium">{first}</span>–
        <span className="font-medium">{last}</span> of{' '}
        <span className="font-medium">{total.toLocaleString('en-NG')}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
        <span className="text-sm text-neutral-600 tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

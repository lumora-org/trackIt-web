import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from './button';

/* ------------------------------------------------------------- loading */

/**
 * PROMPT.md §18 — never leave a blank screen while a request is running.
 * Skeletons preserve layout so the page does not jump when data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-neutral-200/70', className)}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-card border border-neutral-200 bg-white p-4', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-36" />
      <SkeletonText lines={2} className="mt-3" />
    </div>
  );
}

/**
 * Spinner for inline/busy regions. `label` is required so assistive tech always
 * receives something meaningful (PROMPT.md §26).
 */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center"
    >
      <RefreshCw className="text-brand-600 size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm text-neutral-600">{label}</p>
    </div>
  );
}

/* --------------------------------------------------------------- empty */

/**
 * PROMPT.md §19 — "No data" is not acceptable; every empty state needs a
 * meaningful message and, where possible, the action that resolves it.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
        <Icon className="size-6 text-neutral-500" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-neutral-900">{title}</p>
        {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
      </div>
      {action ? (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- error */

/**
 * PROMPT.md §20 — translate API failures into useful messages. The server's
 * message is already normalised by the API client, so it is safe to show.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-card border-danger-500/25 bg-danger-50/60 flex flex-col items-center justify-center gap-3 border px-6 py-10 text-center',
        className,
      )}
    >
      <span className="bg-danger-50 flex size-11 items-center justify-center rounded-full">
        <AlertTriangle className="text-danger-500 size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-neutral-900">{title}</p>
        {message ? <p className="text-sm text-neutral-700">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Inline form-level error, used when a mutation fails but the screen should
 * stay mounted (PROMPT.md §17 — preserve user input after validation failures).
 */
export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'border-danger-500/30 bg-danger-50 text-danger-700 rounded-xl border px-3 py-2.5 text-sm',
        className,
      )}
    >
      {message}
    </p>
  );
}

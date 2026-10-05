'use client';

import { cn } from '@/lib/cn';

/**
 * Segmented control for switching between a small set of views.
 *
 * Mobile-first: the control scrolls horizontally rather than wrapping, so it
 * never pushes content below the fold, and it never relies on hover.
 */
export interface SegmentedTabsOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedTabsOption<T>>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        '-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0',
        'inline-flex min-w-full gap-1 rounded-xl bg-neutral-100 p-1 sm:min-w-0',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-touch focus-visible:outline-brand-600 flex-1 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2',
              selected
                ? 'bg-surface text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

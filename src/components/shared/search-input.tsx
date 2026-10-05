'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Debounced search box.
 *
 * PROMPT.md §28 requires debounced search so typing does not fire a request per
 * keystroke. The input stays fully controlled and responsive while the *query* is
 * debounced.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label,
  className,
  debounceMs = 350,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
  debounceMs?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  /*
   * React's documented "adjust state when a prop changes" pattern: adjust during
   * render rather than in an effect, which would cause a cascading render. This
   * keeps the box in sync when the parent resets the filter.
   */
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChange(draft), debounceMs);
    return () => clearTimeout(timer);
  }, [draft, value, onChange, debounceMs]);

  return (
    <div className={cn('relative', className)}>
      <label htmlFor="search-input" className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
        aria-hidden="true"
      />
      <input
        id="search-input"
        type="search"
        inputMode="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="min-h-touch focus:border-brand-500 focus:ring-brand-500 w-full rounded-xl border border-neutral-300 bg-surface pr-10 pl-9 text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <button
          type="button"
          onClick={() => setDraft('')}
          aria-label="Clear search"
          className="size-touch focus-visible:outline-brand-600 absolute top-1/2 right-1 flex -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 focus-visible:outline-2"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** Compact select for status/type filters. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
}) {
  const id = `filter-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-touch focus:border-brand-500 focus:ring-brand-500 w-full appearance-none rounded-xl border border-neutral-300 bg-surface pr-8 pl-3 text-sm font-medium text-neutral-800 focus:ring-2 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

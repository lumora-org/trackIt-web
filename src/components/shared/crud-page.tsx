'use client';

import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { SearchInput } from '@/components/shared/search-input';
import type { AccountStatus, PageMeta } from '@/types/domain';

/**
 * Shared list-and-dialog scaffold for the configuration CRUD screens.
 *
 * Suppliers and tankers differ only in their columns and form fields, so the
 * pagination, debounced search, empty state and create/edit dialog plumbing live
 * here once rather than being duplicated per module (PROMPT.md §29 bans duplicated
 * UI logic).
 *
 * This is deliberately not a generic form builder: each module keeps its own
 * strongly-typed form so field-level validation stays explicit.
 */
export interface CrudPageProps<T> {
  title: string;
  description: string;
  /** Icon for the empty state. */
  icon: React.ComponentType<{ className?: string }>;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  loading: boolean;
  loadingLabel: string;
  error: string | null;
  onRetry: () => void;
  meta: PageMeta | null;
  onPageChange: (page: number) => void;
  canManage: boolean;
  onCreate: () => void;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Extra controls beside the search box, e.g. a status filter. */
  toolbar?: ReactNode;
  /** The create/edit dialog, rendered once by the caller. */
  dialog?: ReactNode;
  onRowClick?: (row: T) => void;
}

export function CrudPage<T>({
  title,
  description,
  icon,
  columns,
  rows,
  rowKey,
  search,
  onSearchChange,
  searchPlaceholder,
  loading,
  loadingLabel,
  error,
  onRetry,
  meta,
  onPageChange,
  canManage,
  onCreate,
  createLabel,
  emptyTitle,
  emptyDescription,
  toolbar,
  dialog,
  onRowClick,
}: CrudPageProps<T>) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>
        {canManage ? (
          <Button onClick={onCreate}>
            <Plus className="size-4" aria-hidden="true" />
            {createLabel}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          label={`Search ${title.toLowerCase()}`}
        />
        {toolbar}
      </div>

      <DataTable
        caption={title}
        columns={columns}
        data={rows}
        rowKey={rowKey}
        loading={loading}
        loadingLabel={loadingLabel}
        error={error}
        onRetry={onRetry}
        meta={meta}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        emptyTitle={rows.length === 0 && search ? 'No matches found' : emptyTitle}
        emptyDescription={
          rows.length === 0 && search
            ? `Nothing matches "${search}". Try a different search.`
            : emptyDescription
        }
        emptyIcon={icon}
        emptyAction={canManage ? { label: createLabel, onClick: onCreate } : undefined}
      />

      {dialog}
    </div>
  );
}

/** Shared status filter options for configuration resources. */
export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
] as const;

/**
 * Manages the page/search/status state every configuration list needs.
 *
 * The status is typed to the `account_status` enum rather than a bare string so
 * it can be passed straight through to a list endpoint (doc 03 §12).
 */
export function useCrudListState() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatusRaw] = useState<AccountStatus | ''>('');

  return {
    page,
    search,
    status: status === '' ? undefined : status,
    setPage,
    setStatus: (value: string) => setStatusRaw(value as AccountStatus | ''),
    setSearch: (value: string) => {
      setSearch(value);
      // Any filter change invalidates the current page number.
      setPage(1);
    },
  };
}

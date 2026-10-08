'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Package, Scale, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import { listFuelTypes } from '@/api/fuel-types.api';
import {
  adjustmentSchema,
  createAdjustment,
  getInventoryStock,
  listInventoryTransactions,
  LEDGER_TYPE_FILTER_OPTIONS,
  toAdjustmentPayload,
  type AdjustmentValues,
  type InventoryFilters,
} from '@/api/inventory.api';
import { SignedQuantityDisplay } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FilterSelect } from '@/components/shared/search-input';
import { EmptyState, ErrorState, InlineError, SkeletonCard } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatDateTime, formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { invalidateForResource, queryKeys } from '@/lib/query-keys';
import type { InventoryStock, InventoryTransaction } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Products (the inventory ledger; PROMPT.md §31 step 13, §10).
 *
 * Current stock is a glanceable summary; the ledger below it shows date, type,
 * quantity, balance and reference, with positive and negative movements
 * visually distinguished as §10 requires.
 */
export function InventoryPage() {
  const { user } = useAuth();
  const { activeBranchIds } = useBranchContext();
  const canAdjust = can(user?.role, 'inventory.adjust');

  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [fuelFilter, setFuelFilter] = useState('');

  const stockQuery = useQuery({
    queryKey: queryKeys.inventory.stock({ branchId }),
    queryFn: () => getInventoryStock({ branchId }),
    // doc 05 §117 — current inventory must not come from a stale cache.
    staleTime: 15_000,
  });

  const ledgerFilters: InventoryFilters = {
    page,
    limit: 50,
    branchId,
    fuelTypeId: fuelFilter || undefined,
    type: (typeFilter || undefined) as InventoryFilters['type'],
  };

  const ledgerQuery = useQuery({
    queryKey: queryKeys.inventory.transactions(ledgerFilters),
    queryFn: () => listInventoryTransactions(ledgerFilters),
  });

  const fuelTypesQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ activeOnly: true }),
    queryFn: () => listFuelTypes({ limit: 100, status: 'ACTIVE' }),
  });

  const fuelName = (id?: string) => fuelTypesQuery.data?.data.find((f) => f.id === id)?.code ?? '—';

  const stockColumns: Column<InventoryStock>[] = [
    {
      key: 'fuelTypeName',
      header: 'Fuel',
      primary: true,
      render: (r) => (
        <span className="font-mono text-base font-semibold text-neutral-900">{r.fuelTypeName}</span>
      ),
    },
    {
      key: 'currentQuantityLitres',
      header: 'Current stock',
      align: 'right',
      secondary: true,
      render: (r) => (
        <span className="text-lg font-semibold text-neutral-900">
          {formatLitres(r.currentQuantityLitres)}
        </span>
      ),
    },
    {
      key: 'branchName',
      header: 'Branch',
      render: (r) => r.branchName,
    },
  ];

  const ledgerColumns: Column<InventoryTransaction>[] = [
    {
      key: 'occurredAt',
      header: 'Date',
      primary: true,
      render: (r) => formatDateTime(r.occurredAt),
    },
    {
      key: 'transactionType',
      header: 'Type',
      render: (r) => (
        <Badge
          tone={
            r.transactionType === 'SALE'
              ? 'info'
              : r.transactionType === 'DELIVERY' || r.transactionType === 'OPENING_BALANCE'
                ? 'success'
                : 'warning'
          }
          size="sm"
        >
          {r.transactionType.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'fuelTypeId',
      header: 'Fuel',
      render: (r) => fuelName(r.fuelTypeId),
    },
    {
      key: 'quantityLitres',
      header: 'Quantity',
      align: 'right',
      // PROMPT.md §10 — positive and negative must be visually distinct.
      render: (r) => <SignedQuantityDisplay value={r.quantityLitres} />,
    },
    {
      key: 'balanceAfter',
      header: 'Balance',
      align: 'right',
      render: (r) => formatLitres(r.balanceAfter),
    },
    {
      key: 'reference',
      header: 'Reference',
      mobileHidden: true,
      render: (r) => r.referenceType ?? '—',
    },
    {
      key: 'reason',
      header: 'Reason',
      mobileHidden: true,
      render: (r) => r.reason ?? '—',
    },
  ];

  const stock = stockQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Products</h1>
          <p className="text-sm text-neutral-500">Current stock and the full movement history.</p>
        </div>
        {canAdjust ? (
          <Button onClick={() => setAdjustOpen(true)} disabled={stock.length === 0}>
            <Scale className="size-4" aria-hidden="true" />
            Adjust stock
          </Button>
        ) : null}
      </header>

      {/* -------------------------------------------------- current stock */}
      <section>
        <CardHeader className="border-0 px-0 pb-2">
          <CardTitle>Current stock</CardTitle>
        </CardHeader>

        {stockQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : stockQuery.isError ? (
          <ErrorState message={stockQuery.error.message} onRetry={() => stockQuery.refetch()} />
        ) : stock.length === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                title="No stock recorded"
                description="Stock appears here once an opening balance, delivery or adjustment is recorded."
                icon={Package}
              />
            </CardBody>
          </Card>
        ) : (
          <>
            {/* Stacked cards on mobile; a real table from md up. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stock.map((row) => (
                <div
                  key={`${row.branchId}-${row.fuelTypeId}`}
                  className="rounded-card border border-neutral-200 bg-surface p-4 shadow-xs"
                >
                  <p className="font-mono text-sm font-semibold text-neutral-500">
                    {row.fuelTypeName}
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
                    {formatLitres(row.currentQuantityLitres)}
                  </p>
                  {activeBranchIds.length > 1 ? (
                    <p className="mt-1 text-xs text-neutral-500">{row.branchName}</p>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Table for wide screens where there is room for it. */}
            <div className="mt-4 hidden md:block">
              <DataTable
                caption="Current stock"
                columns={stockColumns}
                data={stock}
                rowKey={(r) => `${r.branchId}-${r.fuelTypeId}`}
              />
            </div>
          </>
        )}
      </section>

      {/* ---------------------------------------------------------- ledger */}
      <section className="space-y-3">
        <CardHeader className="border-0 px-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-neutral-400" aria-hidden="true" />
            Movement history
          </CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-3 sm:flex-row">
          <FilterSelect
            className="sm:w-56"
            label="Filter by fuel type"
            value={fuelFilter}
            onChange={(value) => {
              setFuelFilter(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All fuel types' },
              ...(fuelTypesQuery.data?.data ?? []).map((f) => ({
                value: f.id,
                label: f.code,
              })),
            ]}
          />
          <FilterSelect
            className="sm:w-56"
            label="Filter by movement type"
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
            options={LEDGER_TYPE_FILTER_OPTIONS}
          />
        </div>

        <DataTable
          caption="Stock movement history"
          columns={ledgerColumns}
          data={ledgerQuery.data?.data ?? []}
          rowKey={(r) => r.id}
          loading={ledgerQuery.isLoading}
          loadingLabel="Loading stock history"
          error={ledgerQuery.error?.message ?? null}
          onRetry={() => ledgerQuery.refetch()}
          meta={ledgerQuery.data?.meta ?? null}
          onPageChange={setPage}
          emptyTitle="No movements yet"
          emptyDescription="Every delivery, sale and adjustment is recorded here."
          emptyIcon={History}
        />

        {/*
          doc 03 §47 — balance_after is a derived snapshot; the transaction
          history is authoritative.
        */}
        <p className="text-xs text-neutral-500">
          Balances are a running snapshot. The transaction history is the authoritative record.
        </p>
      </section>

      <AdjustmentDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        stock={stock}
        branchId={branchId ?? stock[0]?.branchId ?? ''}
      />
    </div>
  );
}

/* ------------------------------------------------------- adjustment */

function AdjustmentDialog({
  open,
  onClose,
  stock,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  stock: InventoryStock[];
  branchId: string;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { direction: 'decrease', quantityLitres: 0, reason: '' },
  });

  const direction = watch('direction');
  const fuelTypeId = watch('fuelTypeId');
  const quantity = watch('quantityLitres');

  // Resolve the target stock row so the dialog can warn before it is too late.
  const target = stock.find((s) => s.fuelTypeId === fuelTypeId && s.branchId === branchId);
  const projected =
    target && quantity
      ? target.currentQuantityLitres + (direction === 'decrease' ? -quantity : quantity)
      : null;
  const wouldGoNegative = projected !== null && projected < 0;

  /*
    An adjustment posts to exactly one branch, and `stock` spans every branch
    currently in view. Mapping it directly would list the same fuel type once
    per branch — duplicating option keys and mislabelling the attached stock.
  */
  const branchStock = new Map<string, InventoryStock>();
  for (const row of stock) {
    if (row.branchId === branchId) branchStock.set(row.fuelTypeId, row);
  }

  const mutation = useMutation({
    mutationFn: (values: AdjustmentValues) =>
      createAdjustment(toAdjustmentPayload(values, branchId)),
    onSuccess: () => {
      for (const key of invalidateForResource('inventory')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        const qtyError = err.fieldError('quantityLitres');
        const reasonError = err.fieldError('reason');
        if (qtyError) setError('quantityLitres', { message: qtyError });
        if (reasonError) setError('reason', { message: reasonError });
        setFormError(qtyError || reasonError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Adjust stock"
      description="An adjustment is a new transaction, not an edit. History is never rewritten."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            loadingText="Recording"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Record adjustment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Select
          label="Fuel type"
          placeholder="Select a fuel type"
          options={[...branchStock.values()].map((s) => ({
            value: s.fuelTypeId,
            label: `${s.fuelTypeName} — ${formatLitres(s.currentQuantityLitres)}`,
          }))}
          error={errors.fuelTypeId?.message}
          disabled={mutation.isPending}
          {...register('fuelTypeId')}
        />

        <Select
          label="Direction"
          options={[
            { value: 'decrease', label: 'Decrease (stock found short)' },
            { value: 'increase', label: 'Increase (stock found over)' },
          ]}
          error={errors.direction?.message}
          disabled={mutation.isPending}
          {...register('direction')}
        />

        <Input
          label="Quantity"
          type="number"
          inputMode="numeric"
          step="0.001"
          min="0"
          placeholder="100"
          error={errors.quantityLitres?.message}
          disabled={mutation.isPending}
          {...register('quantityLitres', { valueAsNumber: true })}
        />

        {projected !== null && target ? (
          <div
            className={cn(
              'rounded-xl px-3 py-2.5 text-sm',
              wouldGoNegative ? 'bg-danger-50 text-danger-700' : 'bg-neutral-100 text-neutral-700',
            )}
          >
            New balance: <span className="font-semibold">{formatLitres(projected)}</span>
            {wouldGoNegative ? ' — this would take stock below zero.' : ''}
          </div>
        ) : null}

        <Textarea
          label="Reason"
          placeholder="Physical stock count discrepancy"
          description="Required. This is recorded in the audit trail."
          error={errors.reason?.message}
          disabled={mutation.isPending}
          {...register('reason')}
        />
      </div>
    </Dialog>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';

import { isApiError } from '@/api/errors';
import { listFuelTypes } from '@/api/fuel-types.api';
import { listSales, voidSale, type SalesFilters } from '@/api/sales.api';
import { CurrencyDisplay, QuantityDisplay } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { FilterSelect } from '@/components/shared/search-input';
import { InlineError, EmptyState } from '@/components/ui/states';
import { formatDateTime, formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { invalidateForResource, queryKeys } from '@/lib/query-keys';
import { saleStatus, type Sale } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

import { RecordSalePanel } from './record-sale-form';

/**
 * Sales (PROMPT.md §31 step 14).
 *
 * doc 03 §61 — a voided sale keeps its history and generates an inventory
 * correction; it is never deleted. A voided row is therefore shown struck
 * through rather than removed.
 */
export function SalesPage() {
  const { user } = useAuth();
  const { activeBranchIds } = useBranchContext();
  const canView = can(user?.role, 'sales.view');
  const canVoid = can(user?.role, 'sales.void');

  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const [page, setPage] = useState(1);
  const [fuelFilter, setFuelFilter] = useState('');
  const [voiding, setVoiding] = useState<Sale | null>(null);

  const filters: SalesFilters = {
    page,
    limit: 20,
    branchId,
    fuelTypeId: fuelFilter || undefined,
  };

  const listQuery = useQuery({
    queryKey: queryKeys.sales.list(filters),
    queryFn: () => listSales(filters),
  });

  const fuelTypesQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ activeOnly: true }),
    queryFn: () => listFuelTypes({ limit: 100, status: 'ACTIVE' }),
  });

  const fuelCode = (id: string) => fuelTypesQuery.data?.data.find((f) => f.id === id)?.code ?? '—';

  const columns: Column<Sale>[] = [
    {
      key: 'saleNumber',
      header: 'Sale',
      primary: true,
      render: (r) => (
        <span
          className={
            r.voidedAt ? 'font-mono text-neutral-400 line-through' : 'font-mono font-semibold'
          }
        >
          {r.saleNumber}
        </span>
      ),
    },
    {
      key: 'fuelType',
      header: 'Fuel',
      secondary: true,
      render: (r) => (
        <span className="font-mono text-xs">{r.fuelTypeName ?? fuelCode(r.fuelTypeId)}</span>
      ),
    },
    {
      key: 'litresSold',
      header: 'Litres',
      align: 'right',
      render: (r) => <QuantityDisplay value={r.litresSold} />,
    },
    {
      key: 'unitPrice',
      header: 'Price/L',
      align: 'right',
      render: (r) => <CurrencyDisplay value={r.unitPrice} />,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      align: 'right',
      render: (r) => (
        <span className={r.voidedAt ? 'text-neutral-400 line-through' : 'font-semibold'}>
          <CurrencyDisplay value={r.totalAmount} />
        </span>
      ),
    },
    {
      key: 'soldAt',
      header: 'Sold at',
      mobileHidden: true,
      render: (r) => formatDateTime(r.soldAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const status = saleStatus(r);
        return (
          <Badge tone={status === 'VOIDED' ? 'danger' : 'success'}>
            {status === 'VOIDED' ? 'Voided' : 'Recorded'}
          </Badge>
        );
      },
    },
  ];

  const sales = listQuery.data?.data ?? [];

  // Product decision: only managers record sales, so the admin view has no
  // Sales tab. A direct URL still answers with an explanatory empty state
  // instead of the ledger.
  if (!canView) {
    return (
      <EmptyState
        title="Sales are recorded by managers"
        description="Branch managers send the day's total litres sold from their own account, so the Sales page is not part of the admin view."
        icon={ShoppingCart}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Sales</h1>
        <p className="text-sm text-neutral-500">
          Every recorded sale. Prices are snapshotted at the time of sale.
        </p>
      </header>

      <RecordSalePanel />

      <div className="flex flex-col gap-3 sm:flex-row">
        <FilterSelect
          className="sm:w-48"
          label="Filter by fuel type"
          value={fuelFilter}
          onChange={(value) => {
            setFuelFilter(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All fuel types' },
            ...(fuelTypesQuery.data?.data ?? []).map((f) => ({ value: f.id, label: f.code })),
          ]}
        />
      </div>

      <DataTable
        caption="Sales"
        columns={columns}
        data={sales}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading sales"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        emptyTitle="No sales recorded"
        emptyDescription="Sales recorded for this branch will appear here."
        emptyIcon={ShoppingCart}
        onRowClick={canVoid ? (row) => !row.voidedAt && setVoiding(row) : undefined}
      />

      {canVoid ? (
        <p className="text-xs text-neutral-500">
          Select a sale to void it. Voiding keeps the record and reverses its inventory movement.
        </p>
      ) : null}

      <VoidSaleDialog sale={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------- void */

function VoidSaleDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => voidSale(sale!.id, reason.trim()),
    onSuccess: () => {
      for (const key of invalidateForResource('sales')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      setReason('');
      onClose();
    },
    onError: (err) => {
      setFormError(isApiError(err) ? err.message : 'Unable to void this sale.');
    },
  });

  return (
    <ConfirmDialog
      open={Boolean(sale)}
      onClose={() => {
        setFormError(null);
        onClose();
      }}
      onConfirm={() => {
        setFormError(null);
        mutation.mutate();
      }}
      title="Void this sale?"
      description={
        sale
          ? `${sale.saleNumber} will be marked void and ${formatLitres(sale.litresSold)} will be returned to inventory. The record is kept for audit.`
          : ''
      }
      confirmLabel="Void sale"
      loading={mutation.isPending}
    >
      <div className="space-y-3">
        {formError ? <InlineError message={formError} /> : null}
        <Textarea
          label="Reason"
          placeholder="Duplicate sale entry"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={mutation.isPending}
          required
        />
      </div>
    </ConfirmDialog>
  );
}

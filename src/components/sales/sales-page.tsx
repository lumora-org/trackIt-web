'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShoppingCart, XCircle } from 'lucide-react';
import { useState } from 'react';

import { isApiError } from '@/api/errors';
import { listFuelTypes } from '@/api/fuel-types.api';
import {
  approveSale,
  listSales,
  rejectSale,
  voidSale,
  type SalesFilters,
} from '@/api/sales.api';
import { CurrencyDisplay, QuantityDisplay } from '@/components/ui/amount';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog, Drawer } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { FilterSelect } from '@/components/shared/search-input';
import { InlineError } from '@/components/ui/states';
import { formatDateTime, formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { invalidateForResource, queryKeys } from '@/lib/query-keys';
import { saleStatus, type Sale, type SaleApprovalStatus } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

import { RecordSalePanel } from './record-sale-form';

/**
 * Sales (PROMPT.md §31 step 14).
 *
 * doc 03 §61 — a voided sale keeps its history and generates an inventory
 * correction; it is never deleted. A voided row is therefore shown struck
 * through rather than removed.
 *
 * Product decision (2026-10): managers record the day's figures and an admin
 * confirms each one, so this page is the manager's recording view and the
 * admin's review queue at once.
 */
export function SalesPage() {
  const { user } = useAuth();
  const { activeBranchIds } = useBranchContext();
  const canRecord = can(user?.role, 'sales.record');
  const canVoid = can(user?.role, 'sales.void');

  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const [page, setPage] = useState(1);
  const [fuelFilter, setFuelFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<SaleApprovalStatus | ''>('');
  const [reviewing, setReviewing] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState<Sale | null>(null);

  const filters: SalesFilters = {
    page,
    limit: 20,
    branchId,
    fuelTypeId: fuelFilter || undefined,
    approvalStatus: approvalFilter || undefined,
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
      key: 'recordMode',
      header: 'Type',
      mobileHidden: true,
      render: (r) => <StatusBadge domain="saleRecordMode" value={r.recordMode ?? 'SINGLE'} />,
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
        // Voided trumps everything; otherwise the approval gate is the
        // status that matters (legacy rows without a status read APPROVED).
        if (saleStatus(r) === 'VOIDED') return <Badge tone="danger">Voided</Badge>;
        return <StatusBadge domain="saleApproval" value={r.approvalStatus ?? 'APPROVED'} />;
      },
    },
  ];

  const sales = listQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Sales</h1>
        <p className="text-sm text-neutral-500">
          {canRecord
            ? 'The branch&rsquo;s day totals and every record behind them. Prices are snapshotted by the server.'
            : 'Every figure the branches record. Review what is pending, or void a confirmed sale to reverse it.'}
        </p>
      </header>

      {canRecord ? <RecordSalePanel /> : null}

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
        <FilterSelect
          className="sm:w-44"
          label="Filter by approval"
          value={approvalFilter}
          onChange={(value) => {
            setApprovalFilter(value as SaleApprovalStatus | '');
            setPage(1);
          }}
          options={[
            { value: '', label: 'All figures' },
            { value: 'PENDING', label: 'Pending review' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
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
        onRowClick={(row) => {
          if (row.voidedAt) return;
          // A figure that is awaiting review (or was refused) opens the
          // review sheet — admins act on it, managers read the verdict. A
          // confirmed figure opens the void dialog for those allowed to void.
          if ((row.approvalStatus ?? 'APPROVED') !== 'APPROVED') {
            setReviewing(row);
          } else if (canVoid) {
            setVoiding(row);
          }
        }}
      />

      {canVoid ? (
        <p className="text-xs text-neutral-500">
          Select a pending figure to review it, or a confirmed sale to void it. Voiding keeps the
          record and reverses its inventory movement.
        </p>
      ) : null}

      <ReviewSaleSheet sale={reviewing} onClose={() => setReviewing(null)} />
      <VoidSaleDialog sale={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

/* ------------------------------------------------------------- review */

/**
 * The approval gate's surface (product decision, 2026-10): an admin confirms
 * or refuses a manager-recorded figure here. Managers open the same sheet
 * read-only, to see why a figure was refused. Approval never changes the
 * figures — it is workflow state, so nothing recomputes.
 */
function ReviewSaleSheet({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canApprove = can(user?.role, 'sales.approve');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => {
    const keys = [...invalidateForResource('sales'), ...invalidateForResource('notifications')];
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const approve = useMutation({
    mutationFn: () => approveSale(sale!.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => {
      setActionError(isApiError(err) ? err.message : 'Unable to approve this sale.');
    },
  });

  const reject = useMutation({
    mutationFn: () => rejectSale(sale!.id, reason.trim()),
    onSuccess: () => {
      invalidate();
      setReason('');
      onClose();
    },
    onError: (err) => {
      setActionError(isApiError(err) ? err.message : 'Unable to reject this sale.');
    },
  });

  if (!sale) return null;

  const approval = sale.approvalStatus ?? 'APPROVED';

  return (
    <Drawer
      open
      onClose={() => {
        setActionError(null);
        onClose();
      }}
      title={`Review ${sale.saleNumber}`}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge domain="saleApproval" value={approval} />
          <StatusBadge domain="saleRecordMode" value={sale.recordMode ?? 'SINGLE'} />
          <span className="text-xs text-neutral-500">{formatDateTime(sale.soldAt)}</span>
        </div>

        <dl className="space-y-1.5 rounded-xl bg-neutral-50 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-neutral-500">Litres</dt>
            <dd className="text-sm font-medium text-neutral-900">
              <QuantityDisplay value={sale.litresSold} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-neutral-500">Price per litre</dt>
            <dd className="text-sm font-medium text-neutral-900">
              <CurrencyDisplay value={sale.unitPrice} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-neutral-500">Total</dt>
            <dd className="text-sm font-medium text-neutral-900">
              <CurrencyDisplay value={sale.totalAmount} />
            </dd>
          </div>
        </dl>

        {approval === 'REJECTED' && sale.rejectionReason ? (
          <p className="text-danger-700 rounded-xl bg-danger-50 px-3 py-2.5 text-sm">
            Rejected: {sale.rejectionReason}
          </p>
        ) : null}

        {actionError ? <InlineError message={actionError} /> : null}

        {canApprove && approval !== 'APPROVED' ? (
          <section className="space-y-3 border-t border-neutral-200 pt-4">
            <Button
              block
              loading={approve.isPending}
              loadingText="Approving"
              onClick={() => approve.mutate()}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {approval === 'REJECTED' ? 'Approve anyway' : 'Approve figure'}
            </Button>

            {approval === 'PENDING' ? (
              <div className="space-y-2">
                <Textarea
                  label="Reason for rejection"
                  placeholder="Figure does not match the pump reading"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={reject.isPending || approve.isPending}
                  required
                />
                <Button
                  block
                  variant="danger"
                  disabled={reason.trim().length < 3}
                  loading={reject.isPending}
                  loadingText="Rejecting"
                  onClick={() => reject.mutate()}
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  Reject figure
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {!canApprove && approval === 'PENDING' ? (
          <p className="text-xs text-neutral-500">
            An admin reviews this figure. Revise the total as the day goes on — a revision returns
            it to the review queue.
          </p>
        ) : null}
      </div>
    </Drawer>
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

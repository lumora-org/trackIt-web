'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import { listFuelTypes } from '@/api/fuel-types.api';
import {
  createFuelOrder,
  createFuelOrderSchema,
  listFuelOrders,
  type CreateFuelOrderInput,
} from '@/api/fuel-orders.api';
import { listBranches } from '@/api/branches.api';
import { listSuppliers } from '@/api/suppliers.api';
import { CurrencyDisplay } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FilterSelect } from '@/components/shared/search-input';
import { InlineError } from '@/components/ui/states';
import { formatDateTime, formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { FuelOrder, FuelOrderStatus } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';
import { StatusBadge } from '@/components/ui/badge';

import { FuelOrderDetailDrawer } from './fuel-order-detail-drawer';

/**
 * Fuel orders (PROMPT.md §31 step 11, §12).
 *
 * An order is a procurement commitment and never moves inventory (doc 09 §1), so
 * this screen deliberately shows no stock figures.
 */
export function FuelOrdersPage() {
  const { user } = useAuth();
  const { activeBranchIds } = useBranchContext();
  const canManage = can(user?.role, 'fuelOrder.manage');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // A manager is branch-scoped and must never see another branch's orders.
  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const listQuery = useQuery({
    queryKey: queryKeys.fuelOrders.list({ page, status: statusFilter, branchId }),
    queryFn: () =>
      listFuelOrders({
        page,
        limit: 20,
        status: (statusFilter || undefined) as FuelOrderStatus | undefined,
        branchId,
      }),
  });

  const columns: Column<FuelOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order',
      primary: true,
      render: (r) => <span className="font-mono font-semibold">{r.orderNumber}</span>,
    },
    { key: 'supplier', header: 'Supplier', secondary: true, render: (r) => r.supplier.name },
    {
      key: 'destinationBranch',
      header: 'Destination',
      render: (r) => r.destinationBranch.name,
    },
    {
      key: 'totalQuantity',
      header: 'Quantity',
      align: 'right',
      render: (r) => formatLitres(r.items.reduce((sum, i) => sum + i.expectedQuantityLitres, 0)),
    },
    {
      key: 'expectedDeliveryAt',
      header: 'Expected',
      mobileHidden: true,
      render: (r) => formatDateTime(r.expectedDeliveryAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge domain="fuelOrder" value={r.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Fuel Orders</h1>
          <p className="text-sm text-neutral-500">
            Procurement commitments. Stock only moves when a delivery is received.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New fuel order
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <FilterSelect
          className="sm:w-48"
          label="Filter by status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'SUBMITTED', label: 'Submitted' },
            { value: 'CONFIRMED', label: 'Confirmed' },
            { value: 'IN_TRANSIT', label: 'In transit' },
            { value: 'PARTIALLY_DELIVERED', label: 'Partially delivered' },
            { value: 'DELIVERED', label: 'Delivered' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
      </div>

      <DataTable
        caption="Fuel orders"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading fuel orders"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        emptyTitle="No fuel orders yet"
        emptyDescription={
          canManage
            ? 'Create a fuel order to commit to buying fuel from a supplier.'
            : 'No fuel orders have been raised for this branch yet.'
        }
        emptyIcon={ClipboardCheck}
        emptyAction={
          canManage ? { label: 'New fuel order', onClick: () => setCreateOpen(true) } : undefined
        }
        onRowClick={(row) => setSelectedOrderId(row.id)}
      />

      <FuelOrderDetailDrawer
        orderId={selectedOrderId}
        open={Boolean(selectedOrderId)}
        onClose={() => setSelectedOrderId(null)}
      />

      <CreateFuelOrderDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------- create dialog */

function CreateFuelOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const suppliersQuery = useQuery({
    queryKey: queryKeys.suppliers.list({ activeOnly: true }),
    queryFn: () => listSuppliers({ limit: 100, status: 'ACTIVE' }),
    enabled: open,
  });

  const branchesQuery = useQuery({
    queryKey: queryKeys.branches.list({ activeOnly: true }),
    queryFn: () => listBranches({ limit: 100, status: 'ACTIVE' }),
    enabled: open,
  });

  const fuelTypesQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ activeOnly: true }),
    queryFn: () => listFuelTypes({ limit: 100, status: 'ACTIVE' }),
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateFuelOrderInput>({
    resolver: zodResolver(createFuelOrderSchema),
    defaultValues: {
      supplierId: '',
      destinationBranchId: '',
      expectedDeliveryAt: '',
      notes: '',
      items: [{ fuelTypeId: '', expectedQuantityLitres: 0, unitCost: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const mutation = useMutation({
    mutationFn: createFuelOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelOrders.list() });
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        const supplierError = err.fieldError('supplierId');
        const branchError = err.fieldError('destinationBranchId');
        if (supplierError) setError('supplierId', { message: supplierError });
        if (branchError) setError('destinationBranchId', { message: branchError });
        setFormError(supplierError || branchError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  const fuelTypeOptions = (fuelTypesQuery.data?.data ?? []).map((f) => ({
    value: f.id,
    label: `${f.code} — ${f.name}`,
  }));

  const supplierOptions = (suppliersQuery.data?.data ?? []).map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const branchOptions = (branchesQuery.data?.data ?? []).map((b) => ({
    value: b.id,
    label: `${b.name} (${b.code})`,
  }));

  // doc 09 §14 — an estimated procurement value is illustrative only. There is no
  // order-total column anywhere in doc 03, so nothing is stored or displayed as
  // authoritative.
  const estimate = (items ?? []).reduce(
    (sum, item) => sum + (item.expectedQuantityLitres || 0) * (item.unitCost || 0),
    0,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New fuel order"
      description="The order is created as a draft. Submit it when it is ready."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            loadingText="Creating order"
          >
            Create draft order
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
        {formError ? <InlineError message={formError} /> : null}

        <Select
          label="Supplier"
          placeholder="Select a supplier"
          options={supplierOptions}
          error={errors.supplierId?.message}
          disabled={mutation.isPending}
          {...register('supplierId')}
        />

        <Select
          label="Destination branch"
          placeholder="Select a branch"
          options={branchOptions}
          error={errors.destinationBranchId?.message}
          disabled={mutation.isPending}
          {...register('destinationBranchId')}
        />

        <Input
          label="Expected delivery date"
          type="datetime-local"
          error={errors.expectedDeliveryAt?.message}
          disabled={mutation.isPending}
          {...register('expectedDeliveryAt')}
        />

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ fuelTypeId: '', expectedQuantityLitres: 0, unitCost: 0 })}
              disabled={mutation.isPending}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add item
            </Button>
          </CardHeader>
          <CardBody className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-3 rounded-xl bg-neutral-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-700">Item {index + 1}</p>
                  {fields.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={mutation.isPending}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 className="text-danger-500 size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>

                <Select
                  label="Fuel"
                  placeholder="Select a fuel type"
                  options={fuelTypeOptions}
                  error={errors.items?.[index]?.fuelTypeId?.message}
                  disabled={mutation.isPending}
                  {...register(`items.${index}.fuelTypeId`)}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Expected quantity (L)"
                    type="number"
                    inputMode="numeric"
                    step="0.001"
                    min="0"
                    placeholder="45000"
                    error={errors.items?.[index]?.expectedQuantityLitres?.message}
                    disabled={mutation.isPending}
                    {...register(`items.${index}.expectedQuantityLitres`, {
                      valueAsNumber: true,
                    })}
                  />
                  <Input
                    label="Unit cost"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="1200.00"
                    description="Procurement cost, not the retail price."
                    error={errors.items?.[index]?.unitCost?.message}
                    disabled={mutation.isPending}
                    {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                  />
                </div>
              </div>
            ))}

            {typeof errors.items?.message === 'string' ? (
              <InlineError message={errors.items.message} />
            ) : null}

            {estimate > 0 ? (
              <p className="rounded-xl bg-neutral-100 px-3 py-2.5 text-sm text-neutral-700">
                Estimated procurement value:{' '}
                <span className="font-semibold">
                  <CurrencyDisplay value={estimate} />
                </span>
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Textarea
          label="Notes"
          placeholder="Morning delivery"
          error={errors.notes?.message}
          disabled={mutation.isPending}
          {...register('notes')}
        />
      </form>
    </Dialog>
  );
}

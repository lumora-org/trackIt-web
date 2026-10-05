'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Truck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import {
  createTanker,
  listTankers,
  tankerSchema,
  updateTanker,
  type TankerInput,
} from '@/api/tankers.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';
import { CrudPage, STATUS_FILTER_OPTIONS, useCrudListState } from '@/components/shared/crud-page';
import { FilterSelect } from '@/components/shared/search-input';
import { formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { Tanker } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';

/**
 * Tankers (PROMPT.md §31 step 10).
 *
 * doc 09 §5 — a delivery is assigned to one tanker, so this list is also the
 * picker when creating a delivery. doc 03 §36 constrains registration number to
 * be unique per business and capacity to be greater than zero.
 */
export function TankersPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'tanker.manage');
  const { page, search, status, setPage, setSearch, setStatus } = useCrudListState();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tanker | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.tankers.list({ page, search, status }),
    queryFn: () => listTankers({ page, limit: 20, search: search || undefined, status }),
  });

  const columns: Column<Tanker>[] = [
    {
      key: 'registrationNumber',
      header: 'Registration',
      primary: true,
      render: (r) => <span className="font-mono font-semibold">{r.registrationNumber}</span>,
    },
    {
      key: 'tankerCode',
      header: 'Code',
      render: (r) => <span className="font-mono text-xs">{r.tankerCode ?? '—'}</span>,
    },
    {
      key: 'capacityLitres',
      header: 'Capacity',
      align: 'right',
      render: (r) => formatLitres(r.capacityLitres),
    },
    {
      key: 'driverName',
      header: 'Driver',
      secondary: true,
      render: (r) => r.driverName ?? '—',
    },
    {
      key: 'driverPhone',
      header: 'Driver phone',
      mobileHidden: true,
      render: (r) => r.driverPhone ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge
          tone={r.status === 'ACTIVE' ? 'success' : r.status === 'SUSPENDED' ? 'danger' : 'neutral'}
        >
          {r.status}
        </Badge>
      ),
    },
  ];

  return (
    <CrudPage<Tanker>
      title="Tankers"
      description="Tanker fleet used to deliver fuel to your branches."
      icon={Truck}
      columns={columns}
      rows={listQuery.data?.data ?? []}
      rowKey={(r) => r.id}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by registration, code or driver"
      loading={listQuery.isLoading}
      loadingLabel="Loading tankers"
      error={listQuery.error?.message ?? null}
      onRetry={() => listQuery.refetch()}
      meta={listQuery.data?.meta ?? null}
      onPageChange={setPage}
      canManage={canManage}
      onCreate={() => {
        setEditing(null);
        setFormOpen(true);
      }}
      createLabel="Add tanker"
      emptyTitle="No tankers yet"
      emptyDescription={
        canManage
          ? 'Add a tanker so deliveries can be assigned to it.'
          : 'No tankers have been added for this business yet.'
      }
      toolbar={
        <FilterSelect
          className="sm:w-44"
          label="Filter by status"
          value={status ?? ''}
          onChange={setStatus}
          options={STATUS_FILTER_OPTIONS}
        />
      }
      onRowClick={
        canManage
          ? (row) => {
              setEditing(row);
              setFormOpen(true);
            }
          : undefined
      }
      dialog={
        <TankerFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          tanker={editing}
        />
      }
    />
  );
}

function TankerFormDialog({
  open,
  onClose,
  tanker,
}: {
  open: boolean;
  onClose: () => void;
  tanker: Tanker | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(tanker);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TankerInput>({
    resolver: zodResolver(tankerSchema),
    values: tanker
      ? {
          registrationNumber: tanker.registrationNumber,
          tankerCode: tanker.tankerCode ?? '',
          capacityLitres: tanker.capacityLitres,
          driverName: tanker.driverName ?? '',
          driverPhone: tanker.driverPhone ?? '',
        }
      : {
          registrationNumber: '',
          tankerCode: '',
          // 0 rather than undefined so the value stays a number; the schema's
          // positive() check turns this into a clear validation message.
          capacityLitres: 0,
          driverName: '',
          driverPhone: '',
        },
  });

  const mutation = useMutation({
    mutationFn: (values: TankerInput) =>
      isEdit && tanker ? updateTanker(tanker.id, values) : createTanker(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tankers.list() });
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        // doc 03 §36 — UNIQUE (business_id, registration_number) surfaces as 409.
        const regError = err.fieldError('registrationNumber');
        const capacityError = err.fieldError('capacityLitres');
        if (regError) setError('registrationNumber', { message: regError });
        if (capacityError) setError('capacityLitres', { message: capacityError });
        setFormError(regError || capacityError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${tanker?.registrationNumber}` : 'Add tanker'}
      description="The registration number must be unique within your business."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            loadingText="Saving"
          >
            {isEdit ? (
              <>
                <Pencil className="size-4" aria-hidden="true" />
                Save changes
              </>
            ) : (
              'Save tanker'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Input
          label="Registration number"
          placeholder="ABC-123-LA"
          error={errors.registrationNumber?.message}
          disabled={mutation.isPending}
          className="font-mono"
          {...register('registrationNumber')}
        />

        <Input
          label="Tanker code"
          placeholder="TANK-001"
          description="Optional internal identifier."
          error={errors.tankerCode?.message}
          disabled={mutation.isPending}
          className="font-mono"
          {...register('tankerCode')}
        />

        <Input
          label="Capacity"
          type="number"
          inputMode="numeric"
          step="0.001"
          min="1"
          placeholder="45000"
          description="Litres. Must be greater than zero."
          error={errors.capacityLitres?.message}
          disabled={mutation.isPending}
          {...register('capacityLitres', { valueAsNumber: true })}
        />

        <Input
          label="Driver name"
          placeholder="John Driver"
          error={errors.driverName?.message}
          disabled={mutation.isPending}
          {...register('driverName')}
        />

        <Input
          label="Driver phone"
          type="tel"
          inputMode="tel"
          placeholder="+2348044444444"
          error={errors.driverPhone?.message}
          disabled={mutation.isPending}
          {...register('driverPhone')}
        />
      </div>
    </Dialog>
  );
}

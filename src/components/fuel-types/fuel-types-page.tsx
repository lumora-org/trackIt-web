'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Fuel, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  createFuelType,
  createFuelTypeSchema,
  listFuelTypes,
  updateFuelType,
  type CreateFuelTypeInput,
} from '@/api/fuel-types.api';
import { isApiError } from '@/api/errors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { can } from '@/lib/permissions';
import type { FuelType } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';

import { SearchInput } from '@/components/shared/search-input';

/**
 * Fuel types (PROMPT.md §31 step 7, §16).
 *
 * doc 08 §3 — PMS/AGO/DPK must NOT be hard-coded into business logic; they are
 * database records. This screen therefore reads everything from the API.
 */
export function FuelTypesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can(user?.role, 'fuelType.manage');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FuelType | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ page, search }),
    queryFn: () => listFuelTypes({ page, limit: 20, search: search || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.fuelTypes.list() });

  const columns: Column<FuelType>[] = [
    {
      key: 'code',
      header: 'Code',
      primary: true,
      render: (row) => <span className="font-mono font-semibold">{row.code}</span>,
    },
    { key: 'name', header: 'Name', render: (row) => row.name },
    {
      key: 'description',
      header: 'Description',
      secondary: true,
      mobileHidden: true,
      render: (row) => row.description ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</Badge>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      align: 'right',
      mobileHidden: true,
      render: (row) => formatDate((row as FuelType & { createdAt?: string }).createdAt),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Fuel Types</h1>
          <p className="text-sm text-neutral-500">
            The products this business sells. Managers need these to record sales.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add fuel type
          </Button>
        ) : null}
      </header>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search by code or name"
        label="Search fuel types"
      />

      <DataTable
        caption="Fuel types"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading fuel types"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        emptyTitle="No fuel types yet"
        emptyDescription={
          canManage
            ? 'Add your first fuel type so sales and deliveries can be recorded.'
            : 'No fuel types have been configured for this business yet.'
        }
        emptyAction={
          canManage ? { label: 'Add fuel type', onClick: () => setFormOpen(true) } : undefined
        }
      />

      <FuelTypeFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        fuelType={editing}
        onSaved={invalidate}
      />
    </div>
  );
}

/* --------------------------------------------------------------- form */

function FuelTypeFormDialog({
  open,
  onClose,
  fuelType,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  fuelType: FuelType | null;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(fuelType);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateFuelTypeInput>({
    resolver: zodResolver(createFuelTypeSchema),
    defaultValues: { name: '', code: '', description: '' },
  });

  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (values: CreateFuelTypeInput) =>
      isEdit && fuelType
        ? updateFuelType(fuelType.id, {
            name: values.name,
            description: values.description ? values.description : null,
          })
        : createFuelType(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelTypes.list() });
      onSaved();
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        const nameError = err.fieldError('name');
        const codeError = err.fieldError('code');
        if (nameError) setError('name', { message: nameError });
        if (codeError) setError('code', { message: codeError });
        setFormError(nameError || codeError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${fuelType?.code}` : 'Add fuel type'}
      description={
        isEdit
          ? 'The code cannot be changed after creation.'
          : 'Codes are unique within your business and cannot be changed later.'
      }
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
              <>
                <Check className="size-4" aria-hidden="true" />
                Create fuel type
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Input
          label="Name"
          placeholder="Premium Motor Spirit"
          error={errors.name?.message}
          disabled={mutation.isPending}
          {...register('name')}
        />

        <Input
          label="Code"
          placeholder="PMS"
          description="Letters, numbers, hyphens and underscores. Uppercase only."
          error={errors.code?.message}
          disabled={mutation.isPending || isEdit}
          className="font-mono uppercase"
          {...register('code')}
        />

        {isEdit ? (
          <p className="rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
            <Fuel className="mr-1 inline size-3.5" aria-hidden="true" />
            The code is immutable (doc 08 §13). Create a new fuel type instead.
          </p>
        ) : null}

        <Textarea
          label="Description"
          placeholder="Petrol"
          error={errors.description?.message}
          disabled={mutation.isPending}
          {...register('description')}
        />
      </div>
    </Dialog>
  );
}

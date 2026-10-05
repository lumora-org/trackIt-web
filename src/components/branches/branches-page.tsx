'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isApiError } from '@/api/errors';
import { createBranch, listBranches, updateBranch } from '@/api/branches.api';
import { PHONE_PATTERN } from '@/api/suppliers.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { FilterSelect, SearchInput } from '@/components/shared/search-input';
import { InlineError } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import type { Branch, BranchStatus } from '@/types/domain';

/**
 * doc 03 §27 — `address` is NOT NULL, `phone` is nullable, and `code` is unique
 * per business. doc 01 §20 also lists "Manager" and "Opening date", but no such
 * columns exist, so they are not offered (ASSUMPTIONS.md §3.5).
 */
const branchFormSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required').max(255),
  code: z.string().trim().min(1, 'Branch code is required').max(50),
  address: z.string().trim().min(1, 'Address is required'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid phone number')
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

/**
 * Branches (doc 04 §21–24, doc 03 §27).
 *
 * doc 03 §27 marks `address` NOT NULL, so it is required here. doc 04 §24 has no
 * `/status` sub-resource, so a status change goes through the branch's own PATCH
 * (ASSUMPTIONS.md §2.9). Manager and opening date are deliberately absent: the PRD
 * lists them but no column exists (ASSUMPTIONS.md §3.5).
 */
export function BranchesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | BranchStatus>('');
  const [editing, setEditing] = useState<Branch | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: queryKeys.branches.list({ search, status: statusFilter }),
    queryFn: () =>
      listBranches({
        limit: 100,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      header: 'Branch',
      primary: true,
      render: (b) => <span className="font-semibold">{b.name}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      render: (b) => <span className="font-mono text-xs">{b.code}</span>,
    },
    { key: 'address', header: 'Address', secondary: true, render: (b) => b.address },
    { key: 'phone', header: 'Phone', mobileHidden: true, render: (b) => b.phone ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <Badge tone={b.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
          {b.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Branches</h1>
          <p className="text-sm text-neutral-500">
            Stations belonging to this business. Each has its own inventory.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add branch
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search by name or code"
          label="Search branches"
        />
        <FilterSelect
          className="sm:w-44"
          label="Filter by status"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as '' | BranchStatus)}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
      </div>

      <DataTable
        caption="Branches"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(b) => b.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading branches"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        onRowClick={(b) => {
          setEditing(b);
          setFormOpen(true);
        }}
        emptyTitle="No branches yet"
        emptyDescription="Add your first station to start recording inventory and sales."
        emptyIcon={Building2}
      />

      <BranchFormDialog
        open={formOpen}
        branch={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function BranchFormDialog({
  open,
  branch,
  onClose,
}: {
  open: boolean;
  branch: Branch | null;
  onClose: () => void;
}) {
  const isEdit = Boolean(branch);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    values: branch
      ? {
          name: branch.name,
          code: branch.code,
          address: branch.address,
          phone: branch.phone ?? '',
        }
      : { name: '', code: '', address: '', phone: '' },
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: BranchFormValues) =>
      isEdit && branch
        ? updateBranch(branch.id, {
            name: values.name,
            code: values.code,
            address: values.address,
            phone: values.phone || undefined,
            ...(values.status ? { status: values.status } : {}),
          })
        : createBranch({
            name: values.name,
            code: values.code,
            address: values.address,
            phone: values.phone || undefined,
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.admin() });
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        // doc 03 §27 — UNIQUE (business_id, code).
        const codeError = err.fieldError('code');
        if (codeError) setError('code', { message: codeError });
        setFormError(codeError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${branch?.name}` : 'Add branch'}
      description="The branch code must be unique within your business."
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
            Save branch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Input
          label="Branch name"
          placeholder="KBY Ikeja"
          error={errors.name?.message}
          disabled={mutation.isPending}
          {...register('name')}
        />

        <Input
          label="Branch code"
          placeholder="KBY-IKEJA"
          description="Short identifier used in orders and reports."
          error={errors.code?.message}
          disabled={mutation.isPending}
          className="font-mono"
          {...register('code')}
        />

        {/* doc 03 §27 — address is NOT NULL. */}
        <Input
          label="Address"
          placeholder="Obafemi Awolowo Way, Ikeja, Lagos"
          error={errors.address?.message}
          disabled={mutation.isPending}
          {...register('address')}
        />

        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          error={errors.phone?.message}
          disabled={mutation.isPending}
          {...register('phone')}
        />

        {isEdit ? (
          <Select
            label="Status"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
            defaultValue={branch?.status ?? 'ACTIVE'}
            disabled={mutation.isPending}
            {...register('status')}
          />
        ) : null}
      </div>
    </Dialog>
  );
}

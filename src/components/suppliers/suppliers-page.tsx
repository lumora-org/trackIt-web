'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import {
  createSupplier,
  listSuppliers,
  supplierSchema,
  updateSupplier,
  type SupplierInput,
} from '@/api/suppliers.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';
import { CrudPage, STATUS_FILTER_OPTIONS, useCrudListState } from '@/components/shared/crud-page';
import { FilterSelect } from '@/components/shared/search-input';
import type { Column } from '@/components/ui/data-table';
import type { Supplier } from '@/types/domain';
import { can } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/**
 * Suppliers (PROMPT.md §31 step 9).
 *
 * doc 09 §4 — suppliers are business-scoped, so the client never sends a
 * businessId (doc 04 §92). doc 09 §3 also requires soft deletion, so no delete
 * button is offered; status is changed through the resource's own PATCH.
 */
export function SuppliersPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'supplier.manage');
  const { page, search, status, setPage, setSearch, setStatus } = useCrudListState();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.suppliers.list({ page, search, status }),
    queryFn: () => listSuppliers({ page, limit: 20, search: search || undefined, status }),
  });

  const columns: Column<Supplier>[] = [
    { key: 'name', header: 'Supplier', primary: true, render: (r) => r.name },
    {
      key: 'code',
      header: 'Code',
      render: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    {
      key: 'contactPerson',
      header: 'Contact',
      secondary: true,
      render: (r) => r.contactPerson ?? '—',
    },
    { key: 'phone', header: 'Phone', mobileHidden: true, render: (r) => r.phone ?? '—' },
    { key: 'email', header: 'Email', mobileHidden: true, render: (r) => r.email ?? '—' },
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
    <CrudPage<Supplier>
      title="Suppliers"
      description="Companies that supply fuel to this business."
      icon={Building2}
      columns={columns}
      rows={listQuery.data?.data ?? []}
      rowKey={(r) => r.id}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by name, code or email"
      loading={listQuery.isLoading}
      loadingLabel="Loading suppliers"
      error={listQuery.error?.message ?? null}
      onRetry={() => listQuery.refetch()}
      meta={listQuery.data?.meta ?? null}
      onPageChange={setPage}
      canManage={canManage}
      onCreate={() => {
        setEditing(null);
        setFormOpen(true);
      }}
      createLabel="Add supplier"
      emptyTitle="No suppliers yet"
      emptyDescription={
        canManage
          ? 'Add a supplier so you can raise fuel orders against them.'
          : 'No suppliers have been added for this business yet.'
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
        <SupplierFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          supplier={editing}
        />
      }
    />
  );
}

function SupplierFormDialog({
  open,
  onClose,
  supplier,
}: {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(supplier);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SupplierInput>({
    resolver: zodResolver(supplierSchema),
    values: supplier
      ? {
          name: supplier.name,
          code: supplier.code,
          contactPerson: supplier.contactPerson ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          address: supplier.address ?? '',
        }
      : { name: '', code: '', contactPerson: '', phone: '', email: '', address: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: SupplierInput) =>
      isEdit && supplier ? updateSupplier(supplier.id, values) : createSupplier(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelOrders.list() });
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        // doc 03 §34 — UNIQUE (business_id, code) surfaces as 409.
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
      title={isEdit ? `Edit ${supplier?.name}` : 'Add supplier'}
      description="Suppliers are business-scoped. Records are never hard-deleted."
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
              'Save supplier'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Input
          label="Supplier name"
          placeholder="NNPC Mega Depot"
          error={errors.name?.message}
          disabled={mutation.isPending}
          {...register('name')}
        />

        <Input
          label="Code"
          placeholder="SUP-001"
          description="Unique within your business."
          error={errors.code?.message}
          disabled={mutation.isPending}
          className="font-mono"
          {...register('code')}
        />

        <Input
          label="Contact person"
          placeholder="Aliyu Mohammed"
          error={errors.contactPerson?.message}
          disabled={mutation.isPending}
          {...register('contactPerson')}
        />

        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          placeholder="+2348011111111"
          error={errors.phone?.message}
          disabled={mutation.isPending}
          {...register('phone')}
        />

        <Input
          label="Email"
          type="email"
          inputMode="email"
          placeholder="orders@supplier.example"
          error={errors.email?.message}
          disabled={mutation.isPending}
          {...register('email')}
        />

        <Textarea
          label="Address"
          placeholder="Egbin, Lagos"
          error={errors.address?.message}
          disabled={mutation.isPending}
          {...register('address')}
        />
      </div>
    </Dialog>
  );
}

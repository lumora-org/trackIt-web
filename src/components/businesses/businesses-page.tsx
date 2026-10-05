'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import {
  createBusiness,
  createBusinessSchema,
  listBusinesses,
  type CreateBusinessInput,
} from '@/api/businesses.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import type { Business } from '@/types/domain';

/**
 * Businesses (doc 04 §20).
 *
 * SUPER_ADMIN only — an administrator manages their own business and cannot see
 * this list, so the screen states that plainly rather than rendering an
 * unexplained 403.
 */
export function BusinessesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: queryKeys.businesses.list(),
    queryFn: () => listBusinesses(),
  });

  const columns: Column<Business>[] = [
    {
      key: 'name',
      header: 'Business',
      primary: true,
      render: (b) => <span className="font-semibold">{b.name}</span>,
    },
    {
      key: 'registrationNumber',
      header: 'Registration',
      secondary: true,
      render: (b) => b.registrationNumber ?? '—',
    },
    { key: 'email', header: 'Email', render: (b) => b.email ?? '—' },
    { key: 'phone', header: 'Phone', mobileHidden: true, render: (b) => b.phone ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <Badge
          tone={b.status === 'ACTIVE' ? 'success' : b.status === 'SUSPENDED' ? 'danger' : 'neutral'}
          size="sm"
        >
          {b.status}
        </Badge>
      ),
    },
  ];

  if (listQuery.isError) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-neutral-900">Businesses</h1>
        <p className="rounded-card border border-neutral-200 bg-surface p-6 text-center text-sm text-neutral-600">
          Only a super administrator can view the business list. Sign in with a super administrator
          account to manage businesses on the platform.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Businesses</h1>
          <p className="text-sm text-neutral-500">Every business operating on the platform.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add business
        </Button>
      </header>

      <DataTable
        caption="Businesses"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(b) => b.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading businesses"
        error={errorMessage(listQuery.error)}
        onRetry={() => listQuery.refetch()}
        emptyTitle="No businesses yet"
        emptyDescription="Add the first business to start onboarding administrators."
        emptyIcon={Building2}
      />

      <CreateBusinessDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateBusinessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: { name: '', registrationNumber: '', email: '', phone: '', address: '' },
  });

  const mutation = useMutation({
    mutationFn: createBusiness,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.businesses.list() });
      onClose();
      reset();
    },
    onError: (err) => {
      setFormError(isApiError(err) ? err.message : 'Unable to create the business.');
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add business"
      description="Create the tenant that will own branches, users and fuel data."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            loadingText="Creating"
          >
            Create business
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Input
          label="Business name"
          placeholder="K.B.Y GLOBAL INVESTMENT"
          error={errors.name?.message}
          disabled={mutation.isPending}
          {...register('name')}
        />

        <Input
          label="Registration number"
          placeholder="RC123456"
          error={errors.registrationNumber?.message}
          disabled={mutation.isPending}
          {...register('registrationNumber')}
        />

        <Input
          label="Email"
          type="email"
          inputMode="email"
          error={errors.email?.message}
          disabled={mutation.isPending}
          {...register('email')}
        />

        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          error={errors.phone?.message}
          disabled={mutation.isPending}
          {...register('phone')}
        />

        <Textarea
          label="Address"
          placeholder="Lagos, Nigeria"
          error={errors.address?.message}
          disabled={mutation.isPending}
          {...register('address')}
        />
      </div>
    </Dialog>
  );
}

/** Normalises an unknown query error into displayable text (PROMPT.md §20). */
function errorMessage(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : null;
}

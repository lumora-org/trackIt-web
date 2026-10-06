'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, InlineError, SkeletonCard } from '@/components/ui/states';
import { queryKeys } from '@/lib/query-keys';
import type { Business } from '@/types/domain';

/**
 * Businesses (doc 04 §20).
 *
 * SUPER_ADMIN only — an administrator manages their own business and cannot see
 * this list, so the screen states that plainly rather than rendering an
 * unexplained 403. Businesses render as a card grid; opening a card shows the
 * business's branches, users and configuration.
 */
export function BusinessesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();

  const listQuery = useQuery({
    queryKey: queryKeys.businesses.list(),
    queryFn: () => listBusinesses(),
  });

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

  const businesses = listQuery.data?.data ?? [];

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

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Add the first business to start onboarding administrators."
          icon={Building2}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onOpen={() => router.push(`/businesses/${business.id}`)}
            />
          ))}
        </div>
      )}

      <CreateBusinessDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function BusinessCard({ business, onOpen }: { business: Business; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-card focus-visible:outline-brand-600 flex h-full flex-col border border-neutral-200 bg-surface p-4 text-left shadow-xs transition-colors hover:border-brand-500/50 focus-visible:outline-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-brand-50 text-brand-700 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900">{business.name}</p>
            <p className="truncate text-xs text-neutral-500">
              {business.registrationNumber ?? 'No registration number'}
            </p>
          </div>
        </div>
        <Badge
          tone={
            business.status === 'ACTIVE'
              ? 'success'
              : business.status === 'SUSPENDED'
                ? 'danger'
                : 'neutral'
          }
          size="sm"
        >
          {business.status}
        </Badge>
      </div>

      <dl className="mt-4 space-y-1 text-sm text-neutral-600">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-neutral-500">Email</dt>
          <dd className="truncate">{business.email ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-neutral-500">Phone</dt>
          <dd>{business.phone ?? '—'}</dd>
        </div>
      </dl>

      <span className="text-brand-700 mt-4 flex items-center gap-1 text-xs font-semibold">
        View business
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </span>
    </button>
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

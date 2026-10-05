'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import {
  createUser,
  createUserSchema,
  listUsers,
  ROLE_FILTER_OPTIONS,
  setUserStatus,
  type CreateUserInput,
  type UserFilters,
} from '@/api/users.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { SearchInput, FilterSelect } from '@/components/shared/search-input';
import { InlineError } from '@/components/ui/states';
import { ROLE_LABELS } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { User, UserRole } from '@/types/domain';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Users (doc 04 §17–19, doc 07 §56–58).
 *
 * doc 07 §57 — an ADMIN manages MANAGERs, never other admins. The create form
 * therefore only offers ADMIN or MANAGER, and a MANAGER requires a branch while
 * an ADMIN must not have one (doc 03 §22). Both rules are enforced in the schema
 * so the impossible combinations are unselectable.
 */
export function UsersPage() {
  const { branches } = useBranchContext();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<User | null>(null);

  const filters: UserFilters = {
    page,
    limit: 20,
    search: search || undefined,
    role: (roleFilter || undefined) as UserRole | undefined,
  };

  const listQuery = useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => listUsers(filters),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      setUserStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
      setStatusTarget(null);
    },
  });
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      render: (u) => (
        <span className="font-medium">
          {u.firstName} {u.lastName}
        </span>
      ),
    },
    { key: 'email', header: 'Email', secondary: true, render: (u) => u.email },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <Badge tone={u.role === 'SUPER_ADMIN' ? 'brand' : 'info'} size="sm">
          {ROLE_LABELS[u.role]}
        </Badge>
      ),
    },
    { key: 'branchId', header: 'Branch', render: (u) => branchName(u.branchId) },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <Badge
          tone={u.status === 'ACTIVE' ? 'success' : u.status === 'SUSPENDED' ? 'danger' : 'neutral'}
          size="sm"
        >
          {u.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      mobileHidden: true,
      render: (u) =>
        u.status === 'ACTIVE' ? (
          <Button variant="ghost" size="sm" onClick={() => setStatusTarget(u)}>
            Deactivate
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => statusMutation.mutate({ id: u.id, status: 'ACTIVE' })}
          >
            Activate
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Users</h1>
          <p className="text-sm text-neutral-500">
            Administrators and branch managers. Users are deactivated, never deleted.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          Add user
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name or email"
          label="Search users"
        />
        <FilterSelect
          className="sm:w-48"
          label="Filter by role"
          value={roleFilter}
          onChange={(value) => {
            setRoleFilter(value);
            setPage(1);
          }}
          options={ROLE_FILTER_OPTIONS}
        />
      </div>

      <DataTable
        caption="Users"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(u) => u.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading users"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        emptyTitle="No users found"
        emptyDescription="Add a manager to give them access to a branch."
        emptyIcon={Users}
      />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        branches={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={() =>
          statusTarget && statusMutation.mutate({ id: statusTarget.id, status: 'INACTIVE' })
        }
        title="Deactivate this user?"
        description={
          statusTarget
            ? `${statusTarget.firstName} ${statusTarget.lastName} will no longer be able to sign in. Their history is kept.`
            : ''
        }
        confirmLabel="Deactivate"
        loading={statusMutation.isPending}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onClose,
  branches,
}: {
  open: boolean;
  onClose: () => void;
  branches: ReadonlyArray<{ value: string; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'MANAGER', password: '', confirmPassword: '' },
  });

  const role = watch('role');

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        const emailError = err.fieldError('email');
        const roleError = err.fieldError('role');
        const branchError = err.fieldError('branchId');
        if (emailError) setError('email', { message: emailError });
        if (roleError) setError('role', { message: roleError });
        if (branchError) setError('branchId', { message: branchError });
        setFormError(emailError || roleError || branchError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add user"
      description="The user is created inside your own business."
      size="lg"
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
            Create user
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            error={errors.firstName?.message}
            disabled={mutation.isPending}
            {...register('firstName')}
          />
          <Input
            label="Last name"
            error={errors.lastName?.message}
            disabled={mutation.isPending}
            {...register('lastName')}
          />
        </div>

        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
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

        <Select
          label="Role"
          options={[
            // doc 07 §57 — an admin creates managers, not other admins.
            { value: 'MANAGER', label: 'Manager (branch-scoped)' },
            { value: 'ADMIN', label: 'Administrator (business-wide)' },
          ]}
          error={errors.role?.message}
          disabled={mutation.isPending}
          onChange={(e) => {
            setValue('role', e.target.value as 'ADMIN' | 'MANAGER');
            // A manager needs a branch; an admin must not have one.
            setValue('branchId', e.target.value === 'MANAGER' ? (watch('branchId') ?? '') : '');
          }}
          value={role}
        />

        {/* doc 03 §22 — branchId is required for MANAGER and forbidden for ADMIN. */}
        {role === 'MANAGER' ? (
          <Select
            label="Branch"
            placeholder="Select a branch"
            options={branches}
            error={errors.branchId?.message}
            disabled={mutation.isPending}
            {...register('branchId')}
          />
        ) : null}

        <Input
          label="Temporary password"
          type="password"
          autoComplete="new-password"
          description="Must be at least 8 characters."
          error={errors.password?.message}
          disabled={mutation.isPending}
          {...register('password')}
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          disabled={mutation.isPending}
          {...register('confirmPassword')}
        />
      </div>
    </Dialog>
  );
}

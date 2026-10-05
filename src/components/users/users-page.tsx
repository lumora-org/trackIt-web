'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import {
  createUser,
  createUserSchema,
  deleteUser,
  listUsers,
  ROLE_FILTER_OPTIONS,
  setUserStatus,
  updateUser,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
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
import type { AccountStatus, User, UserRole } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Users (doc 04 §17–19, doc 07 §56–58).
 *
 * doc 07 §57 — an ADMIN manages MANAGERs, never other admins. The create form
 * therefore only offers ADMIN or MANAGER, and a MANAGER requires a branch while
 * an ADMIN must not have one (doc 03 §22). Both rules are enforced in the schema
 * so the impossible combinations are unselectable. Row actions follow the same
 * rule: edit, suspend and delete are offered for managers only.
 */
export function UsersPage() {
  const { branches } = useBranchContext();
  const { user: caller } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

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
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      setUserStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
      setSuspendTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
      setDeleteTarget(null);
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
      render: (u) => {
        // Nobody acts on their own row, and the platform owner is out of scope.
        if (!caller || caller.id === u.id || u.role === 'SUPER_ADMIN') return null;
        // doc 07 §57 — an admin manages managers, not other admins.
        if (caller.role === 'ADMIN' && u.role !== 'MANAGER') return null;

        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(u)}>
              Edit
            </Button>
            {u.status === 'ACTIVE' ? (
              <Button variant="ghost" size="sm" onClick={() => setSuspendTarget(u)}>
                Suspend
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => statusMutation.mutate({ id: u.id, status: 'ACTIVE' })}
              >
                Activate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-danger-700 hover:bg-danger-50"
              onClick={() => setDeleteTarget(u)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Users</h1>
          <p className="text-sm text-neutral-500">
            Administrators and branch managers. Suspend to block sign-in, delete to remove a
            manager permanently.
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

      <EditUserDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        branches={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
      />

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onClose={() => {
          setSuspendTarget(null);
          statusMutation.reset();
        }}
        onConfirm={() =>
          suspendTarget && statusMutation.mutate({ id: suspendTarget.id, status: 'SUSPENDED' })
        }
        title="Suspend this user?"
        description={
          suspendTarget
            ? `${suspendTarget.firstName} ${suspendTarget.lastName} will not be able to sign in until they are reactivated. Their records are kept.`
            : ''
        }
        confirmLabel="Suspend"
        loading={statusMutation.isPending}
      >
        {statusMutation.error?.message ? (
          <InlineError message={statusMutation.error.message} />
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          deleteMutation.reset();
        }}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete this user?"
        description={
          deleteTarget
            ? `${deleteTarget.firstName} ${deleteTarget.lastName} will be permanently removed. Suspend instead if you may need them back.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      >
        {deleteMutation.error?.message ? (
          <InlineError message={deleteMutation.error.message} />
        ) : null}
      </ConfirmDialog>
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

/* ---------------------------------------------------------------- edit */

/**
 * doc 04 §18 — profile fields only. Email and role are immutable here, and a
 * manager must keep a branch (doc 03 §22).
 */
function EditUserDialog({
  target,
  onClose,
  branches,
}: {
  target: User | null;
  onClose: () => void;
  branches: ReadonlyArray<{ value: string; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { firstName: '', lastName: '', phone: '' },
  });

  // Re-seed the form whenever a different row is opened.
  useEffect(() => {
    if (!target) return;
    reset({
      firstName: target.firstName,
      lastName: target.lastName,
      phone: target.phone ?? '',
      branchId: target.branchId ?? '',
    });
  }, [target, reset]);

  const mutation = useMutation({
    mutationFn: (input: UpdateUserInput) => updateUser(target!.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
      onClose();
    },
    onError: (err) => {
      if (isApiError(err)) {
        const branchError = err.fieldError('branchId');
        if (branchError) setError('branchId', { message: branchError });
        setFormError(branchError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  const submit = handleSubmit((values) => {
    if (!target) return;
    // A manager must remain pinned to a branch (doc 03 §22).
    if (target.role === 'MANAGER' && !values.branchId) {
      setError('branchId', { message: 'Select a branch for the manager' });
      return;
    }
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <Dialog
      open={Boolean(target)}
      onClose={() => {
        setFormError(null);
        onClose();
      }}
      title="Edit user"
      description={target ? `${target.email} · ${ROLE_LABELS[target.role]}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending} loadingText="Saving">
            Save changes
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
          description="Email addresses cannot be changed."
          value={target?.email ?? ''}
          readOnly
        />

        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          error={errors.phone?.message}
          disabled={mutation.isPending}
          {...register('phone')}
        />

        {target?.role === 'MANAGER' ? (
          <Select
            label="Branch"
            placeholder="Select a branch"
            options={branches}
            error={errors.branchId?.message}
            disabled={mutation.isPending}
            {...register('branchId')}
          />
        ) : null}

        <p className="rounded-xl bg-neutral-100 px-3 py-2.5 text-xs text-neutral-600">
          Roles cannot be changed after creation. Suspend this user and create a new one if their
          responsibilities change.
        </p>
      </div>
    </Dialog>
  );
}

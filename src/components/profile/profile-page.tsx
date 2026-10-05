'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { changePassword, changePasswordSchema, type ChangePasswordValues } from '@/api/auth.api';
import { isApiError } from '@/api/errors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DetailRow } from '@/components/ui/stat-card';
import { InlineError } from '@/components/ui/states';
import { fullName } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/permissions';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Profile (available to every role — doc 07 §56 "Update own profile" / "Change
 * own password").
 *
 * doc 06 §34 — a user may change their own password but not their role or branch
 * assignment, so neither control is offered here. Changing those requires an
 * administrator.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const { activeBranch, branches } = useBranchContext();
  const [done, setDone] = useState(false);

  if (!user) return null;

  const branchName =
    activeBranch?.name ?? branches.find((b) => b.id === user.branchId)?.name ?? '—';

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Profile</h1>
        <p className="text-sm text-neutral-500">Your account details and password.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <Badge tone="brand">{ROLE_LABELS[user.role]}</Badge>
        </CardHeader>
        <CardBody>
          <dl>
            <DetailRow label="Name" value={fullName(user)} />
            <DetailRow label="Email" value={user.email} />
            <DetailRow label="Phone" value={user.phone ?? '—'} />
            <DetailRow label="Role" value={ROLE_LABELS[user.role]} />
            {/* doc 06 §5 — a manager is pinned to one branch. */}
            <DetailRow label="Branch" value={user.branchId ? branchName : 'All branches'} />
          </dl>
          <p className="mt-3 text-xs text-neutral-500">
            Your role and branch assignment are managed by an administrator.
          </p>
        </CardBody>
      </Card>

      <ChangePasswordCard onDone={() => setDone(true)} />
      {done ? (
        <p
          role="status"
          className="rounded-card border-success-500/30 bg-success-50 text-success-700 flex items-center gap-2 border px-4 py-3 text-sm"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Your password has been updated.
        </p>
      ) : null}
    </div>
  );
}

function ChangePasswordCard({ onDone }: { onDone: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setFormError(null);
      reset();
      onDone();
    },
    onError: (err) => {
      setFormError(isApiError(err) ? err.message : 'Unable to change your password.');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-neutral-400" aria-hidden="true" />
          Change password
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {formError ? <InlineError message={formError} /> : null}

          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            disabled={mutation.isPending}
            {...register('currentPassword')}
          />

          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            description="Must be at least 8 characters and different from your current password."
            error={errors.newPassword?.message}
            disabled={mutation.isPending}
            {...register('newPassword')}
          />

          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            disabled={mutation.isPending}
            {...register('confirmPassword')}
          />

          <Button type="submit" loading={mutation.isPending} loadingText="Updating">
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

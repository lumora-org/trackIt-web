'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, KeyRound } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';

import { changePassword, changePasswordSchema, type ChangePasswordValues } from '@/api/auth.api';
import { isApiError } from '@/api/errors';
import {
  AVATAR_MAX_BYTES,
  AVATAR_SUPPORTED_TYPES,
  updateMyAvatar,
} from '@/api/users.api';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DetailRow } from '@/components/ui/stat-card';
import { InlineError } from '@/components/ui/states';
import { fullName } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
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
        <p className="text-sm text-neutral-500">Your account details, photo and password.</p>
      </header>

      <AvatarCard />

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

/**
 * PROMPT.md §56 — profile photo. The file never leaves the browser as bytes:
 * it is read into a data URL and posted to `/users/me/avatar`, which keeps the
 * upload working identically against the mock and a future real backend.
 */
function AvatarCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateMyAvatar,
    onSuccess: (updated) => {
      setFormError(null);
      // The identity query also feeds the top bar avatar.
      queryClient.setQueryData(queryKeys.auth.me, updated);
    },
    onError: (err) => {
      setFormError(isApiError(err) ? err.message : 'Unable to update your photo.');
    },
  });

  if (!user) return null;

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    if (!AVATAR_SUPPORTED_TYPES.includes(file.type as (typeof AVATAR_SUPPORTED_TYPES)[number])) {
      setFormError('Choose a PNG, JPG or WebP image.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setFormError('Photos must be 2 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') mutation.mutate(reader.result);
      else setFormError('That file could not be read. Try another photo.');
    };
    reader.onerror = () => setFormError('That file could not be read. Try another photo.');
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="size-4 text-neutral-400" aria-hidden="true" />
          Profile photo
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          {formError ? <InlineError message={formError} /> : null}
          <div className="flex items-center gap-4">
            <Avatar name={fullName(user)} src={user.avatarUrl} size="lg" />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  loading={mutation.isPending}
                  loadingText="Uploading"
                  onClick={() => inputRef.current?.click()}
                >
                  {user.avatarUrl ? 'Replace photo' : 'Upload photo'}
                </Button>
                {user.avatarUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger-700 hover:bg-danger-50"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-neutral-500">PNG, JPG or WebP, up to 2 MB.</p>
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFile}
          aria-hidden="true"
          tabIndex={-1}
        />
      </CardBody>
    </Card>
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

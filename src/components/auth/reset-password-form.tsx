'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  PASSWORD_MIN_LENGTH,
  resetPassword,
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/api/auth.api';
import { isApiError } from '@/api/errors';
import { AuthBrand } from '@/components/auth/auth-brand';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  // doc 04 §15 — the token must exist, be unexpired, and be unused.
  if (!token) {
    return (
      <>
        <AuthBrand />
        <Card>
          <CardBody className="space-y-4 text-center">
            <h2 className="text-lg font-semibold text-neutral-900">Reset link is invalid</h2>
            <p className="text-sm text-neutral-600">
              This password reset link is missing its token. Request a new one to continue.
            </p>
            <Link href="/forgot-password" className={buttonVariants({ size: 'lg', block: true })}>
              Request a new link
            </Link>
          </CardBody>
        </Card>
      </>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    try {
      // doc 04 §15 — the token is invalidated on success.
      await resetPassword({ token: values.token, password: values.password });
      setDone(true);
      // The user must now sign in with the new password.
      setTimeout(() => router.replace('/login?reset=1'), 2500);
    } catch (err) {
      if (isApiError(err)) {
        const passwordError = err.fieldError('password');
        if (passwordError) setError('password', { message: passwordError });
        setFormError(passwordError ? null : err.message || 'Unable to reset your password.');
      } else {
        setFormError('Unable to reset your password. Please try again.');
      }
    }
  }

  if (done) {
    return (
      <>
        <AuthBrand />
        <Card>
          <CardBody className="space-y-4 text-center">
            <span className="bg-success-50 mx-auto flex size-12 items-center justify-center rounded-full">
              <CheckCircle2 className="text-success-700 size-6" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-neutral-900">Password updated</h2>
              <p className="text-sm text-neutral-600">
                Your password has been changed. Taking you to sign in&hellip;
              </p>
            </div>
            <Link href="/login" className={buttonVariants({ size: 'lg', block: true })}>
              Sign in now
            </Link>
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      <AuthBrand />
      <Card>
        <CardBody className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Choose a new password</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Must be at least {PASSWORD_MIN_LENGTH} characters.
            </p>
          </div>

          {formError ? <InlineError message={formError} /> : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <input type="hidden" {...register('token')} />

            <div className="relative">
              <Input
                label="New password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                error={errors.password?.message}
                disabled={isSubmitting}
                className="pr-14"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="size-touch focus-visible:outline-brand-600 absolute top-[2.15rem] right-1 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 focus-visible:outline-2"
              >
                {showPassword ? (
                  <EyeOff className="size-5" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <Input
              label="Confirm new password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              disabled={isSubmitting}
              {...register('confirmPassword')}
            />

            <Button
              type="submit"
              size="lg"
              block
              loading={isSubmitting}
              loadingText="Updating password"
            >
              Update password
            </Button>
          </form>

          <div className="border-t border-neutral-100 pt-4 text-center">
            <Link
              href="/login"
              className="min-h-touch text-brand-700 hover:text-brand-800 inline-flex items-center text-sm font-medium"
            >
              Back to sign in
            </Link>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

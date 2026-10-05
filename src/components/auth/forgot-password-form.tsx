'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { forgotPassword, forgotPasswordSchema, type ForgotPasswordValues } from '@/api/auth.api';
import { isApiError } from '@/api/errors';
import { AuthBrand } from '@/components/auth/auth-brand';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';

export function ForgotPasswordForm() {
  /*
   * doc 04 §14 / doc 06 §18 — the response is deliberately identical whether or
   * not the account exists, so this screen never reveals account existence.
   */
  const [submitted, setSubmitted] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      await forgotPassword(values.email);
      setSentTo(values.email);
      setSubmitted(true);
    } catch (err) {
      setFormError(
        isApiError(err) ? err.message : 'Unable to send reset instructions. Please try again.',
      );
    }
  }

  if (submitted) {
    return (
      <>
        <AuthBrand />
        <Card>
          <CardBody className="space-y-4 text-center">
            <span className="bg-success-50 mx-auto flex size-12 items-center justify-center rounded-full">
              <MailCheck className="text-success-700 size-6" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-neutral-900">Check your email</h2>
              <p className="text-sm text-neutral-600">
                If an account exists for{' '}
                <span className="font-medium text-neutral-900">{sentTo}</span>, password reset
                instructions have been sent.
              </p>
            </div>
            <p className="text-xs text-neutral-500">The link expires in 30 minutes.</p>
            <Button variant="outline" block onClick={() => setSubmitted(false)}>
              Use a different email
            </Button>
            <Link
              href="/login"
              className="min-h-touch text-brand-700 hover:text-brand-800 inline-flex w-full items-center justify-center gap-2 text-sm font-medium"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to sign in
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
            <h2 className="text-lg font-semibold text-neutral-900">Reset your password</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Enter your work email and we will send you reset instructions.
            </p>
          </div>

          {formError ? <InlineError message={formError} /> : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Input
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@kbyglobal.com"
              error={errors.email?.message}
              disabled={isSubmitting}
              {...register('email')}
            />
            <Button type="submit" size="lg" block loading={isSubmitting} loadingText="Sending">
              Send reset link
            </Button>
          </form>

          <div className="border-t border-neutral-100 pt-4 text-center">
            <Link
              href="/login"
              className="min-h-touch text-brand-700 hover:text-brand-800 inline-flex items-center gap-2 text-sm font-medium"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

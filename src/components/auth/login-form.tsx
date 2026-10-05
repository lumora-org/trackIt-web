'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { loginSchema, type LoginValues } from '@/api/auth.api';
import { isApiError } from '@/api/errors';
import { AuthBrand } from '@/components/auth/auth-brand';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';
import { useAuth } from '@/providers/auth-provider';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      await login(values);
      // Only redirect once the session is genuinely established, otherwise the
      // protected route bounces straight back to login.
      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/') ? next : '/dashboard');
    } catch (err) {
      /*
       * PROMPT.md §17 — preserve what the user typed. Only the server's
       * field-level messages are written back; the values are left untouched.
       */
      if (isApiError(err)) {
        const emailError = err.fieldError('email');
        const passwordError = err.fieldError('password');
        if (emailError) setError('email', { message: emailError });
        if (passwordError) setError('password', { message: passwordError });
        setFormError(emailError || passwordError ? null : err.message || 'Unable to sign in.');
      } else {
        setFormError('Unable to sign in. Please try again.');
      }
    }
  }

  return (
    <>
      <AuthBrand />

      <Card>
        <CardBody className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Sign in</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Enter your work email and password.</p>
          </div>

          {/* doc 04 §109 — the backend rate-limits login; surface that clearly. */}
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

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                disabled={isSubmitting}
                className="pr-14"
                {...register('password')}
              />
              {/* Positioned over the input's right padding so it never shifts layout. */}
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

            <Button type="submit" size="lg" block loading={isSubmitting} loadingText="Signing in">
              Sign in
            </Button>
          </form>

          <div className="border-t border-neutral-100 pt-4 text-center">
            <Link
              href="/forgot-password"
              className="min-h-touch text-brand-700 hover:text-brand-800 inline-flex items-center text-sm font-medium"
            >
              Forgot your password?
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* Demo credentials, shown only while the mock API is driving the app. */}
      {process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false' ? (
        <div className="rounded-card mt-6 border border-dashed border-neutral-300 bg-surface/60 p-4">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Demo accounts
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-neutral-600">
            <li>admin@kbyglobal.com</li>
            <li>manager@kbyglobal.com</li>
            <li>superadmin@kbyglobal.com</li>
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Password for all: <span className="font-mono">Password123!</span>
          </p>
        </div>
      ) : null}
    </>
  );
}

'use client';

import { Suspense } from 'react';

import { LoadingState } from '@/components/ui/states';

import { LoginForm } from '@/components/auth/login-form';

/** `useSearchParams` needs a Suspense boundary during prerendering. */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading sign in" />}>
      <LoginForm />
    </Suspense>
  );
}

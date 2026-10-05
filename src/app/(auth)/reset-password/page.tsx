import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { LoadingState } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false },
};

/** `useSearchParams` reads the token, so it needs a Suspense boundary. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

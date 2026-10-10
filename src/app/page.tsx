'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Logo } from '@/components/shared/logo';
import { useAuth } from '@/providers/auth-provider';

/**
 * Entry route. The session lives in memory (ASSUMPTIONS.md §3.9), so the
 * destination is decided on the client once `me` settles — mirroring
 * `RequireAuth`: signed-in users land on the dashboard, everyone else on the
 * sign-in screen. Until then a quiet splash renders instead of any marketing
 * content.
 */
export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [isLoading, isAuthenticated, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-50"
    >
      <Logo size={72} priority className="shadow-sm ring-1 ring-neutral-200" />
      <div className="flex items-center gap-3">
        <Loader2 className="text-brand-600 size-5 animate-spin" aria-hidden="true" />
        <p className="text-sm text-neutral-600">Opening TrackIt&hellip;</p>
      </div>
    </div>
  );
}

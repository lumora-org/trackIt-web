import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

/**
 * Auth screens are a centred single column: no app shell, no navigation.
 * Mobile-first, and deliberately free of any dashboard affordance so a signed-out
 * user cannot be confused about what is available.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

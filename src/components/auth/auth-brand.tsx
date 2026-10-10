import { Logo } from '@/components/shared/logo';

/** Branded header shared by every auth screen. */
export function AuthBrand() {
  return (
    <div className="mb-8 text-center">
      <Logo
        size={64}
        priority
        className="mx-auto mb-4 shadow-sm ring-1 ring-neutral-200"
      />
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
        K.B.Y GLOBAL INVESTMENT
      </h1>
      <p className="mt-1 text-sm text-neutral-500">Fuel station operations</p>
    </div>
  );
}

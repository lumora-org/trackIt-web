import { Fuel } from 'lucide-react';

/** Branded header shared by every auth screen. */
export function AuthBrand() {
  return (
    <div className="mb-8 text-center">
      <span className="bg-brand-600 mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl text-white shadow-sm">
        <Fuel className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
        K.B.Y GLOBAL INVESTMENT
      </h1>
      <p className="mt-1 text-sm text-neutral-500">Fuel station operations</p>
    </div>
  );
}

import type { Metadata } from 'next';

import { FuelTypesPage } from '@/components/fuel-types/fuel-types-page';

export const metadata: Metadata = { title: 'Fuel Types' };

export default function Page() {
  return <FuelTypesPage />;
}

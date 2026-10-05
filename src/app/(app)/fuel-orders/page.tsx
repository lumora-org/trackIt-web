import type { Metadata } from 'next';

import { FuelOrdersPage } from '@/components/fuel-orders/fuel-orders-page';

export const metadata: Metadata = { title: 'Fuel Orders' };

export default function Page() {
  return <FuelOrdersPage />;
}

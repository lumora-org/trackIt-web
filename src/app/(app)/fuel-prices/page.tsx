import type { Metadata } from 'next';

import { FuelPricesPage } from '@/components/fuel-prices/fuel-prices-page';

export const metadata: Metadata = { title: 'Fuel Prices' };

export default function Page() {
  return <FuelPricesPage />;
}

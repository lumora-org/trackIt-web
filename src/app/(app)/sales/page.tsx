import type { Metadata } from 'next';

import { SalesPage } from '@/components/sales/sales-page';

export const metadata: Metadata = { title: 'Sales' };

export default function Page() {
  return <SalesPage />;
}

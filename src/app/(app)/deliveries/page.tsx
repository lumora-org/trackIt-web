import type { Metadata } from 'next';

import { DeliveriesPage } from '@/components/deliveries/deliveries-page';

export const metadata: Metadata = { title: 'Deliveries' };

export default function Page() {
  return <DeliveriesPage />;
}

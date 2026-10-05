import type { Metadata } from 'next';

import { BusinessesPage } from '@/components/businesses/businesses-page';

export const metadata: Metadata = { title: 'Businesses' };

export default function Page() {
  return <BusinessesPage />;
}

import type { Metadata } from 'next';

import { TankersPage } from '@/components/tankers/tankers-page';

export const metadata: Metadata = { title: 'Tankers' };

export default function Page() {
  return <TankersPage />;
}

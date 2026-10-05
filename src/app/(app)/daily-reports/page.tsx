import type { Metadata } from 'next';

import { DailyReportsPage } from '@/components/daily-reports/daily-reports-page';

export const metadata: Metadata = { title: 'Daily Reports' };

export default function Page() {
  return <DailyReportsPage />;
}

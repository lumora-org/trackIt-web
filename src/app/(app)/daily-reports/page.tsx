import type { Metadata } from 'next';
import { Suspense } from 'react';

import { DailyReportsPage } from '@/components/daily-reports/daily-reports-page';
import { LoadingState } from '@/components/ui/states';

export const metadata: Metadata = { title: 'Daily Reports' };

/** `useSearchParams` reads the `?incident=` deep link, so it needs a Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading daily reports" />}>
      <DailyReportsPage />
    </Suspense>
  );
}

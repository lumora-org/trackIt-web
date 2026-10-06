import type { Metadata } from 'next';

import { BusinessDetailPage } from '@/components/businesses/business-detail-page';

export const metadata: Metadata = { title: 'Business detail' };

// Next.js 16 — route params arrive as a promise.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <BusinessDetailPage businessId={id} />;
}

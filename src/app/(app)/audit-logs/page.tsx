import type { Metadata } from 'next';

import { AuditLogsPage } from '@/components/audit/audit-logs-page';

export const metadata: Metadata = { title: 'Audit Logs' };

export default function Page() {
  return <AuditLogsPage />;
}

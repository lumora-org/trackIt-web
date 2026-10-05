'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import {
  AUDIT_ACTION_FILTER_OPTIONS,
  AUDIT_RESOURCE_FILTER_OPTIONS,
  listAuditLogs,
  type AuditLogFilters,
} from '@/api/audit-logs.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/dialog';
import { DetailRow, SectionHeading } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/shared/search-input';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { AuditLog } from '@/types/domain';

/**
 * Audit log visibility (PROMPT.md §31 step 18).
 *
 * Read-only by design — doc 03 §62 makes records append-only for normal users,
 * so no edit or delete affordance exists anywhere on this screen.
 */
export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const filters: AuditLogFilters = {
    page,
    limit: 50,
    action: actionFilter || undefined,
    resourceType: resourceFilter || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const listQuery = useQuery({
    queryKey: queryKeys.auditLogs.list(filters),
    queryFn: () => listAuditLogs(filters),
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'When',
      primary: true,
      render: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <Badge
          tone={r.action.includes('DELETED') || r.action.includes('FAILED') ? 'danger' : 'info'}
          size="sm"
        >
          {r.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'resourceType',
      header: 'Resource',
      secondary: true,
      render: (r) => r.resourceType ?? '—',
    },
    {
      key: 'userId',
      header: 'Actor',
      mobileHidden: true,
      render: (r) => (r.userId ? `${r.userId.slice(0, 8)}…` : '—'),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      align: 'right',
      mobileHidden: true,
      render: (r) => r.ipAddress ?? '—',
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Audit Logs</h1>
        <p className="text-sm text-neutral-500">
          An append-only record of who did what. Entries can never be edited or removed.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Filter by action"
          value={actionFilter}
          onChange={(value) => {
            setActionFilter(value);
            setPage(1);
          }}
          options={AUDIT_ACTION_FILTER_OPTIONS}
        />
        <FilterSelect
          label="Filter by resource type"
          value={resourceFilter}
          onChange={(value) => {
            setResourceFilter(value);
            setPage(1);
          }}
          options={AUDIT_RESOURCE_FILTER_OPTIONS}
        />
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActionFilter('');
            setResourceFilter('');
            setFrom('');
            setTo('');
            setPage(1);
          }}
        >
          Clear filters
        </Button>
      </div>

      <DataTable
        caption="Audit log"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading audit log"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        onRowClick={(row) => setSelected(row)}
        emptyTitle="No audit entries"
        emptyDescription="Activity appears here as operations are performed."
        emptyIcon={ScrollText}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Audit entry"
        description={selected?.action.replace(/_/g, ' ')}
      >
        {selected ? (
          <div className="space-y-6">
            <section>
              <SectionHeading title="Entry" />
              <dl>
                <DetailRow label="Action" value={selected.action.replace(/_/g, ' ')} />
                <DetailRow label="When" value={formatDateTime(selected.createdAt)} />
                <DetailRow label="Resource type" value={selected.resourceType ?? '—'} />
                <DetailRow label="Resource id" value={selected.resourceId ?? '—'} />
                <DetailRow
                  label="Actor"
                  value={selected.userId ? `${selected.userId.slice(0, 8)}…` : '—'}
                />
                <DetailRow label="IP address" value={selected.ipAddress ?? '—'} />
              </dl>
            </section>

            {/*
              doc 03 §61 — payload keys are camelCase inside the JSONB, despite
              the snake_case column names.
            */}
            {selected.oldValues ? (
              <section>
                <SectionHeading title="Before" />
                <JsonBlock value={selected.oldValues} />
              </section>
            ) : null}

            {selected.newValues ? (
              <section>
                <SectionHeading title="After" />
                <JsonBlock value={selected.newValues} />
              </section>
            ) : null}

            {selected.metadata ? (
              <section>
                <SectionHeading title="Metadata" />
                <JsonBlock value={selected.metadata} />
              </section>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function JsonBlock({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-neutral-950 p-3 font-mono text-xs text-neutral-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

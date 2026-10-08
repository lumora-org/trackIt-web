'use client';

import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { useState } from 'react';

import { getDelivery, listDeliveries, type DeliveryFilters } from '@/api/deliveries.api';
import { QuantityDisplay } from '@/components/ui/amount';
import { StatusBadge } from '@/components/ui/badge';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/dialog';
import { DetailRow, SectionHeading } from '@/components/ui/stat-card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { FilterSelect } from '@/components/shared/search-input';
import { formatDateTime, formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { Delivery, DeliveryStatus } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

import { DeliveryReceiveForm } from './delivery-receive-form';

/**
 * Deliveries (PROMPT.md §31 step 12).
 *
 * A manager sees only their own branch's deliveries; the branch filter is never
 * offered to them (PROMPT.md §7).
 */
export function DeliveriesPage() {
  const { user } = useAuth();
  const { activeBranchIds } = useBranchContext();
  const canReceive = can(user?.role, 'delivery.receive');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const filters: DeliveryFilters = {
    page,
    limit: 20,
    status: (statusFilter || undefined) as DeliveryStatus | undefined,
    branchId,
  };

  const listQuery = useQuery({
    queryKey: queryKeys.deliveries.list(filters),
    queryFn: () => listDeliveries(filters),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.deliveries.detail(selectedId ?? ''),
    queryFn: () => getDelivery(selectedId!),
    enabled: Boolean(selectedId),
  });

  const delivery = detailQuery.data;

  const columns: Column<Delivery>[] = [
    {
      key: 'deliveryNumber',
      header: 'Delivery',
      primary: true,
      render: (r) => <span className="font-mono font-semibold">{r.deliveryNumber ?? '—'}</span>,
    },
    {
      key: 'fuelOrder',
      header: 'Order',
      secondary: true,
      render: (r) => r.fuelOrder?.orderNumber ?? '—',
    },
    {
      key: 'tanker',
      header: 'Tanker',
      render: (r) => r.tanker?.registrationNumber ?? '—',
    },
    {
      key: 'quantity',
      header: 'Expected',
      align: 'right',
      render: (r) => formatLitres(r.items.reduce((sum, i) => sum + i.expectedQuantityLitres, 0)),
    },
    {
      key: 'deliveredAt',
      header: 'Arrived',
      mobileHidden: true,
      render: (r) => formatDateTime(r.deliveredAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge domain="delivery" value={r.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Deliveries</h1>
          <p className="text-sm text-neutral-500">
            Receive arriving fuel and record the actual quantity.
          </p>
        </div>
        <FilterSelect
          className="sm:w-48"
          label="Filter by status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'RECEIVED', label: 'Received' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
      </header>

      <DataTable
        caption="Deliveries"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading deliveries"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="No deliveries yet"
        emptyDescription="Deliveries appear here as soon as a fuel order is placed for a branch. Receiving one moves its fuel into stock."
        emptyIcon={Truck}
      />

      <Drawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title="Receive delivery"
        description={delivery?.deliveryNumber ?? undefined}
      >
        {detailQuery.isLoading ? <LoadingState label="Loading delivery" /> : null}
        {detailQuery.isError ? (
          <ErrorState message={detailQuery.error.message} onRetry={() => detailQuery.refetch()} />
        ) : null}

        {delivery ? (
          delivery.status === 'PENDING' && canReceive ? (
            <DeliveryReceiveForm delivery={delivery} onReceived={() => setSelectedId(null)} />
          ) : (
            <ReceivedDeliverySummary delivery={delivery} />
          )
        ) : null}
      </Drawer>
    </div>
  );
}

/** Read-only view once a delivery is received or cancelled. */
function ReceivedDeliverySummary({ delivery }: { delivery: Delivery }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-700">Delivery</p>
        <StatusBadge domain="delivery" value={delivery.status} />
      </div>

      <section>
        <SectionHeading title="Context" />
        <dl>
          <DetailRow label="Order" value={delivery.fuelOrder?.orderNumber ?? '—'} />
          <DetailRow label="Tanker" value={delivery.tanker?.registrationNumber ?? '—'} />
          <DetailRow label="Driver" value={delivery.tanker?.driverName ?? '—'} />
          <DetailRow label="Arrived" value={formatDateTime(delivery.deliveredAt)} />
          {delivery.notes ? <DetailRow label="Notes" value={delivery.notes} /> : null}
        </dl>
      </section>

      <section>
        <SectionHeading title="Quantities" />
        <ul className="space-y-3">
          {delivery.items.map((item) => (
            <li key={item.id} className="rounded-xl border border-neutral-200 p-3">
              <p className="font-semibold text-neutral-900">{item.fuelTypeName ?? 'Fuel'}</p>
              <dl className="mt-2 space-y-1">
                <DetailRow
                  label="Expected"
                  value={<QuantityDisplay value={item.expectedQuantityLitres} />}
                />
                <DetailRow
                  label="Received"
                  value={
                    item.actualQuantityLitres === null ? (
                      '—'
                    ) : (
                      <QuantityDisplay value={item.actualQuantityLitres} />
                    )
                  }
                  emphasis
                />
                {item.differenceLitres !== null && item.differenceLitres !== 0 ? (
                  <DetailRow
                    label="Variance"
                    value={<QuantityDisplay value={Math.abs(item.differenceLitres)} />}
                  />
                ) : null}
              </dl>
              {item.discrepancyReason ? (
                <p className="bg-warning-50 text-warning-700 mt-2 rounded-lg px-3 py-2 text-xs">
                  {item.discrepancyReason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

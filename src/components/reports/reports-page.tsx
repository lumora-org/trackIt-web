'use client';

import { useQuery } from '@tanstack/react-query';
import { Banknote, Download, Fuel, Package, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { exportFilename, exportUrl, type ReportKind } from '@/api/reports.api';
import { getInventoryStock } from '@/api/inventory.api';
import { listSales, type SalesFilters } from '@/api/sales.api';
import { listDeliveries, type DeliveryFilters } from '@/api/deliveries.api';
import { listDailyReports, type DailyReportFilters } from '@/api/daily-reports.api';
import { CurrencyDisplay, QuantityDisplay } from '@/components/ui/amount';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/shared/segmented-tabs';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { formatDate, toAmount } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Reports and analytics (PROMPT.md §31 step 17).
 *
 * PROMPT.md §8 warns against overloading with charts, so this shows headline
 * totals plus one ranked breakdown — the same restrained approach as the
 * dashboard.
 *
 * All totals are summed from records the API returned. Nothing here computes a
 * figure the backend owns; for the same reason the report screens read the
 * resource endpoints, whose schemas are documented, rather than
 * GET /reports/*, whose response shapes are not (ASSUMPTIONS.md §3.13).
 */
export function ReportsPage() {
  const { activeBranchIds } = useBranchContext();
  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const [tab, setTab] = useState<ReportKind>('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const range = { from: from || undefined, to: to || undefined, branchId };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Reports</h1>
          <p className="text-sm text-neutral-500">Period summaries and spreadsheet exports.</p>
        </div>
        <ExportButton kind={tab} range={range} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-lg">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <SegmentedTabs<ReportKind>
        value={tab}
        onChange={setTab}
        ariaLabel="Report type"
        options={[
          { value: 'sales', label: 'Sales' },
          { value: 'inventory', label: 'Inventory' },
          { value: 'deliveries', label: 'Deliveries' },
          { value: 'daily-reports', label: 'Daily reports' },
        ]}
      />

      {tab === 'sales' ? <SalesReport range={range} /> : null}
      {tab === 'inventory' ? <InventoryReport range={range} /> : null}
      {tab === 'deliveries' ? <DeliveriesReport range={range} /> : null}
      {tab === 'daily-reports' ? <DailyReportsReport range={range} /> : null}
    </div>
  );
}

/* --------------------------------------------------------------- tabs */

function SalesReport({ range }: { range: { from?: string; to?: string; branchId?: string } }) {
  const filters: SalesFilters = { limit: 100, ...range };
  const query = useQuery({
    queryKey: queryKeys.reports.sales(filters),
    queryFn: () => listSales(filters),
  });

  if (query.isLoading) return <LoadingState label="Loading sales report" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const rows = query.data?.data ?? [];
  const active = rows.filter((r) => !r.voidedAt);

  const byFuel = new Map<string, { litres: number; revenue: number }>();
  for (const sale of active) {
    const key = sale.fuelTypeName ?? sale.fuelTypeId;
    const entry = byFuel.get(key) ?? { litres: 0, revenue: 0 };
    entry.litres += sale.litresSold;
    entry.revenue += sale.totalAmount;
    byFuel.set(key, entry);
  }
  const ranked = [...byFuel.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const totalRevenue = active.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalLitres = active.reduce((sum, s) => sum + s.litresSold, 0);
  const voided = rows.length - active.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TotalCard
          label="Revenue"
          icon={Banknote}
          value={<CurrencyDisplay value={totalRevenue} compact />}
        />
        <TotalCard label="Fuel sold" icon={Fuel} value={<QuantityDisplay value={totalLitres} />} />
        <TotalCard
          label="Sales recorded"
          icon={TrendingUp}
          value={active.length.toLocaleString('en-NG')}
          hint={voided > 0 ? `${voided} voided excluded` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By fuel type</CardTitle>
        </CardHeader>
        <CardBody className="pt-4">
          {ranked.length === 0 ? (
            <p className="text-sm text-neutral-600">No sales in this period.</p>
          ) : (
            <RankedBars
              items={ranked.map(([name, v]) => ({ name, value: v.revenue, litres: v.litres }))}
              renderValue={(v) => <CurrencyDisplay value={v} />}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function InventoryReport({ range }: { range: { branchId?: string } }) {
  const query = useQuery({
    queryKey: queryKeys.inventory.stock({ branchId: range.branchId }),
    queryFn: () => getInventoryStock({ branchId: range.branchId }),
  });

  if (query.isLoading) return <LoadingState label="Loading inventory report" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const rows = query.data ?? [];
  const total = rows.reduce((sum, r) => sum + r.currentQuantityLitres, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalCard label="Total stock" icon={Package} value={<QuantityDisplay value={total} />} />
        <TotalCard label="Fuel types" icon={Fuel} value={rows.length.toLocaleString('en-NG')} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock by fuel type</CardTitle>
        </CardHeader>
        <CardBody className="pt-4">
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-600">No inventory in this period.</p>
          ) : (
            <RankedBars
              items={rows.map((r) => ({
                name: `${r.fuelTypeName}${r.branchId !== range.branchId ? ` · ${r.branchName}` : ''}`,
                value: r.currentQuantityLitres,
              }))}
              renderValue={(v) => <QuantityDisplay value={v} />}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function DeliveriesReport({ range }: { range: { from?: string; to?: string; branchId?: string } }) {
  const filters: DeliveryFilters = { limit: 100, ...range };
  const query = useQuery({
    queryKey: queryKeys.reports.deliveries(filters),
    queryFn: () => listDeliveries(filters),
  });

  if (query.isLoading) return <LoadingState label="Loading deliveries report" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const rows = query.data?.data ?? [];
  const received = rows.filter((d) => d.status === 'RECEIVED');
  const totalReceived = received.reduce(
    (sum, d) => sum + d.items.reduce((s, i) => s + (i.actualQuantityLitres ?? 0), 0),
    0,
  );
  const totalVariance = received.reduce(
    (sum, d) => sum + d.items.reduce((s, i) => s + (i.differenceLitres ?? 0), 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TotalCard
          label="Fuel received"
          icon={Package}
          value={<QuantityDisplay value={totalReceived} />}
        />
        <TotalCard
          label="Deliveries received"
          icon={Download}
          value={received.length.toLocaleString('en-NG')}
        />
        <TotalCard
          label="Net variance"
          icon={TrendingUp}
          value={<QuantityDisplay value={Math.abs(totalVariance)} />}
          hint={totalVariance < 0 ? 'short against order' : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deliveries in period</CardTitle>
        </CardHeader>
        <CardBody className="pt-4">
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-600">No deliveries in this period.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.slice(0, 20).map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="font-mono text-sm font-semibold">
                    {d.deliveryNumber ?? d.id.slice(0, 8)}
                  </span>
                  <span className="text-sm text-neutral-600">
                    {formatDate(d.deliveredAt)} ·{' '}
                    <QuantityDisplay
                      value={d.items.reduce((s, i) => s + i.expectedQuantityLitres, 0)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function DailyReportsReport({
  range,
}: {
  range: { from?: string; to?: string; branchId?: string };
}) {
  const filters: DailyReportFilters = { limit: 100, ...range };
  const query = useQuery({
    queryKey: queryKeys.reports.dailyReports(filters),
    queryFn: () => listDailyReports(filters),
  });

  if (query.isLoading) return <LoadingState label="Loading daily reports" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const rows = query.data?.data ?? [];
  const revenue = rows.reduce((sum, r) => sum + r.totalRevenue, 0);
  const sold = rows.reduce((sum, r) => sum + r.totalSoldLitres, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalCard
          label="Reported revenue"
          icon={Banknote}
          value={<CurrencyDisplay value={revenue} compact />}
        />
        <TotalCard
          label="Reported fuel sold"
          icon={Fuel}
          value={<QuantityDisplay value={sold} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports in period</CardTitle>
        </CardHeader>
        <CardBody className="pt-4">
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-600">No daily reports in this period.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.slice(0, 20).map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="text-sm font-medium">{formatDate(r.reportDate)}</span>
                  <span className="text-sm text-neutral-600">
                    <CurrencyDisplay value={r.totalRevenue} /> · {r.status.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- shared */

function TotalCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-neutral-200 bg-surface p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-100">
          <Icon className="size-4 text-neutral-600" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

/**
 * A ranked proportional bar list. One shared component keeps every report screen
 * visually consistent and avoids pulling in a charting library.
 */
function RankedBars({
  items,
  renderValue,
}: {
  items: Array<{ name: string; value: number; litres?: number }>;
  renderValue: (value: number) => React.ReactNode;
}) {
  const max = items.reduce((m, i) => Math.max(m, toAmount(i.value)), 0);

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.name}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-neutral-900">{item.name}</span>
            <span className="text-sm text-neutral-700">{renderValue(toAmount(item.value))}</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
            role="img"
            aria-label={`${item.name}: ${toAmount(item.value)}`}
          >
            <div
              className="bg-brand-500 h-full rounded-full"
              style={{ width: `${max > 0 ? (toAmount(item.value) / max) * 100 : 0}%` }}
            />
          </div>
          {item.litres !== undefined ? (
            <p className="mt-1 text-xs text-neutral-500">
              <QuantityDisplay value={item.litres} /> sold
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ExportButton({
  kind,
  range,
}: {
  kind: ReportKind;
  range: { from?: string; to?: string; branchId?: string };
}) {
  return (
    /* A download must be a plain navigation so Content-Disposition is honoured. */
    <a
      href={exportUrl(kind, range)}
      download={exportFilename(kind, range)}
      className={buttonVariants({ variant: 'outline' })}
    >
      <Download className="size-4" aria-hidden="true" />
      Export XLSX
    </a>
  );
}

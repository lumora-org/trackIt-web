'use client';

import { AlertTriangle, Banknote, Building2, ClipboardCheck, Fuel, Package } from 'lucide-react';

import { useAdminDashboard, useManagerDashboard } from '@/api/dashboard.api';
import { CurrencyDisplay, QuantityDisplay } from '@/components/ui/amount';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeading, StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { formatLitres, fullName } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Dashboard (PROMPT.md §31 step 6, §8).
 *
 * Two variants because the API documents two shapes: an admin/branch-wide summary
 * (`GET /dashboard/admin`) and a branch-scoped manager view
 * (`GET /dashboard/manager`). Both are backend-calculated — the frontend never
 * derives a total.
 *
 * PROMPT.md §8 asks for charts "where they genuinely help" but warns against
 * overloading the dashboard, so this shows stat tiles plus one ranked list rather
 * than a wall of charts. No chart library is pulled in yet (see ASSUMPTIONS.md).
 */
export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'MANAGER') return <ManagerDashboardView />;
  return <AdminDashboardView />;
}

function AdminDashboardView() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useAdminDashboard(true);

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const summary = data?.summary;
  const branches = data?.branches ?? [];
  const maxRevenue = branches.reduce((max, b) => Math.max(max, b.revenue), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500">Business-wide operational overview</p>
        </div>
        {user ? <Badge tone="brand">{fullName(user)}</Badge> : null}
      </header>

      {/* Stat grid: 1 column on the smallest phones, 2 from `sm`, 4 from `lg`. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          icon={Banknote}
          tone="brand"
          loading={isLoading}
          value={<CurrencyDisplay value={summary?.totalRevenue} compact />}
        />
        <StatCard
          label="Fuel Sold"
          icon={Fuel}
          tone="info"
          loading={isLoading}
          value={<QuantityDisplay value={summary?.totalFuelSoldLitres} />}
        />
        <StatCard
          label="Fuel Received"
          icon={Package}
          tone="success"
          loading={isLoading}
          value={<QuantityDisplay value={summary?.totalFuelReceivedLitres} />}
        />
        <StatCard
          label="Branches"
          icon={Building2}
          tone="neutral"
          loading={isLoading}
          value={summary?.totalBranches.toLocaleString('en-NG') ?? '—'}
          hint={
            summary && summary.lowInventoryBranches > 0
              ? `${summary.lowInventoryBranches} with low inventory`
              : undefined
          }
        />
      </div>

      {summary && summary.lowInventoryBranches > 0 ? (
        <div
          role="status"
          className="rounded-card border-warning-500/30 bg-warning-50 flex items-start gap-3 border px-4 py-3"
        >
          <AlertTriangle className="text-warning-700 mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-warning-700 text-sm">
            {summary.lowInventoryBranches} branch
            {summary.lowInventoryBranches === 1 ? '' : 'es'} reported low inventory. Review stock
            levels before the next delivery window.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Branch performance</CardTitle>
        </CardHeader>
        <CardBody className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : branches.length === 0 ? (
            <EmptyState
              title="No branch activity yet"
              description="Branch performance appears here once sales or deliveries are recorded."
              icon={Building2}
            />
          ) : (
            <ul className="space-y-4">
              {branches.map((branch) => (
                <li key={branch.branchId}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-neutral-900">
                      {branch.branchName}
                    </span>
                    <span className="text-sm text-neutral-700">
                      <CurrencyDisplay value={branch.revenue} />
                    </span>
                  </div>
                  {/* A single proportional bar reads faster than a chart axis. */}
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
                    role="img"
                    aria-label={`${branch.branchName}: ${Math.round(branch.revenue)} naira of revenue`}
                  >
                    <div
                      className="bg-brand-500 h-full rounded-full"
                      style={{
                        width: `${maxRevenue > 0 ? (branch.revenue / maxRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatLitres(branch.fuelSoldLitres)} sold
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ManagerDashboardView() {
  const { data, isLoading, error, refetch } = useManagerDashboard(true);
  const { activeBranch } = useBranchContext();

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const inventory = data?.inventory ?? [];
  const report = data?.dailyReport;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          {data?.branch.name ?? activeBranch?.name ?? 'Your branch'}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Today's Revenue"
          icon={Banknote}
          tone="brand"
          loading={isLoading}
          value={<CurrencyDisplay value={data?.today.revenue} compact />}
        />
        <StatCard
          label="Fuel Sold Today"
          icon={Fuel}
          tone="info"
          loading={isLoading}
          value={<QuantityDisplay value={data?.today.litresSold} />}
        />
      </div>

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle>Today&rsquo;s Daily Report</CardTitle>
            <StatusBadge domain="dailyReport" value={report.status} />
          </CardHeader>
          <CardBody>
            <p className="text-sm text-neutral-600">
              {report.status === 'DRAFT'
                ? 'Your daily report has not been submitted yet.'
                : report.status === 'REJECTED'
                  ? 'Your daily report was rejected. Update it and resubmit.'
                  : `Your daily report is ${report.status.toLowerCase().replace(/_/g, ' ')}.`}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current inventory</CardTitle>
        </CardHeader>
        <CardBody className="pt-4">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : inventory.length === 0 ? (
            <EmptyState
              title="No inventory yet"
              description="Stock appears here once an opening balance or delivery is recorded."
              icon={ClipboardCheck}
            />
          ) : (
            <>
              <SectionHeading title="By fuel type" />
              <ul className="space-y-3">
                {inventory.map((row) => (
                  <li
                    key={`${row.branchId}-${row.fuelTypeId}`}
                    className="flex items-baseline justify-between gap-3 border-b border-neutral-100 pb-3 last:border-0"
                  >
                    <span className="text-sm font-semibold text-neutral-900">
                      {row.fuelTypeName}
                    </span>
                    <QuantityDisplay value={row.currentQuantityLitres} className="text-sm" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

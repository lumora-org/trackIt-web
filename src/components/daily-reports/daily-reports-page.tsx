'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, Plus, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getSalesSummary, type SalesSummaryFilters } from '@/api/daily-reports.api';
import { isApiError } from '@/api/errors';
import {
  createIncidentReport,
  createIncidentReportSchema,
  getIncidentReport,
  INCIDENT_STATUS_FILTERS,
  listIncidentReports,
  reviewIncidentReport,
  type CreateIncidentReportValues,
  type IncidentReportFilters,
} from '@/api/incidents.api';
import { listSales } from '@/api/sales.api';
import { CurrencyDisplay, QuantityDisplay } from '@/components/ui/amount';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, Drawer } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { FilterSelect } from '@/components/shared/search-input';
import { DetailRow, SectionHeading } from '@/components/ui/stat-card';
import { ErrorState, InlineError, LoadingState } from '@/components/ui/states';
import { formatCount, formatDateTime, formatReportDate, todayIsoDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { invalidateForResource, queryKeys } from '@/lib/query-keys';
import type { DailySalesSummaryRow, IncidentReport } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Daily reports (product decision, 2026-10).
 *
 * The screen means one job per role, so the two can no longer be confused:
 *
 *  - A MANAGER keeps the incident log — exceptions only: stock variances,
 *    government vehicles collecting fuel without paying, equipment failures.
 *    Money is not entered here; the day's sales are the totals on the
 *    Record Sale screen.
 *  - An ADMIN reads the roll-up — the destination for every manager sale
 *    record. One row per (branch, business day) with the day's litres,
 *    revenue, its per-fuel split, the individual records and the branch's
 *    incidents; open incidents are reviewed from here.
 */
export function DailyReportsPage() {
  const { user } = useAuth();

  // The route and nav entry are shared, but a manager logs incidents while an
  // administrator consumes the roll-up of what managers recorded.
  if (user?.role === 'MANAGER') return <ManagerIncidentsView />;
  return <AdminRollupView />;
}

/* ------------------------------------------------- manager: incident log */

function ManagerIncidentsView() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canReport = can(user?.role, 'dailyReport.submit');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  // A notification deep-links straight to one incident (?incident=<id>).
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('incident'));

  const filters: IncidentReportFilters = {
    page,
    limit: 20,
    status: (statusFilter || undefined) as IncidentReportFilters['status'],
  };

  const listQuery = useQuery({
    queryKey: queryKeys.incidents.list(filters),
    queryFn: () => listIncidentReports(filters),
  });

  function closeDetail() {
    setSelectedId(null);
    // Drop the deep link so a refresh does not reopen the drawer.
    if (searchParams.get('incident')) router.replace('/daily-reports');
  }

  const columns: Column<IncidentReport>[] = [
    {
      key: 'incidentDate',
      header: 'Date',
      primary: true,
      render: (r) => <span className="font-medium">{formatReportDate(r.incidentDate)}</span>,
    },
    { key: 'title', header: 'Incident', secondary: true, render: (r) => r.title },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge domain="incident" value={r.status} />,
    },
    {
      key: 'reviewedBy',
      header: 'Reviewed by',
      mobileHidden: true,
      render: (r) =>
        r.status === 'REVIEWED' ? (
          <span className="text-sm text-neutral-600">{r.reviewedByName ?? 'Administrator'}</span>
        ) : (
          <span className="text-sm text-neutral-400">Awaiting review</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Incident Reports</h1>
          <p className="text-sm text-neutral-500">
            Log what happened at the branch — stock variances, government vehicles collecting fuel
            without paying, equipment failures. The day&rsquo;s sales are recorded from the Record
            Sale screen, not here.
          </p>
        </div>
        {canReport ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Report an incident
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <FilterSelect
          className="sm:w-52"
          label="Filter by status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={INCIDENT_STATUS_FILTERS}
        />
      </div>

      <DataTable
        caption="Incident reports"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading incident reports"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="No incidents reported"
        emptyDescription="Anything unusual — unpaid fuel, stock variances, faulty equipment — can be logged here for the administrators to review."
        emptyIcon={AlertTriangle}
        emptyAction={
          canReport
            ? { label: 'Report an incident', onClick: () => setCreateOpen(true) }
            : undefined
        }
      />

      <ReportIncidentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <IncidentDetailDrawer
        incidentId={selectedId}
        open={Boolean(selectedId)}
        onClose={closeDetail}
      />
    </div>
  );
}

function ReportIncidentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { activeBranchIds } = useBranchContext();
  const branchId = activeBranchIds[0];
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateIncidentReportValues>({
    resolver: zodResolver(createIncidentReportSchema),
    defaultValues: { incidentDate: todayIsoDate(), title: '', description: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateIncidentReportValues) =>
      createIncidentReport({
        branchId: branchId!,
        incidentDate: values.incidentDate || todayIsoDate(),
        title: values.title,
        description: values.description,
      }),
    onSuccess: () => {
      for (const key of invalidateForResource('incidents')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      closeDialog();
      reset();
    },
    onError: (err) => {
      setFormError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    },
  });

  function closeDialog() {
    setFormError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      title="Report an incident"
      description="Administrators are notified and will mark it reviewed once it has been handled."
      footer={
        <>
          <Button variant="outline" onClick={closeDialog} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            loadingText="Filing"
          >
            File report
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Input
          label="Date"
          type="date"
          max={todayIsoDate()}
          error={errors.incidentDate?.message}
          disabled={mutation.isPending}
          {...register('incidentDate')}
        />

        <Input
          label="Title"
          placeholder="Government vehicle left without paying"
          error={errors.title?.message}
          disabled={mutation.isPending}
          {...register('title')}
        />

        <Textarea
          label="What happened?"
          placeholder="e.g. Two vans from the state ministry filled 180 litres this morning and left without a receipt."
          description="Fuel type, litres and any vehicle or driver details you have."
          error={errors.description?.message}
          disabled={mutation.isPending}
          {...register('description')}
        />

        <p className="rounded-xl bg-neutral-100 px-3 py-2.5 text-xs text-neutral-600">
          This log is for exceptions — it does not record sales. Record the day&rsquo;s totals from
          the Record Sale screen.
        </p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------- admin: sales roll-up */

/** `YYYY-MM-DD` for N days before today — mirrors the endpoint's default window. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function AdminRollupView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBranchIds, activeBusinessId } = useBranchContext();

  const [page, setPage] = useState(1);
  // The endpoint defaults to 30 days; keep the inputs honest about that.
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(todayIsoDate());
  const [selectedDay, setSelectedDay] = useState<DailySalesSummaryRow | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    searchParams.get('incident'),
  );

  // The header's branch switcher narrows the roll-up; "all branches" keeps it open.
  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const filters: SalesSummaryFilters = {
    page,
    limit: 30,
    branchId,
    businessId: activeBusinessId ?? undefined,
    from,
    to,
  };

  const summaryQuery = useQuery({
    queryKey: queryKeys.dailyReports.summary(filters),
    queryFn: () => getSalesSummary(filters),
  });

  function closeIncident() {
    setSelectedIncidentId(null);
    if (searchParams.get('incident')) router.replace('/daily-reports');
  }

  const columns: Column<DailySalesSummaryRow>[] = [
    {
      key: 'date',
      header: 'Date',
      primary: true,
      render: (r) => <span className="font-medium">{formatReportDate(r.date)}</span>,
    },
    {
      key: 'branch',
      header: 'Branch',
      secondary: true,
      render: (r) => r.branchName ?? r.branchId,
    },
    {
      key: 'totalLitres',
      header: 'Fuel sold',
      align: 'right',
      render: (r) => <QuantityDisplay value={r.totalLitres} />,
    },
    {
      key: 'totalRevenue',
      header: 'Revenue',
      align: 'right',
      render: (r) => <CurrencyDisplay value={r.totalRevenue} />,
    },
    {
      key: 'saleCount',
      header: 'Records',
      align: 'right',
      mobileHidden: true,
      render: (r) => formatCount(r.saleCount),
    },
    {
      key: 'incidents',
      header: 'Incidents',
      render: (r) =>
        r.incidentCount > 0 ? (
          <Badge tone={r.openIncidentCount > 0 ? 'warning' : 'neutral'}>
            {r.incidentCount}
            {r.openIncidentCount > 0 ? ` · ${r.openIncidentCount} open` : ''}
          </Badge>
        ) : (
          <span className="text-sm text-neutral-400">None</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Daily Reports</h1>
        <p className="text-sm text-neutral-500">
          The destination for every sale record from branch managers — one row per branch per day,
          with its revenue, sale records and incidents.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <Input
            label="From"
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-44">
          <Input
            label="To"
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <DataTable
        caption="Daily sales roll-up"
        columns={columns}
        data={summaryQuery.data?.data ?? []}
        rowKey={(r) => `${r.branchId}:${r.date}`}
        loading={summaryQuery.isLoading}
        loadingLabel="Loading daily sales"
        error={summaryQuery.error?.message ?? null}
        onRetry={() => summaryQuery.refetch()}
        meta={summaryQuery.data?.meta ?? null}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedDay(row)}
        emptyTitle="No sale records in this window"
        emptyDescription="When managers record a day's totals on the Record Sale screen, each branch-day appears here."
        emptyIcon={ClipboardCheck}
      />

      <BranchDayDrawer
        row={selectedDay}
        onClose={() => setSelectedDay(null)}
        onOpenIncident={(id) => {
          setSelectedDay(null);
          setSelectedIncidentId(id);
        }}
      />
      <IncidentDetailDrawer
        incidentId={selectedIncidentId}
        open={Boolean(selectedIncidentId)}
        onClose={closeIncident}
      />
    </div>
  );
}

/**
 * The drill-down behind one roll-up row: the day's per-fuel split, every
 * record that built it and the branch's incidents for that day.
 */
function BranchDayDrawer({
  row,
  onClose,
  onOpenIncident,
}: {
  row: DailySalesSummaryRow | null;
  onClose: () => void;
  onOpenIncident: (incidentId: string) => void;
}) {
  const branchId = row?.branchId ?? '';
  const date = row?.date ?? '';

  const salesQuery = useQuery({
    queryKey: queryKeys.sales.list({ branchId, from: date, to: date, limit: 50 }),
    queryFn: () => listSales({ branchId, from: date, to: date, limit: 50 }),
    enabled: Boolean(row),
  });

  const incidentsQuery = useQuery({
    queryKey: queryKeys.incidents.list({ branchId, from: date, to: date, limit: 50 }),
    queryFn: () => listIncidentReports({ branchId, from: date, to: date, limit: 50 }),
    enabled: Boolean(row),
  });

  // Voided rows are excluded from the roll-up, so they are excluded here too.
  const sales = (salesQuery.data?.data ?? []).filter((sale) => !sale.voidedAt);
  const incidents = incidentsQuery.data?.data ?? [];

  return (
    <Drawer
      open={Boolean(row)}
      onClose={onClose}
      title={row ? `${row.branchName ?? 'Branch'} · ${formatReportDate(row.date)}` : 'Branch day'}
    >
      {row ? (
        <div className="space-y-6">
          <section>
            <SectionHeading title="Day totals" />
            <dl>
              <DetailRow
                label="Fuel sold"
                value={<QuantityDisplay value={row.totalLitres} />}
                emphasis
              />
              <DetailRow
                label="Revenue"
                value={<CurrencyDisplay value={row.totalRevenue} />}
                emphasis
              />
              <DetailRow label="Sale records" value={formatCount(row.saleCount)} />
            </dl>
          </section>

          {row.fuels.length > 0 ? (
            <section>
              <SectionHeading title="By fuel" />
              <dl>
                {row.fuels.map((fuel) => (
                  <DetailRow
                    key={fuel.fuelTypeId}
                    label={fuel.fuelTypeName ?? 'Fuel'}
                    value={
                      <span className="inline-flex items-baseline gap-2">
                        <QuantityDisplay value={fuel.litresSold} />
                        <CurrencyDisplay value={fuel.revenue} />
                      </span>
                    }
                  />
                ))}
              </dl>
            </section>
          ) : null}

          <section>
            <SectionHeading title="Sale records" />
            {salesQuery.isLoading ? (
              <LoadingState label="Loading records" />
            ) : salesQuery.isError ? (
              <ErrorState message={salesQuery.error.message} onRetry={() => salesQuery.refetch()} />
            ) : sales.length === 0 ? (
              <p className="text-sm text-neutral-500">No active records for this day.</p>
            ) : (
              <ul className="space-y-2">
                {sales.map((sale) => (
                  <li
                    key={sale.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2.5"
                  >
                    <span>
                      <span className="block font-mono text-xs text-neutral-500">
                        {sale.saleNumber}
                      </span>
                      <span className="block text-sm text-neutral-800">
                        <QuantityDisplay value={sale.litresSold} /> ·{' '}
                        <CurrencyDisplay value={sale.totalAmount} />
                      </span>
                    </span>
                    <StatusBadge domain="saleRecordMode" value={sale.recordMode ?? 'SINGLE'} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHeading title="Incidents" />
            {incidentsQuery.isLoading ? (
              <LoadingState label="Loading incidents" />
            ) : incidents.length === 0 ? (
              <p className="text-sm text-neutral-500">No incidents reported for this day.</p>
            ) : (
              <ul className="space-y-2">
                {incidents.map((incident) => (
                  <li key={incident.id}>
                    <button
                      type="button"
                      onClick={() => onOpenIncident(incident.id)}
                      className="focus:ring-brand-500 w-full rounded-xl bg-neutral-50 px-3 py-2.5 text-left hover:bg-neutral-100 focus:ring-2 focus:outline-none"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-800">
                          {incident.title}
                        </span>
                        <StatusBadge domain="incident" value={incident.status} />
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        Reported by {incident.reportedByName ?? '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

/* ---------------------------------------------- shared: incident detail */

function IncidentDetailDrawer({
  incidentId,
  open,
  onClose,
}: {
  incidentId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // The admin report-review capability covers incident acknowledgement too.
  const canReview = can(user?.role, 'dailyReport.review');
  const [actionError, setActionError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: queryKeys.incidents.detail(incidentId ?? ''),
    queryFn: () => getIncidentReport(incidentId!),
    enabled: open && Boolean(incidentId),
  });

  const incident = detailQuery.data;

  const review = useMutation({
    mutationFn: () => reviewIncidentReport(incident!.id),
    onSuccess: () => {
      for (const key of invalidateForResource('incidents')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(incidentId ?? ''),
      });
      setActionError(null);
    },
    onError: (err) => {
      setActionError(isApiError(err) ? err.message : 'That action could not be completed.');
    },
  });

  return (
    <Drawer
      open={open}
      onClose={() => {
        setActionError(null);
        onClose();
      }}
      title={incident ? incident.title : 'Incident report'}
    >
      {detailQuery.isLoading ? <LoadingState label="Loading incident" /> : null}
      {detailQuery.isError ? (
        <ErrorState message={detailQuery.error.message} onRetry={() => detailQuery.refetch()} />
      ) : null}

      {incident ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge domain="incident" value={incident.status} />
            <span className="text-xs text-neutral-500">
              {formatReportDate(incident.incidentDate)}
            </span>
          </div>

          <section>
            <SectionHeading title="What happened" />
            <p className="rounded-xl bg-neutral-100 px-3 py-2.5 text-sm whitespace-pre-wrap text-neutral-700">
              {incident.description}
            </p>
          </section>

          <section>
            <SectionHeading title="Record" />
            <dl>
              {incident.branchName ? (
                <DetailRow label="Branch" value={incident.branchName} />
              ) : null}
              <DetailRow label="Reported by" value={incident.reportedByName ?? '—'} />
              <DetailRow label="Reported on" value={formatDateTime(incident.createdAt)} />
              {incident.reviewedAt ? (
                <>
                  <DetailRow label="Reviewed by" value={incident.reviewedByName ?? '—'} />
                  <DetailRow label="Reviewed on" value={formatDateTime(incident.reviewedAt)} />
                </>
              ) : null}
            </dl>
          </section>

          {actionError ? <InlineError message={actionError} /> : null}

          {canReview && incident.status === 'OPEN' ? (
            <section className="border-t border-neutral-200 pt-4">
              <Button
                block
                loading={review.isPending}
                loadingText="Marking reviewed"
                onClick={() => review.mutate()}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Mark reviewed
              </Button>
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

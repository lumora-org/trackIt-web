'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import {
  approveDailyReport,
  createDailyReport,
  createDailyReportSchema,
  getDailyReport,
  listDailyReports,
  reconcileReport,
  rejectDailyReport,
  REPORT_STATUS_FILTERS,
  resubmitDailyReport,
  submitDailyReport,
  type CreateDailyReportValues,
  type DailyReportFilters,
} from '@/api/daily-reports.api';
import { CurrencyDisplay, QuantityDisplay } from '@/components/ui/amount';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import type { Column } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, Drawer } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { FilterSelect } from '@/components/shared/search-input';
import { DetailRow, SectionHeading } from '@/components/ui/stat-card';
import { ErrorState, InlineError, LoadingState } from '@/components/ui/states';
import { formatReportDate, todayIsoDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { invalidateForResource, queryKeys } from '@/lib/query-keys';
import { DAILY_REPORT_TRANSITIONS, type DailyReport } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Daily reports (PROMPT.md §31 step 15, §14).
 *
 * A manager's daily report is deliberately simple: the backend calculates every
 * figure, the manager adds optional notes and submits. An administrator reviews.
 *
 * doc 03 §56 — a report is unique per (branch, date), so a rejected report is
 * resubmitted rather than recreated.
 */
export function DailyReportsPage() {
  const { user } = useAuth();
  const { activeBranchIds } = useBranchContext();
  const canSubmit = can(user?.role, 'dailyReport.submit');
  const canReview = can(user?.role, 'dailyReport.review');

  const branchId = activeBranchIds.length === 1 ? activeBranchIds[0] : undefined;

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters: DailyReportFilters = {
    page,
    limit: 20,
    branchId,
    status: (statusFilter || undefined) as DailyReportFilters['status'],
  };

  const listQuery = useQuery({
    queryKey: queryKeys.dailyReports.list(filters),
    queryFn: () => listDailyReports(filters),
  });

  const columns: Column<DailyReport>[] = [
    {
      key: 'reportDate',
      header: 'Date',
      primary: true,
      render: (r) => <span className="font-medium">{formatReportDate(r.reportDate)}</span>,
    },
    {
      key: 'totalSoldLitres',
      header: 'Fuel sold',
      align: 'right',
      secondary: true,
      render: (r) => <QuantityDisplay value={r.totalSoldLitres} />,
    },
    {
      key: 'totalReceivedLitres',
      header: 'Received',
      align: 'right',
      render: (r) => <QuantityDisplay value={r.totalReceivedLitres} />,
    },
    {
      key: 'closingStockLitres',
      header: 'Closing',
      align: 'right',
      render: (r) => <QuantityDisplay value={r.closingStockLitres} />,
    },
    {
      key: 'totalRevenue',
      header: 'Revenue',
      align: 'right',
      render: (r) => <CurrencyDisplay value={r.totalRevenue} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge domain="dailyReport" value={r.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Daily Reports</h1>
          <p className="text-sm text-neutral-500">
            {canReview
              ? 'Review the daily reports submitted by your branch managers.'
              : 'Submit a daily summary for your branch. All figures are calculated for you.'}
          </p>
        </div>
        {canSubmit ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New daily report
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
          options={REPORT_STATUS_FILTERS}
        />
      </div>

      <DataTable
        caption="Daily reports"
        columns={columns}
        data={listQuery.data?.data ?? []}
        rowKey={(r) => r.id}
        loading={listQuery.isLoading}
        loadingLabel="Loading daily reports"
        error={listQuery.error?.message ?? null}
        onRetry={() => listQuery.refetch()}
        meta={listQuery.data?.meta ?? null}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedId(row.id)}
        emptyTitle="No daily reports yet"
        emptyDescription={
          canSubmit
            ? 'Create a daily report to summarise your branch activity for a day.'
            : 'No reports have been submitted for this branch yet.'
        }
        emptyIcon={ClipboardCheck}
        emptyAction={
          canSubmit ? { label: 'New daily report', onClick: () => setCreateOpen(true) } : undefined
        }
      />

      <CreateDailyReportDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <DailyReportDetailDrawer
        reportId={selectedId}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- create */

function CreateDailyReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { activeBranchIds } = useBranchContext();
  const branchId = activeBranchIds[0];
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateDailyReportValues>({
    resolver: zodResolver(createDailyReportSchema),
    defaultValues: { reportDate: todayIsoDate(), managerNotes: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateDailyReportValues) =>
      createDailyReport({ ...values, branchId: branchId! }),
    onSuccess: () => {
      for (const key of invalidateForResource('dailyReports')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        // doc 03 §56 — a duplicate (branch, date) surfaces as 409.
        const dateError = err.fieldError('reportDate');
        if (dateError) setError('reportDate', { message: dateError });
        setFormError(dateError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New daily report"
      description="Opening stock, fuel received, fuel sold, closing stock and revenue are calculated by the server."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            loadingText="Creating"
          >
            Create report
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Input
          label="Report date"
          type="date"
          max={todayIsoDate()}
          error={errors.reportDate?.message}
          disabled={mutation.isPending}
          {...register('reportDate')}
        />

        <Textarea
          label="Notes"
          placeholder="Normal business operations."
          description="Optional context for the administrator reviewing this report."
          error={errors.managerNotes?.message}
          disabled={mutation.isPending}
          {...register('managerNotes')}
        />

        <p className="rounded-xl bg-neutral-100 px-3 py-2.5 text-xs text-neutral-600">
          The report is created as a draft. You can review the figures before submitting.
        </p>
      </div>
    </Dialog>
  );
}

/* -------------------------------------------------------------- detail */

function DailyReportDetailDrawer({
  reportId,
  open,
  onClose,
}: {
  reportId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canSubmit = can(user?.role, 'dailyReport.submit');
  const canReview = can(user?.role, 'dailyReport.review');

  const [actionError, setActionError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const detailQuery = useQuery({
    queryKey: queryKeys.dailyReports.detail(reportId ?? ''),
    queryFn: () => getDailyReport(reportId!),
    enabled: open && Boolean(reportId),
  });

  const report = detailQuery.data;
  const reconciliation = report ? reconcileReport(report) : null;

  const transition = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'reject' | 'resubmit') => {
      if (!report) throw new Error('No report loaded.');
      switch (action) {
        case 'submit':
          return submitDailyReport(report.id);
        case 'approve':
          return approveDailyReport(report.id);
        case 'reject':
          return rejectDailyReport(report.id, reason.trim());
        case 'resubmit':
          return resubmitDailyReport(report.id);
      }
    },
    onSuccess: () => {
      for (const key of invalidateForResource('dailyReports')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dailyReports.detail(reportId ?? ''),
      });
      setActionError(null);
      setRejecting(false);
      setReason('');
    },
    onError: (err) => {
      setActionError(isApiError(err) ? err.message : 'That action could not be completed.');
    },
  });

  const allowed = report ? DAILY_REPORT_TRANSITIONS[report.status] : [];

  return (
    <Drawer
      open={open}
      onClose={() => {
        setRejecting(false);
        setReason('');
        onClose();
      }}
      title={report ? `Report for ${formatReportDate(report.reportDate)}` : 'Daily report'}
    >
      {detailQuery.isLoading ? <LoadingState label="Loading report" /> : null}
      {detailQuery.isError ? (
        <ErrorState message={detailQuery.error.message} onRetry={() => detailQuery.refetch()} />
      ) : null}

      {report ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge domain="dailyReport" value={report.status} />
            {report.reviewedAt ? <span className="text-xs text-neutral-500">Reviewed</span> : null}
          </div>

          {/* doc 04 §66 — every figure below came from the server. */}
          <section>
            <SectionHeading title="Summary" />
            <dl>
              <DetailRow
                label="Opening stock"
                value={<QuantityDisplay value={report.openingStockLitres} />}
              />
              <DetailRow
                label="Fuel received"
                value={<QuantityDisplay value={report.totalReceivedLitres} />}
              />
              <DetailRow
                label="Fuel sold"
                value={<QuantityDisplay value={report.totalSoldLitres} />}
              />
              <DetailRow
                label="Closing stock"
                value={<QuantityDisplay value={report.closingStockLitres} />}
                emphasis
              />
              <DetailRow
                label="Revenue"
                value={<CurrencyDisplay value={report.totalRevenue} />}
                emphasis
              />
            </dl>
          </section>

          {/*
            doc 03 §58 — Opening + Received − Sold = Closing. No discrepancy
            column exists in doc 03, so the check is surfaced in the UI rather
            than stored (ASSUMPTIONS.md §3.5 family).
          */}
          {reconciliation && !reconciliation.balanced ? (
            <div
              role="alert"
              className="rounded-card border-warning-500/30 bg-warning-50 flex items-start gap-3 border px-4 py-3"
            >
              <AlertTriangle
                className="text-warning-700 mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-warning-700 text-sm">
                The figures do not reconcile: opening + received − sold is{' '}
                {reconciliation.computedClosing.toLocaleString('en-NG')} L but closing stock is{' '}
                {report.closingStockLitres.toLocaleString('en-NG')} L. This usually reflects
                unrecorded adjustments.
              </p>
            </div>
          ) : null}

          {report.managerNotes ? (
            <section>
              <SectionHeading title="Manager notes" />
              <p className="rounded-xl bg-neutral-100 px-3 py-2.5 text-sm text-neutral-700">
                {report.managerNotes}
              </p>
            </section>
          ) : null}

          {report.rejectionReason ? (
            <section>
              <SectionHeading title="Rejection reason" />
              <p className="border-danger-500/30 bg-danger-50 text-danger-700 rounded-xl border px-3 py-2.5 text-sm">
                {report.rejectionReason}
              </p>
            </section>
          ) : null}

          {actionError ? <InlineError message={actionError} /> : null}

          {/* -------------------------------------------------------- actions */}
          <section className="space-y-2 border-t border-neutral-200 pt-4">
            {canSubmit && allowed.includes('SUBMITTED') ? (
              <Button
                block
                loading={transition.isPending}
                loadingText="Submitting"
                onClick={() => transition.mutate('submit')}
              >
                <Send className="size-4" aria-hidden="true" />
                Submit report
              </Button>
            ) : null}

            {canSubmit && allowed.includes('DRAFT') && report.status === 'REJECTED' ? (
              <Button
                block
                variant="secondary"
                loading={transition.isPending}
                loadingText="Resubmitting"
                onClick={() => transition.mutate('resubmit')}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Resubmit for review
              </Button>
            ) : null}

            {canReview && allowed.includes('APPROVED') ? (
              <Button
                block
                loading={transition.isPending}
                loadingText="Approving"
                onClick={() => transition.mutate('approve')}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Approve report
              </Button>
            ) : null}

            {canReview && allowed.includes('REJECTED') ? (
              rejecting ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Reject this report</CardTitle>
                    <Badge tone="danger">Reason required</Badge>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <Textarea
                      label="Rejection reason"
                      placeholder="Closing stock does not match the physical stock count."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={transition.isPending}
                      required
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setRejecting(false)}
                        disabled={transition.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={reason.trim().length === 0}
                        loading={transition.isPending}
                        loadingText="Rejecting"
                        onClick={() => transition.mutate('reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <Button variant="outline" block onClick={() => setRejecting(true)}>
                  <XCircle className="size-4" aria-hidden="true" />
                  Reject report
                </Button>
              )
            ) : null}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

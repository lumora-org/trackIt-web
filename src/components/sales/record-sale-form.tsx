'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { useState } from 'react';

import { isApiError } from '@/api/errors';
import { listFuelTypes } from '@/api/fuel-types.api';
import { listFuelPrices } from '@/api/fuel-prices.api';
import { estimateTotal, listSales, recordDayTotal } from '@/api/sales.api';
import { CurrencyDisplay, PricePerLitreDisplay, QuantityDisplay } from '@/components/ui/amount';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Drawer } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InlineError, Skeleton } from '@/components/ui/states';
import { formatLitres, todayIsoDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { invalidateForResource, queryKeys } from '@/lib/query-keys';
import type { FuelType, Sale } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Record the day's sales (product decision, 2026-10).
 *
 * The manager does not log each counter transaction. They enter the branch's
 * TOTAL litres sold for one fuel on the current business day and revise that
 * figure as the day goes on. The backend books only the difference between the
 * previous figure and the new one (POST /sales/day-total), so stock stays
 * exact without re-posting the whole day. `0` clears the day and returns the
 * litres to stock.
 */
export function RecordSalePanel() {
  const { user } = useAuth();
  const { activeBranch, activeBranchIds } = useBranchContext();
  const canRecord = can(user?.role, 'sales.record');

  // doc 06 §5 — a manager is pinned to their branch.
  const branchId = activeBranch?.id ?? activeBranchIds[0] ?? '';

  const [open, setOpen] = useState(false);
  const today = todayIsoDate();

  // Today's recorded totals, so the panel summarises before the drawer opens.
  const todayQuery = useQuery({
    queryKey: queryKeys.sales.list({
      branchId,
      recordMode: 'DAY_TOTAL',
      from: today,
      to: today,
    }),
    queryFn: () =>
      listSales({ branchId, recordMode: 'DAY_TOTAL', from: today, to: today, limit: 50 }),
    enabled: canRecord && Boolean(branchId),
    staleTime: 15_000,
  });

  if (!canRecord) return null;

  if (!branchId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-neutral-600">Select a branch before recording sales.</p>
        </CardBody>
      </Card>
    );
  }

  const recorded = (todayQuery.data?.data ?? []).filter((sale) => !sale.voidedAt);
  const totalLitres = recorded.reduce((sum, sale) => sum + Number(sale.litresSold), 0);

  return (
    <>
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-500">Quick action</p>
            <p className="text-base font-semibold text-neutral-900">
              Record today&rsquo;s sales at {activeBranch?.name ?? 'this branch'}
            </p>
            <p className="mt-0.5 text-sm text-neutral-600">
              {todayQuery.isLoading ? (
                <Skeleton className="h-4 w-48" />
              ) : recorded.length > 0 ? (
                <>
                  Recorded today: {formatLitres(totalLitres)} across {recorded.length}{' '}
                  {recorded.length === 1 ? 'fuel' : 'fuels'}. Update the totals as the day goes on.
                </>
              ) : (
                'No sales recorded yet today. Enter the running totals for each fuel.'
              )}
            </p>
          </div>
          <Button size="lg" onClick={() => setOpen(true)}>
            <ShoppingCart className="size-5" aria-hidden="true" />
            Record Sale
          </Button>
        </CardBody>
      </Card>

      {open ? (
        <Drawer open={open} onClose={() => setOpen(false)} title="Record today's sales">
          <DayTotalsForm branchId={branchId} />
        </Drawer>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ day totals */

function DayTotalsForm({ branchId }: { branchId: string }) {
  const today = todayIsoDate();

  const fuelTypesQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ activeOnly: true }),
    queryFn: () => listFuelTypes({ limit: 100, status: 'ACTIVE' }),
    staleTime: 10 * 60_000,
  });

  const todayQuery = useQuery({
    queryKey: queryKeys.sales.list({
      branchId,
      recordMode: 'DAY_TOTAL',
      from: today,
      to: today,
    }),
    queryFn: () =>
      listSales({ branchId, recordMode: 'DAY_TOTAL', from: today, to: today, limit: 50 }),
  });

  // doc 08 §33 — the price in force right now, per fuel, so a mid-day admin
  // change is visible on the manager's side the moment the drawer opens. No
  // staleTime: the drawer remounts on every open and refetches.
  const pricesQuery = useQuery({
    queryKey: queryKeys.fuelPrices.list({ active: true, limit: 100 }),
    queryFn: () => listFuelPrices({ active: true, limit: 100 }),
  });

  const fuels = fuelTypesQuery.data?.data ?? [];
  const currentPriceByFuel = new Map(
    (pricesQuery.data?.data ?? []).map((price) => [price.fuelTypeId, price.pricePerLitre]),
  );
  const recordedByFuel = new Map(
    (todayQuery.data?.data ?? [])
      .filter((sale) => !sale.voidedAt)
      .map((sale) => [sale.fuelTypeId, sale]),
  );

  if (fuelTypesQuery.isLoading || todayQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Enter the total litres sold today for each fuel — revise the figure as the day goes on.
        The system books only the difference, so stock stays exact.
      </p>

      {fuels.length === 0 ? (
        <p className="text-sm text-neutral-500">No active fuel types are configured.</p>
      ) : (
        fuels.map((fuel) => (
          <DayTotalRow
            key={fuel.id}
            branchId={branchId}
            fuel={fuel}
            existing={recordedByFuel.get(fuel.id)}
            currentPrice={currentPriceByFuel.get(fuel.id) ?? null}
          />
        ))
      )}
    </div>
  );
}

function DayTotalRow({
  branchId,
  fuel,
  existing,
  currentPrice,
}: {
  branchId: string;
  fuel: FuelType;
  existing: Sale | undefined;
  currentPrice: number | null;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(() =>
    existing ? String(Number(existing.litresSold)) : '',
  );
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const parsed = value.trim() === '' ? null : Number(value);
  const valid =
    parsed !== null && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000;
  const recordedLitres = existing ? Number(existing.litresSold) : 0;
  // An unchanged figure (including 0 on a day with no record) is a no-op.
  const unchanged = valid && parsed === recordedLitres;

  const mutation = useMutation({
    mutationFn: () => recordDayTotal({ branchId, fuelTypeId: fuel.id, totalLitres: parsed! }),
    onSuccess: () => {
      for (const key of invalidateForResource('sales')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      setSaved(true);
      setFormError(null);
    },
    onError: (err) => {
      setSaved(false);
      setFormError(isApiError(err) ? err.message : 'Unable to save this figure.');
    },
  });

  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-neutral-900">
          <span className="font-mono font-bold">{fuel.code}</span>
          <span className="ml-1.5 font-normal text-neutral-500">{fuel.name}</span>
        </p>
        <p className="text-xs text-neutral-500">
          {currentPrice !== null ? (
            <>
              Price now: <PricePerLitreDisplay value={currentPrice} className="text-xs" /> ·{' '}
            </>
          ) : null}
          {existing ? (
            <>
              Recorded: <QuantityDisplay value={existing.litresSold} className="text-xs" /> ·{' '}
              <CurrencyDisplay value={existing.totalAmount} className="text-xs" />
              {existing.approvalStatus && existing.approvalStatus !== 'APPROVED' ? (
                <>
                  {' '}
                  <StatusBadge domain="saleApproval" value={existing.approvalStatus} size="sm" />
                </>
              ) : null}
            </>
          ) : (
            'Not recorded yet today'
          )}
        </p>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <Input
          label={`Total litres for ${fuel.code} today`}
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          placeholder="0"
          value={value}
          disabled={mutation.isPending}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
            setFormError(null);
          }}
        />
        <Button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!valid || unchanged}
          loading={mutation.isPending}
          loadingText="Saving"
        >
          {saved && !mutation.isPending ? (
            <CheckCircle2 className="text-success-700 size-4" aria-hidden="true" />
          ) : null}
          {saved && !mutation.isPending ? 'Saved' : 'Save'}
        </Button>
      </div>

      {valid && parsed !== null && parsed > 0 && currentPrice !== null && !existing ? (
        <p className="mt-1.5 text-xs text-neutral-500">
          Estimated total:{' '}
          <CurrencyDisplay value={estimateTotal(parsed, currentPrice)} className="text-xs" /> at the
          current price — the server prices the sale when you save.
        </p>
      ) : null}

      {existing?.approvalStatus === 'REJECTED' && existing.rejectionReason ? (
        <p className="text-danger-700 mt-1.5 text-xs">
          Rejected: {existing.rejectionReason} — revise the figure to submit it for approval again.
        </p>
      ) : null}

      {valid && parsed === 0 && existing ? (
        <p className="text-warning-700 mt-1.5 text-xs">
          Setting 0 clears today&rsquo;s record and returns its litres to stock.
        </p>
      ) : null}

      {formError ? <InlineError message={formError} className="mt-1.5" /> : null}
    </div>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Plus, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import {
  applicablePrice,
  createFuelPrice,
  createFuelPriceSchema,
  isScheduled,
  listFuelPrices,
  type CreateFuelPriceInput,
} from '@/api/fuel-prices.api';
import { listFuelTypes } from '@/api/fuel-types.api';
import { PricePerLitreDisplay } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, ErrorState, InlineError, Skeleton } from '@/components/ui/states';
import { formatDate, todayIsoDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import type { FuelType } from '@/types/domain';
import { useAuth } from '@/providers/auth-provider';

/**
 * Fuel pricing (PROMPT.md §31 step 8, §13).
 *
 * Prices are historical and effective-dated, so this screen is built around the
 * three states a price can be in: current, scheduled (future), and historical.
 *
 * The backend is authoritative for pricing (doc 08 §33). Nothing here computes a
 * sale price — it only displays intervals the API returned.
 */
export function FuelPricesPage() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'fuelPrice.manage');

  const [selectedFuelId, setSelectedFuelId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const fuelTypesQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ activeOnly: true }),
    queryFn: () => listFuelTypes({ limit: 100, status: 'ACTIVE' }),
  });

  const fuelTypes = fuelTypesQuery.data?.data ?? [];
  const activeFuelId = selectedFuelId ?? fuelTypes[0]?.id ?? null;

  const pricesQuery = useQuery({
    queryKey: queryKeys.fuelPrices.list({ fuelTypeId: activeFuelId }),
    queryFn: () => listFuelPrices({ fuelTypeId: activeFuelId ?? undefined, limit: 100 }),
    enabled: Boolean(activeFuelId),
  });

  const prices = useMemo(() => pricesQuery.data?.data ?? [], [pricesQuery.data]);
  const current = useMemo(() => applicablePrice(prices), [prices]);
  const scheduled = useMemo(() => prices.filter((p) => isScheduled(p)), [prices]);
  const history = useMemo(
    () =>
      prices
        .filter((p) => !isScheduled(p) && p.id !== current?.id)
        .sort((a, b) => +new Date(b.effectiveFrom) - +new Date(a.effectiveFrom)),
    [prices, current],
  );

  if (fuelTypesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (fuelTypes.length === 0) {
    return (
      <EmptyState
        title="No fuel types configured"
        description="Add a fuel type before setting prices."
        icon={TrendingUp}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Fuel Prices</h1>
          <p className="text-sm text-neutral-500">
            Prices are effective-dated. A change never rewrites past sales.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Set price
          </Button>
        ) : null}
      </header>

      {/* Fuel switcher — three at a time on mobile, wrapping rather than scrolling. */}
      <div role="tablist" aria-label="Fuel type" className="flex flex-wrap gap-2">
        {fuelTypes.map((fuel) => {
          const selected = fuel.id === activeFuelId;
          return (
            <button
              key={fuel.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSelectedFuelId(fuel.id)}
              className={`min-h-touch focus-visible:outline-brand-600 rounded-xl px-4 font-mono text-sm font-semibold transition-colors focus-visible:outline-2 ${
                selected
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50'
              }`}
            >
              {fuel.code}
            </button>
          );
        })}
      </div>

      {pricesQuery.isError ? (
        <ErrorState message={pricesQuery.error.message} onRetry={() => pricesQuery.refetch()} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Current price</CardTitle>
              {current ? (
                <Badge tone="success">Effective since {formatDate(current.effectiveFrom)}</Badge>
              ) : null}
            </CardHeader>
            <CardBody>
              {pricesQuery.isLoading ? (
                <Skeleton className="h-10 w-40" />
              ) : current ? (
                <PricePerLitreDisplay
                  value={current.pricePerLitre}
                  className="text-3xl font-bold text-neutral-900"
                />
              ) : (
                <p className="text-sm text-neutral-600">
                  No price is currently in effect for this fuel type.
                </p>
              )}
            </CardBody>
          </Card>

          {/*
            PROMPT.md §13 — warn users about scheduled/future pricing so nobody
            is surprised when tomorrow's sales are priced differently.
          */}
          {scheduled.length > 0 ? (
            <div
              role="status"
              className="rounded-card border-info-500/30 bg-info-50 border px-4 py-3"
            >
              <p className="text-info-700 text-sm font-semibold">Scheduled price change</p>
              <ul className="mt-1 space-y-1">
                {scheduled.map((price) => (
                  <li key={price.id} className="text-info-700 text-sm">
                    <PricePerLitreDisplay value={price.pricePerLitre} /> takes effect{' '}
                    {formatDate(price.effectiveFrom)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Price history</CardTitle>
              <History className="size-4 text-neutral-400" aria-hidden="true" />
            </CardHeader>
            <CardBody className="pt-4">
              {pricesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : history.length === 0 ? (
                <EmptyState
                  title="No price history yet"
                  description="Previous prices appear here once a price is changed."
                  icon={History}
                />
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {history.map((price) => (
                    <li
                      key={price.id}
                      className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {formatDate(price.effectiveFrom)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {price.effectiveTo
                            ? `until ${formatDate(price.effectiveTo)}`
                            : 'open ended'}
                        </p>
                      </div>
                      <PricePerLitreDisplay
                        value={price.pricePerLitre}
                        className="text-sm font-semibold text-neutral-700"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <SetPriceDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        fuelTypes={fuelTypes}
        defaultFuelTypeId={activeFuelId}
        currentPrice={current?.pricePerLitre ?? null}
      />
    </div>
  );
}

/* --------------------------------------------------------------- form */

function SetPriceDialog({
  open,
  onClose,
  fuelTypes,
  defaultFuelTypeId,
  currentPrice,
}: {
  open: boolean;
  onClose: () => void;
  fuelTypes: FuelType[];
  defaultFuelTypeId: string | null;
  currentPrice: number | null;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreateFuelPriceInput>({
    resolver: zodResolver(createFuelPriceSchema),
    defaultValues: {
      fuelTypeId: defaultFuelTypeId ?? '',
      pricePerLitre: currentPrice ?? undefined,
      effectiveFrom: todayIsoDate(),
    },
  });

  const effectiveFrom = watch('effectiveFrom');
  const isFuture = effectiveFrom ? effectiveFrom > todayIsoDate() : false;

  const mutation = useMutation({
    mutationFn: createFuelPrice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelPrices.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.list() });
      onClose();
      reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        const priceError = err.fieldError('pricePerLitre');
        if (priceError) setError('pricePerLitre', { message: priceError });
        // doc 04 §9 — INVALID_FUEL_PRICE means the period overlaps an existing one.
        setFormError(priceError ? null : err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Set fuel price"
      description="This takes effect from the date you choose. Sales before then keep their original price."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            loadingText="Saving"
          >
            Save price
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <InlineError message={formError} /> : null}

        <Select
          label="Fuel"
          options={fuelTypes.map((f) => ({ value: f.id, label: `${f.code} — ${f.name}` }))}
          error={errors.fuelTypeId?.message}
          disabled={mutation.isPending}
          {...register('fuelTypeId')}
        />

        <Input
          label="Price per litre"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="1500.00"
          description="Must be greater than zero."
          error={errors.pricePerLitre?.message}
          disabled={mutation.isPending}
          {...register('pricePerLitre', { valueAsNumber: true })}
        />

        <Input
          label="Effective from"
          type="date"
          min={todayIsoDate()}
          error={errors.effectiveFrom?.message}
          disabled={mutation.isPending}
          {...register('effectiveFrom')}
        />

        {/*
          doc 08 §26 / §51 — a future price schedules a change. The backend rejects
          an ambiguous overlap, so warn before the user hits save.
        */}
        {isFuture ? (
          <p className="bg-warning-50 text-warning-700 rounded-xl px-3 py-2.5 text-sm">
            This schedules a price change for {effectiveFrom}. Today&rsquo;s price is unaffected.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

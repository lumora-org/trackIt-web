'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/api/errors';
import { getCurrentPrice } from '@/api/fuel-prices.api';
import { listFuelTypes } from '@/api/fuel-types.api';
import {
  estimateTotal,
  recordSale,
  recordSaleSchema,
  type RecordSaleValues,
} from '@/api/sales.api';
import { getInventoryStock } from '@/api/inventory.api';
import { CurrencyDisplay, PricePerLitreDisplay, QuantityDisplay } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Drawer } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InlineError, Skeleton } from '@/components/ui/states';
import { formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { invalidateForResource, queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';
import { useBranchContext } from '@/providers/branch-provider';

/**
 * Record a sale (PROMPT.md §31 step 14, §9).
 *
 * The flow is optimised for speed because this is the highest-frequency action a
 * manager performs: pick a fuel, type litres, see the price and the total, confirm.
 *
 * PROMPT.md §9 — the frontend must not allow overriding the backend price, so
 * there is no price input. The current price is fetched for display only and the
 * total is labelled an estimate, because doc 04 §59 leaves both to the backend.
 */
export function RecordSalePanel() {
  const { user } = useAuth();
  const { activeBranch, activeBranchIds } = useBranchContext();
  const canRecord = can(user?.role, 'sales.record');

  // doc 06 §5 — a manager is pinned to their branch.
  const branchId = activeBranch?.id ?? activeBranchIds[0] ?? '';

  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<{ saleNumber: string; litres: number } | null>(null);

  if (!canRecord) return null;

  if (!branchId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-neutral-600">Select a branch before recording a sale.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-500">Quick action</p>
            <p className="text-base font-semibold text-neutral-900">
              Record a sale at {activeBranch?.name ?? 'this branch'}
            </p>
          </div>
          <Button size="lg" onClick={() => setOpen(true)}>
            <ShoppingCart className="size-5" aria-hidden="true" />
            Record Sale
          </Button>
        </CardBody>
      </Card>

      {open ? (
        <Drawer open={open} onClose={() => setOpen(false)} title="Record sale">
          {success ? (
            <SaleSuccess
              saleNumber={success.saleNumber}
              litres={success.litres}
              onDone={() => {
                setSuccess(null);
                setOpen(false);
              }}
            />
          ) : (
            <RecordSaleForm
              branchId={branchId}
              onSuccess={(sale) => {
                setSuccess({ saleNumber: sale.saleNumber, litres: sale.litresSold });
              }}
            />
          )}
        </Drawer>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- form */

function RecordSaleForm({
  branchId,
  onSuccess,
}: {
  branchId: string;
  onSuccess: (sale: { saleNumber: string; litresSold: number }) => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<RecordSaleValues>({
    resolver: zodResolver(recordSaleSchema),
    defaultValues: { litresSold: 0 },
  });

  const fuelTypeId = watch('fuelTypeId');
  const litresSold = watch('litresSold');

  const fuelTypesQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ activeOnly: true }),
    queryFn: () => listFuelTypes({ limit: 100, status: 'ACTIVE' }),
    staleTime: 10 * 60_000,
  });

  /*
   * The price is fetched, never entered. `/fuel-prices/current/:fuelTypeId`
   * returns exactly the price the backend will resolve for a sale made now
   * (doc 08 §31), so the preview matches the authoritative figure.
   */
  const priceQuery = useQuery({
    queryKey: queryKeys.fuelPrices.current(fuelTypeId),
    queryFn: () => getCurrentPrice(fuelTypeId),
    enabled: Boolean(fuelTypeId),
  });

  // Used only to warn when the typed quantity exceeds available stock.
  const stockQuery = useQuery({
    queryKey: queryKeys.inventory.stock({ branchId }),
    queryFn: () => getInventoryStock({ branchId }),
    staleTime: 15_000,
  });

  const price = priceQuery.data?.pricePerLitre ?? null;
  const selectedStock = stockQuery.data?.find((s) => s.fuelTypeId === fuelTypeId);
  const insufficient =
    selectedStock !== undefined && litresSold > selectedStock.currentQuantityLitres;

  const mutation = useMutation({
    mutationFn: () => recordSale({ branchId, fuelTypeId, litresSold }),
    onSuccess: (sale) => {
      // A sale decrements inventory and changes revenue, so invalidate broadly.
      for (const key of invalidateForResource('sales')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      setFormError(null);
      reset();
      onSuccess(sale);
    },
    onError: (err) => {
      if (isApiError(err)) {
        const litresError = err.fieldError('litresSold');
        if (litresError) setError('litresSold', { message: litresError });
        setFormError(litresError ? null : err.message);
      } else {
        setFormError('Unable to record the sale.');
      }
    },
  });

  return (
    <form onSubmit={handleSubmit(() => mutation.mutate())} className="space-y-5" noValidate>
      {formError ? <InlineError message={formError} /> : null}

      {/* Fuel picker — one tap per fuel, which is the main speed win. */}
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium text-neutral-800">
          Select fuel <span className="text-danger-500">*</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {(fuelTypesQuery.data?.data ?? []).map((fuel) => {
            const selected = fuel.id === fuelTypeId;
            return (
              <button
                key={fuel.id}
                type="button"
                // setValue (not register's onChange) because this button, not an
                // <input>, owns the field.
                onClick={() => {
                  setValue('fuelTypeId', fuel.id, { shouldValidate: false });
                  setError('fuelTypeId', { message: undefined });
                }}
                aria-pressed={selected}
                className={`min-h-touch focus-visible:outline-brand-600 rounded-xl font-mono text-base font-bold transition-colors focus-visible:outline-2 ${
                  selected
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {fuel.code}
              </button>
            );
          })}
        </div>
        <input type="hidden" {...register('fuelTypeId')} />
        {errors.fuelTypeId?.message ? (
          <p role="alert" className="text-danger-700 text-xs font-medium">
            {errors.fuelTypeId.message}
          </p>
        ) : null}
      </fieldset>

      {/* Current price — read-only, because doc 08 §33 forbids client pricing. */}
      <div className="rounded-card bg-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-500">Current price</p>
        {priceQuery.isLoading ? (
          <Skeleton className="mt-1.5 h-7 w-28" />
        ) : priceQuery.isError ? (
          <p className="text-danger-700 mt-1 text-sm">{priceQuery.error.message}</p>
        ) : price ? (
          <PricePerLitreDisplay
            value={price}
            className="mt-0.5 block text-xl font-bold text-neutral-900"
          />
        ) : (
          <p className="mt-1 text-sm text-neutral-600">No price configured.</p>
        )}
      </div>

      <Input
        label="Litres sold"
        type="number"
        inputMode="numeric"
        step="0.001"
        min="0"
        required
        placeholder="8500"
        error={errors.litresSold?.message}
        disabled={mutation.isPending}
        className="text-lg font-semibold"
        {...register('litresSold', { valueAsNumber: true })}
      />

      {selectedStock ? (
        <p className="text-xs text-neutral-500">
          Available: {formatLitres(selectedStock.currentQuantityLitres)}
        </p>
      ) : null}

      {/*
        A client-side warning only. doc 03 §73 states insufficient inventory is a
        transactional business rule enforced by the backend, so this never
        substitutes for the server's INSUFFICIENT_INVENTORY rejection.
      */}
      {insufficient ? (
        <p
          role="alert"
          className="border-warning-500/30 bg-warning-50 text-warning-700 rounded-xl border px-3 py-2.5 text-sm"
        >
          Only {formatLitres(selectedStock.currentQuantityLitres)} available at this branch.
        </p>
      ) : null}

      {/* Estimated total, clearly labelled — the backend computes the real one. */}
      {price && litresSold > 0 ? (
        <div className="rounded-card border-brand-200 bg-brand-50 border px-4 py-3">
          <p className="text-brand-700 text-xs">Estimated total</p>
          <p className="text-brand-900 mt-0.5 text-2xl font-bold tracking-tight">
            <CurrencyDisplay value={estimateTotal(litresSold, price)} />
          </p>
          <p className="text-brand-700 mt-1 text-xs">
            Final amount is calculated by the server from the price in effect at sale time.
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        size="xl"
        block
        loading={mutation.isPending}
        loadingText="Recording sale"
      >
        Record Sale
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------ success */

function SaleSuccess({
  saleNumber,
  litres,
  onDone,
}: {
  saleNumber: string;
  litres: number;
  onDone: () => void;
}) {
  return (
    <div className="space-y-5 text-center">
      <span className="bg-success-50 mx-auto flex size-14 items-center justify-center rounded-full">
        <CheckCircle2 className="text-success-700 size-7" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-neutral-900">Sale Recorded</h2>
        <p className="font-mono text-sm text-neutral-600">{saleNumber}</p>
      </div>

      <div className="rounded-card bg-neutral-100 px-4 py-3 text-left">
        <div className="flex items-baseline justify-between gap-3 py-1">
          <span className="text-sm text-neutral-600">Quantity</span>
          <QuantityDisplay value={litres} className="font-semibold text-neutral-900" />
        </div>
      </div>

      <Button block size="lg" onClick={onDone}>
        Record another sale
      </Button>
    </div>
  );
}

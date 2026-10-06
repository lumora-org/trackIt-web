'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import { isApiError } from '@/api/errors';
import {
  computeVariance,
  DISCREPANCY_REASONS,
  receiveDelivery,
} from '@/api/deliveries.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow, SectionHeading } from '@/components/ui/stat-card';
import { Input, Select } from '@/components/ui/input';
import { InlineError } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { formatDateTime, formatLitres } from '@/lib/format';
import { invalidateForResource } from '@/lib/query-keys';
import type { Delivery } from '@/types/domain';

/**
 * Receiving a delivery (PROMPT.md §11).
 *
 * The flow a manager needs on a phone: review the order, see the tanker and
 * driver, enter the ACTUAL quantity, see the variance, add a reason, then
 * accept. (The old dispute path was removed by product decision.)
 *
 * Only `actualQuantityLitres` is ever sent (doc 04 §50). Expected quantity is
 * read-only context. A discrepancy produces a prominent warning but never
 * auto-blocks the manager, because no variance tolerance is documented
 * (ASSUMPTIONS.md §3.2) — the backend decides what is acceptable.
 */
export function DeliveryReceiveForm({
  delivery,
  onReceived,
}: {
  delivery: Delivery;
  onReceived?: () => void;
}) {
  const queryClient = useQueryClient();

  // Seeded from expected so the common "matches perfectly" case is one tap.
  const [actual, setActual] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(delivery.items.map((i) => [i.fuelTypeId, i.expectedQuantityLitres])),
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const receiveMutation = useMutation({
    mutationFn: () =>
      receiveDelivery(
        delivery.id,
        delivery.items.map((item) => ({
          fuelTypeId: item.fuelTypeId,
          actualQuantityLitres: actual[item.fuelTypeId] ?? 0,
          discrepancyReason: reasons[item.fuelTypeId] ? reasons[item.fuelTypeId] : undefined,
        })),
      ),
    onSuccess: () => {
      // Receiving creates the authoritative inventory movement (doc 04 §50), so
      // stock, the ledger, the order and the dashboard all change.
      for (const key of invalidateForResource('deliveries')) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      setFormError(null);
      onReceived?.();
    },
    onError: (err) => {
      setFormError(isApiError(err) ? err.message : 'Unable to receive this delivery.');
    },
  });

  const anyDiscrepancy = delivery.items.some(
    (item) =>
      computeVariance(item.expectedQuantityLitres, actual[item.fuelTypeId] ?? null).hasDiscrepancy,
  );
  const anyMissing = delivery.items.some(
    (item) => actual[item.fuelTypeId] === null || actual[item.fuelTypeId] === undefined,
  );

  const tanker = delivery.tanker;
  const order = delivery.fuelOrder;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------ context */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <Badge tone={delivery.status === 'PENDING' ? 'warning' : 'success'}>
            {delivery.status}
          </Badge>
        </CardHeader>
        <CardBody>
          <dl>
            <DetailRow label="Order" value={order?.orderNumber ?? '—'} />
            <DetailRow label="Arrived" value={formatDateTime(delivery.deliveredAt)} />
            <DetailRow label="Tanker" value={tanker?.registrationNumber ?? delivery.tankerId} />
            <DetailRow label="Driver" value={tanker?.driverName ?? '—'} />
            {delivery.notes ? <DetailRow label="Notes" value={delivery.notes} /> : null}
          </dl>
        </CardBody>
      </Card>

      {/* ------------------------------------------------------ variance */}
      <SectionHeading title="Verify quantities" />

      {formError ? <InlineError message={formError} /> : null}

      {/*
        PROMPT.md §11 — warn clearly when there is a discrepancy, and make the
        reason mandatory so the record is meaningful.
      */}
      {anyDiscrepancy ? (
        <div
          role="alert"
          className="rounded-card border-warning-500/40 bg-warning-50 flex items-start gap-3 border px-4 py-3"
        >
          <AlertTriangle className="text-warning-700 mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-warning-700 text-sm">
            The received quantity does not match the order. Record a reason for each difference.
          </p>
        </div>
      ) : null}

      <ul className="space-y-4">
        {delivery.items.map((item) => {
          const value = actual[item.fuelTypeId];
          const { variance, hasDiscrepancy, severity } = computeVariance(
            item.expectedQuantityLitres,
            value ?? null,
          );

          return (
            <li key={item.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{item.fuelTypeName ?? 'Fuel'}</CardTitle>
                  {hasDiscrepancy && severity === 'short' ? (
                    <Badge tone="danger">
                      <ArrowDown className="size-3" aria-hidden="true" />
                      Short
                    </Badge>
                  ) : null}
                  {hasDiscrepancy && severity === 'over' ? (
                    <Badge tone="warning">
                      <ArrowUp className="size-3" aria-hidden="true" />
                      Over
                    </Badge>
                  ) : null}
                  {!hasDiscrepancy ? (
                    <Badge tone="success">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Matches
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-neutral-500">Expected</p>
                      <p className="mt-0.5 text-lg font-semibold text-neutral-900">
                        {formatLitres(item.expectedQuantityLitres)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Variance</p>
                      <p
                        className={cn(
                          'mt-0.5 text-lg font-semibold',
                          variance === null || variance === 0
                            ? 'text-neutral-400'
                            : variance < 0
                              ? 'text-danger-700'
                              : 'text-warning-700',
                        )}
                      >
                        {variance === null
                          ? '—'
                          : variance === 0
                            ? '0 L'
                            : `${variance > 0 ? '+' : '−'}${formatLitres(Math.abs(variance))}`}
                      </p>
                    </div>
                  </div>

                  <Input
                    label="Actual quantity received"
                    type="number"
                    inputMode="numeric"
                    step="0.001"
                    min="0"
                    required
                    value={value ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setActual((prev) => ({
                        ...prev,
                        [item.fuelTypeId]: raw === '' ? null : Number(raw),
                      }));
                    }}
                    disabled={receiveMutation.isPending}
                  />

                  {hasDiscrepancy ? (
                    <Select
                      label="Discrepancy reason"
                      placeholder="Select a reason"
                      options={DISCREPANCY_REASONS.map((r) => ({ value: r, label: r }))}
                      value={reasons[item.fuelTypeId] ?? ''}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [item.fuelTypeId]: e.target.value }))
                      }
                      disabled={receiveMutation.isPending}
                      required
                    />
                  ) : null}
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-t border-neutral-200 pt-4">
        <Button
          block
          size="lg"
          loading={receiveMutation.isPending}
          loadingText="Receiving delivery"
          disabled={anyMissing || (anyDiscrepancy && !allReasonsSet(delivery, reasons))}
          onClick={() => receiveMutation.mutate()}
        >
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Receive delivery
        </Button>

        {anyDiscrepancy ? (
          <p className="text-center text-xs text-neutral-500">
            Only the actual quantity is added to inventory (doc 04 §49).
          </p>
        ) : null}
      </div>
    </div>
  );
}

function allReasonsSet(delivery: Delivery, reasons: Record<string, string>): boolean {
  return delivery.items.every((item) => {
    const value = reasons[item.fuelTypeId];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

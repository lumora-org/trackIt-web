'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, PackageCheck, Send, Truck } from 'lucide-react';
import { useState } from 'react';

import { isApiError } from '@/api/errors';
import {
  cancelFuelOrder,
  confirmFuelOrder,
  getFuelOrder,
  markFuelOrderInTransit,
  submitFuelOrder,
} from '@/api/fuel-orders.api';
import { CurrencyDisplay } from '@/components/ui/amount';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailRow, SectionHeading } from '@/components/ui/stat-card';
import { Drawer } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { ErrorState, InlineError, LoadingState } from '@/components/ui/states';
import { FUEL_ORDER_TRANSITIONS } from '@/types/domain';
import { formatDateTime, formatLitres } from '@/lib/format';
import { can } from '@/lib/permissions';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/**
 * Order detail with lifecycle actions (PROMPT.md §12).
 *
 * doc 09 §9 documents the state machine. Actions are offered only where the
 * documented transition table allows them, so a user is never shown a button the
 * backend will reject with INVALID_ORDER_STATUS.
 *
 * Note: PARTIALLY_DELIVERED and DELIVERED have no documented endpoint (see
 * ASSUMPTIONS.md §3.x) — they are set by the delivery flow, so no action here
 * targets them.
 */
export function FuelOrderDetailDrawer({
  orderId,
  open,
  onClose,
}: {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can(user?.role, 'fuelOrder.manage');

  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const detailQuery = useQuery({
    queryKey: queryKeys.fuelOrders.detail(orderId ?? ''),
    queryFn: () => getFuelOrder(orderId!),
    enabled: open && Boolean(orderId),
  });

  const order = detailQuery.data;

  const transition = useMutation({
    mutationFn: async (action: 'submit' | 'confirm' | 'in-transit' | 'cancel') => {
      if (!order) throw new Error('No order loaded.');
      switch (action) {
        case 'submit':
          return submitFuelOrder(order.id);
        case 'confirm':
          return confirmFuelOrder(order.id);
        case 'in-transit':
          return markFuelOrderInTransit(order.id);
        case 'cancel':
          return cancelFuelOrder(order.id, cancelReason.trim());
      }
    },
    onSuccess: () => {
      setActionError(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelOrders.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelOrders.detail(orderId ?? '') });
      // doc 04 §92 — a delivery may have been created for an in-transit order.
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.list() });
    },
    onError: (err) => {
      setActionError(isApiError(err) ? err.message : 'That action could not be completed.');
    },
  });

  const allowed = order ? FUEL_ORDER_TRANSITIONS[order.status] : [];

  function close() {
    setActionError(null);
    setCancelReason('');
    onClose();
  }

  return (
    <Drawer open={open} onClose={close} title={order?.orderNumber ?? 'Fuel order'}>
      {detailQuery.isLoading ? <LoadingState label="Loading order" /> : null}

      {detailQuery.isError ? (
        <ErrorState message={detailQuery.error.message} onRetry={() => detailQuery.refetch()} />
      ) : null}

      {order ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge domain="fuelOrder" value={order.status} />
            {canManage && allowed.includes('CANCELLED') ? (
              <Badge tone="neutral">Cancellable</Badge>
            ) : null}
          </div>

          <section>
            <SectionHeading title="Order" />
            <dl>
              <DetailRow label="Supplier" value={order.supplier.name} />
              <DetailRow label="Destination branch" value={order.destinationBranch.name} />
              <DetailRow
                label="Expected delivery"
                value={formatDateTime(order.expectedDeliveryAt)}
              />
              {order.notes ? <DetailRow label="Notes" value={order.notes} /> : null}
            </dl>
          </section>

          <section>
            <SectionHeading title="Items" />
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li
                  key={`${order.id}-${item.fuelTypeId}`}
                  className="rounded-xl border border-neutral-200 p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-neutral-900">{item.fuelTypeName}</span>
                    <span className="text-sm text-neutral-700">
                      {formatLitres(item.expectedQuantityLitres)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Procurement cost <CurrencyDisplay value={item.unitCost} /> per litre
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">
              An order does not add stock. Stock increases only when a delivery is received (doc
              09 §1).
            </p>
          </section>

          {canManage && allowed.length > 0 ? (
            <section className="space-y-3 border-t border-neutral-200 pt-4">
              <SectionHeading title="Actions" />

              {actionError ? <InlineError message={actionError} /> : null}

              <div className="flex flex-col gap-2">
                {allowed.includes('SUBMITTED') ? (
                  <Button
                    onClick={() => transition.mutate('submit')}
                    loading={transition.isPending}
                    loadingText="Submitting"
                  >
                    <Send className="size-4" aria-hidden="true" />
                    Submit order
                  </Button>
                ) : null}

                {allowed.includes('CONFIRMED') ? (
                  <Button
                    onClick={() => transition.mutate('confirm')}
                    loading={transition.isPending}
                    loadingText="Confirming"
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Confirm order
                  </Button>
                ) : null}

                {allowed.includes('IN_TRANSIT') ? (
                  <Button
                    variant="secondary"
                    onClick={() => transition.mutate('in-transit')}
                    loading={transition.isPending}
                    loadingText="Updating"
                  >
                    <Truck className="size-4" aria-hidden="true" />
                    Mark in transit
                  </Button>
                ) : null}

                {allowed.includes('CANCELLED') ? (
                  <div className="border-danger-500/30 bg-danger-50/50 space-y-2 rounded-xl border p-3">
                    <p className="text-danger-700 text-sm font-medium">Cancel this order</p>
                    {/*
                      doc 04 §46 requires a reason, but there is no
                      cancellation_reason column in doc 03 — the reason is recorded
                      in the audit log. See ASSUMPTIONS.md §2.x.
                    */}
                    <Textarea
                      label="Reason"
                      placeholder="Supplier could not fulfil the order."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      disabled={transition.isPending}
                      rows={2}
                    />
                    <Button
                      variant="danger"
                      block
                      disabled={cancelReason.trim().length === 0}
                      loading={transition.isPending}
                      loadingText="Cancelling"
                      onClick={() => transition.mutate('cancel')}
                    >
                      <Ban className="size-4" aria-hidden="true" />
                      Cancel order
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* doc 09 §9 — cancelling after transit starts needs intervention. */}
              {order.status === 'IN_TRANSIT' ? (
                <p className="flex items-start gap-2 text-xs text-neutral-500">
                  <PackageCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  This order is already in transit. Cancelling now requires administrative
                  intervention.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

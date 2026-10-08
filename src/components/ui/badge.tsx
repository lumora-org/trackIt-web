import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

/**
 * StatusBadge — one consistent visual language for every workflow state
 * (PROMPT.md §12: "Use consistent status badges throughout the application").
 *
 * The tone map below is derived from each enum's position in its lifecycle, so
 * DRAFT/RECEIVED/PENDING are neutral, in-flight states are informational, and
 * only genuinely-good outcomes are green.
 */

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-neutral-100 text-neutral-700',
        info: 'bg-info-50 text-info-700',
        success: 'bg-success-50 text-success-700',
        warning: 'bg-warning-50 text-warning-700',
        danger: 'bg-danger-50 text-danger-700',
        brand: 'bg-brand-50 text-brand-700',
      },
      size: {
        sm: 'text-[0.6875rem] px-2 py-0.5',
        md: '',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/* --------------------------------------------------------- tone mappings */

const FUEL_ORDER_TONES: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  CONFIRMED: 'brand',
  IN_TRANSIT: 'warning',
  PARTIALLY_DELIVERED: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
};

const DELIVERY_TONES: Record<string, BadgeTone> = {
  PENDING: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'neutral',
};

const DAILY_REPORT_TONES: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'brand',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const SALE_TONES: Record<string, BadgeTone> = {
  CREATED: 'success',
  VOIDED: 'danger',
};

const SALE_RECORD_MODE_TONES: Record<string, BadgeTone> = {
  SINGLE: 'neutral',
  DAY_TOTAL: 'info',
};

/** Product decision (2026-10) — PENDING wants attention, APPROVED is done. */
const SALE_APPROVAL_TONES: Record<string, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** Product decision (2026-10) — OPEN wants attention, REVIEWED is done. */
const INCIDENT_TONES: Record<string, BadgeTone> = {
  OPEN: 'warning',
  REVIEWED: 'success',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'danger',
  PENDING: 'warning',
};

const NOTIFICATION_TONES: Record<string, BadgeTone> = {
  REPORT_SUBMITTED: 'info',
  REPORT_APPROVED: 'success',
  REPORT_REJECTED: 'danger',
  DELIVERY_RECEIVED: 'success',
  DELIVERY_DISCREPANCY: 'danger',
  LOW_INVENTORY: 'warning',
  FUEL_PRICE_UPDATE: 'info',
  DELIVERY_IN_TRANSIT: 'warning',
  FUEL_ORDER_ASSIGNED: 'info',
  DAILY_REPORT_MISSING: 'danger',
  INCIDENT_REPORTED: 'warning',
  INCIDENT_REVIEWED: 'success',
  SALE_RECORDED: 'info',
  SALE_APPROVED: 'success',
  SALE_REJECTED: 'danger',
  SALES_NOT_RECORDED: 'danger',
  SYSTEM: 'neutral',
};

export const STATUS_TONE_MAPS = {
  fuelOrder: FUEL_ORDER_TONES,
  delivery: DELIVERY_TONES,
  dailyReport: DAILY_REPORT_TONES,
  sale: SALE_TONES,
  saleRecordMode: SALE_RECORD_MODE_TONES,
  saleApproval: SALE_APPROVAL_TONES,
  incident: INCIDENT_TONES,
  status: STATUS_TONES,
  notification: NOTIFICATION_TONES,
} as const;

export type StatusDomain = keyof typeof STATUS_TONE_MAPS;

export function toneFor(domain: StatusDomain, value: string | null | undefined): BadgeTone {
  if (!value) return 'neutral';
  return STATUS_TONE_MAPS[domain][value] ?? 'neutral';
}

/** `PARTIALLY_DELIVERED` → `Partially delivered` */
export function humanizeStatus(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Convenience wrapper: renders any documented enum value with its mapped tone
 * and a humanised label.
 */
export function StatusBadge({
  domain,
  value,
  size,
  className,
}: {
  domain: StatusDomain;
  value: string | null | undefined;
  size?: BadgeProps['size'];
  className?: string;
}) {
  if (!value) return null;
  return (
    <Badge tone={toneFor(domain, value)} size={size} className={className}>
      {humanizeStatus(value)}
    </Badge>
  );
}

export { badgeVariants };

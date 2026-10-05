import { cn } from '@/lib/cn';
import { formatCurrency, formatLitres, formatPricePerLitre, type Amount } from '@/lib/format';

/**
 * Domain display components (PROMPT.md §24 requires CurrencyDisplay and
 * QuantityDisplay). They centralise the formatting rules so no screen invents
 * its own currency rendering.
 */

export function CurrencyDisplay({
  value,
  compact = false,
  className,
  /** Show the kobo/cents — off by default where space is tight. */
  showDecimals,
}: {
  value: Amount;
  compact?: boolean;
  className?: string;
  showDecimals?: boolean;
}) {
  const formatted =
    compact && !showDecimals
      ? formatCurrency(value, { compact: true })
      : showDecimals
        ? formatCurrency(value)
        : // Drop the trailing ".00" for headline figures like ₦12,750,000.
          formatCurrency(value).replace(/\.00$/, '');

  return <span className={cn('tabular-nums', className)}>{formatted}</span>;
}

export function PricePerLitreDisplay({ value, className }: { value: Amount; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatPricePerLitre(value)}</span>;
}

export function QuantityDisplay({
  value,
  unit = 'L',
  className,
  signed = false,
}: {
  value: Amount;
  unit?: string;
  className?: string;
  signed?: boolean;
}) {
  const litres =
    unit === 'L' ? formatLitres(value) : `${Number(value ?? 0).toLocaleString('en-NG')} ${unit}`;
  const text = signed && Number(value ?? 0) > 0 ? `+${litres}` : litres;
  return <span className={cn('tabular-nums', className)}>{text}</span>;
}

/**
 * Signed inventory movement. PROMPT.md §10 requires positive and negative
 * movements to be visually distinguishable, so the colour carries the sign.
 */
export function SignedQuantityDisplay({ value, className }: { value: Amount; className?: string }) {
  const n = Number(value ?? 0);
  const text = formatLitres(Math.abs(n));
  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        n > 0 ? 'text-success-700' : n < 0 ? 'text-danger-700' : 'text-neutral-500',
        className,
      )}
    >
      {n > 0 ? '+' : n < 0 ? '−' : ''}
      {text}
    </span>
  );
}

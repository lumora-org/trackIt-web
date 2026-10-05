/**
 * Display formatting.
 *
 * doc 03 §8/§9 — money is NUMERIC(18,2) and fuel quantities are NUMERIC(18,3);
 * neither may rely on floating-point arithmetic (doc 05 §27).
 *
 * The wire format is `number` per every doc 04 example, but doc 05 §27 notes
 * PostgreSQL NUMERIC may arrive as `string`. `toAmount` accepts both so a
 * string-serialising backend does not break the UI.
 */

export type Amount = number | string | null | undefined;

/** Currency is Naira only — there is no `currency` column anywhere (doc 03). */
export const CURRENCY = 'NGN';
export const CURRENCY_SYMBOL = '\u20A6';

/** Convert a wire value to a finite number. */
export function toAmount(value: Amount): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Render Naira with 2 decimal places: ₦12,750,000.00 (PROMPT.md §25).
 * `compact` renders ₦118.5M for dashboard tiles where space is tight.
 */
export function formatCurrency(value: Amount, options?: { compact?: boolean }): string {
  const n = toAmount(value);
  if (options?.compact && Math.abs(n) >= 1_000_000) {
    return `${CURRENCY_SYMBOL}${formatCompactNumber(n)}`;
  }
  return `${CURRENCY_SYMBOL}${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Price per litre, e.g. ₦1,500.00 / L — trailing .00 is dropped. */
export function formatPricePerLitre(value: Amount): string {
  const n = toAmount(value);
  return `${CURRENCY_SYMBOL}${n.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} / L`;
}

/**
 * Fuel quantity. Whole numbers render without decimals (8,500 L) but fractional
 * values keep up to 3 places per NUMERIC(18,3) (44,850.125 L).
 */
export function formatLitres(value: Amount, options?: { decimals?: number }): string {
  const n = toAmount(value);
  const max = options?.decimals ?? 3;
  const formatted = n.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  });
  return `${formatted} L`;
}

function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toLocaleString('en-NG')}`;
}

/** Compact quantity for stat tiles: 78.5K L */
export function formatLitresCompact(value: Amount): string {
  const n = toAmount(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K L`;
  return `${n.toLocaleString('en-NG')} L`;
}

/** Integer with thousands separators: 3 */
export function formatCount(value: Amount): string {
  return toAmount(value).toLocaleString('en-NG');
}

/* ------------------------------------------------------------------ dates */

function parse(value: string | Date): Date | null {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * doc 03 §7 — backend stores UTC, frontend displays in the user's timezone.
 * `reportDate` is a bare DATE and must be rendered without timezone shifting.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = parse(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Render a bare "YYYY-MM-DD" date as e.g. "05 October 2026" (PROMPT.md §14). */
export function formatReportDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return formatDate(value);
  return new Date(y, m - 1, d).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = parse(value);
  if (!d) return '—';
  return d.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "2 hours ago" — used in notification and audit timelines. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = parse(value);
  if (!d) return '—';

  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return formatDate(d);
}

/** Today as "YYYY-MM-DD" in the user's local timezone. */
export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Combine a bare date and "HH:mm" into an ISO instant the backend accepts. */
export function toIsoTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/* ------------------------------------------------------------- quantities */

/**
 * Signed quantity for inventory ledgers. PROMPT.md §10 requires positive and
 * negative movements to be visually distinguishable.
 */
export function formatSignedLitres(value: Amount): string {
  const n = toAmount(value);
  const formatted = Math.abs(n).toLocaleString('en-NG', { maximumFractionDigits: 3 });
  if (n > 0) return `+${formatted} L`;
  if (n < 0) return `-${formatted} L`;
  return `0 L`;
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  const a = firstName?.trim()?.[0] ?? '';
  const b = lastName?.trim()?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

export function fullName(user: { firstName: string; lastName: string } | null): string {
  if (!user) return 'Unknown user';
  return `${user.firstName} ${user.lastName}`.trim();
}

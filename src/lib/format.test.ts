import { describe, expect, it } from 'vitest';

import {
  CURRENCY_SYMBOL,
  formatCurrency,
  formatLitres,
  formatLitresCompact,
  formatPricePerLitre,
  formatReportDate,
  formatSignedLitres,
  toAmount,
  todayIsoDate,
} from './format';

describe('formatCurrency', () => {
  it('renders Naira with 2 decimals (PROMPT.md §25)', () => {
    expect(formatCurrency(12750000)).toBe(`${CURRENCY_SYMBOL}12,750,000.00`);
  });

  it('accepts a numeric string, since NUMERIC may serialise as a string (doc 05 §27)', () => {
    expect(formatCurrency('12750000')).toBe(`${CURRENCY_SYMBOL}12,750,000.00`);
  });

  it('treats null and undefined as zero', () => {
    expect(formatCurrency(null)).toBe(`${CURRENCY_SYMBOL}0.00`);
    expect(formatCurrency(undefined)).toBe(`${CURRENCY_SYMBOL}0.00`);
  });

  it('compacts large dashboard figures', () => {
    expect(formatCurrency(118_500_000, { compact: true })).toBe(`${CURRENCY_SYMBOL}118.5M`);
  });
});

describe('formatPricePerLitre', () => {
  it('drops the trailing .00', () => {
    expect(formatPricePerLitre(1500)).toBe(`${CURRENCY_SYMBOL}1,500 / L`);
  });

  it('keeps meaningful decimals', () => {
    expect(formatPricePerLitre(1500.5)).toBe(`${CURRENCY_SYMBOL}1,500.5 / L`);
  });
});

describe('formatLitres', () => {
  it('formats whole litres without decimals', () => {
    expect(formatLitres(8500)).toBe('8,500 L');
  });

  it('supports the 3-decimal NUMERIC(18,3) precision (doc 03 §9)', () => {
    expect(formatLitres(44850.125)).toBe('44,850.125 L');
  });

  it('compacts for stat tiles', () => {
    expect(formatLitresCompact(78500)).toBe('78.5K L');
  });
});

describe('formatSignedLitres', () => {
  it('marks positive and negative movements distinctly (PROMPT.md §10)', () => {
    expect(formatSignedLitres(44850)).toBe('+44,850 L');
    expect(formatSignedLitres(-8500)).toBe('-8,500 L');
    expect(formatSignedLitres(0)).toBe('0 L');
  });
});

describe('formatReportDate', () => {
  it('renders a bare DATE without timezone shifting (doc 03 §7)', () => {
    expect(formatReportDate('2026-10-05')).toBe('05 October 2026');
  });

  it('does not roll back a midnight date', () => {
    expect(formatReportDate('2026-01-01')).toBe('01 January 2026');
  });

  it('returns an em dash for missing values', () => {
    expect(formatReportDate(null)).toBe('—');
  });
});

describe('toAmount', () => {
  it('coerces numeric strings and rejects non-finite values', () => {
    expect(toAmount('8500')).toBe(8500);
    expect(toAmount(Number.NaN)).toBe(0);
    expect(toAmount('abc')).toBe(0);
  });
});

describe('todayIsoDate', () => {
  it('returns a zero-padded YYYY-MM-DD string', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

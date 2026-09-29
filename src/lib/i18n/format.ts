import { exponentOf, type CurrencyCode } from '../money/currency';
import { type Money, toDecimalString } from '../money/money';

export const LOCALES = ['en-GB', 'it-IT', 'es-ES', 'de-DE'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(locale: Locale, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    cache.set(key, f);
  }
  return f;
}

function dateFormat(locale: Locale, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts });
    cache.set(key, f);
  }
  return f;
}

export interface MoneyFormatOptions {
  readonly signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never';
  /** Drop the minor units (for chart axes and KPI tiles). */
  readonly whole?: boolean;
}

/**
 * Locale-aware currency formatting from integer minor units. The exact decimal string is passed to Intl,
 * so no float ever touches the value: 123456 GBP → "£1,234.56" (en-GB) / "1.234,56 £" (de-DE).
 */
export function formatMoney(m: Money, locale: Locale, opts: MoneyFormatOptions = {}): string {
  const exp = exponentOf(m.currency);
  const digits = opts.whole ? 0 : exp;
  const f = numberFormat(locale, {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: opts.signDisplay ?? 'auto',
    roundingMode: 'halfEven',
  } as Intl.NumberFormatOptions);
  return f.format(toDecimalString(m) as unknown as number);
}

export function formatAmount(
  amount: number,
  currency: CurrencyCode,
  locale: Locale,
  opts: MoneyFormatOptions = {},
): string {
  return formatMoney({ amount, currency }, locale, opts);
}

export function formatNumber(n: number, locale: Locale, maxFractionDigits = 0): string {
  return numberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatPercent(
  ratio: number,
  locale: Locale,
  opts: { signed?: boolean; digits?: number } = {},
): string {
  return numberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: opts.digits ?? 0,
    minimumFractionDigits: 0,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  }).format(ratio);
}

function utc(iso: string): Date {
  return new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`);
}

export function formatDate(
  iso: string,
  locale: Locale,
  style: 'short' | 'medium' | 'long' = 'medium',
): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'medium'
        ? { day: 'numeric', month: 'short', year: 'numeric' }
        : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  return dateFormat(locale, opts).format(utc(iso));
}

export function formatMonth(monthKey: string, locale: Locale, style: 'short' | 'long' = 'short'): string {
  return dateFormat(
    locale,
    style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' },
  ).format(utc(monthKey));
}

/** Parse a user-typed amount in the given locale ("1.234,56" in de-DE) into a plain decimal string. */
export function parseLocalisedAmount(input: string, locale: Locale): string | null {
  const parts = numberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(12345678.5);
  const group = parts.find((p) => p.type === 'group')?.value ?? ',';
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  let s = input.trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!s) return null;
  s = s.split(group).join('');
  if (decimal !== '.') s = s.replace(decimal, '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? s : null;
}

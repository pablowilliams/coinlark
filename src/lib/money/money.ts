import { type CurrencyCode, exponentOf, minorPerMajor } from './currency';
import { divRound, type RoundingMode } from './rounding';

/**
 * A monetary amount stored as an integer number of minor units (pence, cents, yen, fils).
 * Never a float: `amount` is always a safe integer.
 */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

function assertSafe(n: number | bigint): number {
  const v = typeof n === 'bigint' ? Number(n) : n;
  if (!Number.isSafeInteger(v) || (typeof n === 'bigint' && BigInt(v) !== n)) {
    throw new RangeError(`Amount is not a safe integer of minor units: ${String(n)}`);
  }
  return v === 0 ? 0 : v; // normalise -0
}

export function money(amount: number | bigint, currency: CurrencyCode): Money {
  return { amount: assertSafe(amount), currency };
}

export const zero = (currency: CurrencyCode): Money => money(0, currency);

function same(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function add(a: Money, b: Money): Money {
  same(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  same(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.amount, a.currency);
}

export function absolute(a: Money): Money {
  return money(Math.abs(a.amount), a.currency);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  same(a, b);
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}

export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  let total = 0n;
  for (const m of items) {
    if (m.currency !== currency) throw new CurrencyMismatchError(currency, m.currency);
    total += BigInt(m.amount);
  }
  return money(total, currency);
}

const MAJOR_RE = /^([+-])?(\d+)(?:\.(\d*))?$/;

/**
 * Parse a major-unit decimal string ("12.34", "1200", "-0.005") into minor units.
 * Extra decimal places are rounded with `mode` (banker's rounding by default); nothing goes through a float.
 */
export function fromMajor(input: string, currency: CurrencyCode, mode: RoundingMode = 'half-even'): Money {
  const m = MAJOR_RE.exec(input.trim().replace(/[\s_]/g, ''));
  if (!m) throw new SyntaxError(`Not an amount: "${input}"`);
  const [, sign, int = '0', frac = ''] = m;
  const exp = exponentOf(currency);
  const digits = BigInt(int + frac) * (sign === '-' ? -1n : 1n);
  const scale = BigInt(frac.length);
  const target = BigInt(exp);
  const minor =
    scale <= target ? digits * 10n ** (target - scale) : divRound(digits, 10n ** (scale - target), mode);
  return money(minor, currency);
}

/** Exact major-unit decimal string: 1234 GBP → "12.34", 1200 JPY → "1200", 5 KWD → "0.005". */
export function toDecimalString(m: Money): string {
  const exp = exponentOf(m.currency);
  const neg = m.amount < 0;
  const digits = Math.abs(m.amount).toString();
  if (exp === 0) return (neg ? '-' : '') + digits;
  const padded = digits.padStart(exp + 1, '0');
  return `${neg ? '-' : ''}${padded.slice(0, -exp)}.${padded.slice(-exp)}`;
}

/** Only for charts and approximate displays; never for arithmetic. */
export function toMajorNumber(m: Money): number {
  return m.amount / Number(minorPerMajor(m.currency));
}

/**
 * Split `m` in proportion to non-negative integer `weights` with the largest-remainder method.
 * The parts always sum exactly to `m`: no minor unit is ever lost or created.
 * Leftover units go to the parts with the largest remainders (earliest index wins ties).
 */
export function allocate(m: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) throw new RangeError('At least one weight is required');
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new RangeError('Weights must be non-negative integers');
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) throw new RangeError('Weights must not all be zero');

  const sign = m.amount < 0 ? -1n : 1n;
  const amount = BigInt(Math.abs(m.amount));
  const T = BigInt(total);
  const shares = weights.map((w) => (amount * BigInt(w)) / T);
  const remainders = weights.map((w, i) => ({ i, r: (amount * BigInt(w)) % T }));
  let leftover = amount - shares.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; leftover > 0n; k++, leftover--) {
    const idx = remainders[k % remainders.length]!.i;
    shares[idx] = shares[idx]! + 1n;
  }
  return shares.map((s) => money(s * sign, m.currency));
}

/** Split evenly into n parts (differences of at most one minor unit). */
export function split(m: Money, n: number): Money[] {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  return allocate(
    m,
    Array.from({ length: n }, () => 1),
  );
}

/** Multiply by a decimal factor string (e.g. "0.2" for 20%), rounding the result to minor units. */
export function multiplyBy(m: Money, factor: string, mode: RoundingMode = 'half-even'): Money {
  const f = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(factor.trim());
  if (!f) throw new SyntaxError(`Not a decimal factor: "${factor}"`);
  const [, sign, int = '0', frac = ''] = f;
  const num = BigInt(int + frac) * (sign === '-' ? -1n : 1n);
  return money(divRound(BigInt(m.amount) * num, 10n ** BigInt(frac.length), mode), m.currency);
}

/** An exact rational number, used for FX rates. Denominator is always positive. */
export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

const DECIMAL_RE = /^([+-])?(\d+)(?:\.(\d+))?$/;

/** Parse a plain decimal string ("1.1378", "-0.05", "178.5") into an exact rational. */
export function parseDecimal(input: string): Rational {
  const m = DECIMAL_RE.exec(input.trim());
  if (!m) throw new SyntaxError(`Not a decimal number: "${input}"`);
  const [, sign, int = '0', frac = ''] = m;
  const num = BigInt(int + frac) * (sign === '-' ? -1n : 1n);
  return { num, den: 10n ** BigInt(frac.length) };
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

export function reduce(r: Rational): Rational {
  if (r.den === 0n) throw new RangeError('Zero denominator');
  const g = gcd(r.num, r.den) || 1n;
  const sign = r.den < 0n ? -1n : 1n;
  return { num: (sign * r.num) / g, den: (sign * r.den) / g };
}

export function divide(a: Rational, b: Rational): Rational {
  if (b.num === 0n) throw new RangeError('Division by zero');
  return reduce({ num: a.num * b.den, den: a.den * b.num });
}

export function multiply(a: Rational, b: Rational): Rational {
  return reduce({ num: a.num * b.num, den: a.den * b.den });
}

/** Render a rational as a decimal string with `places` digits (half-even), e.g. for showing an FX rate. */
export function toFixedString(r: Rational, places: number): string {
  const scale = 10n ** BigInt(places);
  let n = r.num * scale;
  const d = r.den;
  // half-even rounding of n / d
  let q = n / d;
  const rem = n % d;
  const twice = 2n * (rem < 0n ? -rem : rem);
  const sign = n < 0n ? -1n : 1n;
  if (twice > d || (twice === d && q % 2n !== 0n)) q += sign;
  n = q < 0n ? -q : q;
  const s = n.toString().padStart(places + 1, '0');
  const body = places > 0 ? `${s.slice(0, -places)}.${s.slice(-places)}` : s;
  return (q < 0n ? '-' : '') + body;
}

export function toNumber(r: Rational): number {
  return Number(r.num) / Number(r.den);
}

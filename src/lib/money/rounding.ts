export type RoundingMode = 'half-even' | 'half-up' | 'floor' | 'ceil' | 'trunc';

function abs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

/**
 * Integer division n / d rounded with the given mode. Exact: no floating point involved.
 * 'half-even' is banker's rounding (ties go to the even neighbour), 'half-up' rounds ties away from zero.
 */
export function divRound(n: bigint, d: bigint, mode: RoundingMode = 'half-even'): bigint {
  if (d === 0n) throw new RangeError('Division by zero');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const q = n / d; // truncates toward zero
  const r = n % d; // same sign as n
  if (r === 0n) return q;
  const sign = n < 0n ? -1n : 1n;
  switch (mode) {
    case 'trunc':
      return q;
    case 'floor':
      return sign < 0n ? q - 1n : q;
    case 'ceil':
      return sign > 0n ? q + 1n : q;
    case 'half-up': {
      const twice = 2n * abs(r);
      return twice >= d ? q + sign : q;
    }
    case 'half-even': {
      const twice = 2n * abs(r);
      if (twice > d) return q + sign;
      if (twice < d) return q;
      return q % 2n === 0n ? q : q + sign;
    }
  }
}

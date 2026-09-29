import fc from 'fast-check';
import { CURRENCY_CODES, exponentOf, isCurrencyCode, minorPerMajor, type CurrencyCode } from './currency';
import {
  absolute,
  add,
  allocate,
  compare,
  CurrencyMismatchError,
  equals,
  fromMajor,
  money,
  multiplyBy,
  negate,
  split,
  subtract,
  sum,
  toDecimalString,
  toMajorNumber,
  zero,
} from './money';
import { divRound } from './rounding';
import { naiveAllocate, naiveConvert, roundTo } from './naive';

const currency = fc.constantFrom<CurrencyCode>(...CURRENCY_CODES);
const minor = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 });

describe('currency table', () => {
  it('uses ISO 4217 exponents', () => {
    expect(exponentOf('GBP')).toBe(2);
    expect(exponentOf('EUR')).toBe(2);
    expect(exponentOf('JPY')).toBe(0);
    expect(exponentOf('KWD')).toBe(3);
    expect(minorPerMajor('KWD')).toBe(1000n);
    expect(isCurrencyCode('JPY')).toBe(true);
    expect(isCurrencyCode('XYZ')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
  });
});

describe('divRound', () => {
  it.each([
    [5n, 2n, 'half-even', 2n],
    [7n, 2n, 'half-even', 4n],
    [-5n, 2n, 'half-even', -2n],
    [-7n, 2n, 'half-even', -4n],
    [5n, 2n, 'half-up', 3n],
    [-5n, 2n, 'half-up', -3n],
    [7n, 3n, 'half-even', 2n],
    [8n, 3n, 'half-even', 3n],
    [7n, 3n, 'floor', 2n],
    [-7n, 3n, 'floor', -3n],
    [7n, 3n, 'ceil', 3n],
    [-7n, 3n, 'ceil', -2n],
    [-7n, 3n, 'trunc', -2n],
    [6n, 3n, 'half-even', 2n],
    [5n, -2n, 'half-even', -2n],
  ] as const)('%s / %s (%s) = %s', (n, d, mode, want) => {
    expect(divRound(n, d, mode)).toBe(want);
  });

  it('rejects division by zero', () => {
    expect(() => divRound(1n, 0n)).toThrow(RangeError);
  });

  it('is symmetric under negation (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.bigInt({ min: 1n, max: 10n ** 6n }),
        (n, d) => {
          expect(divRound(-n, d)).toBe(-divRound(n, d));
        },
      ),
    );
  });

  it('is always within half a unit of the exact quotient (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.bigInt({ min: 1n, max: 10n ** 6n }),
        (n, d) => {
          const q = divRound(n, d);
          const err = q * d - n;
          expect(2n * (err < 0n ? -err : err) <= d).toBe(true);
        },
      ),
    );
  });
});

describe('Money basics', () => {
  it('stores integer minor units and rejects floats or unsafe values', () => {
    expect(money(1234, 'GBP')).toEqual({ amount: 1234, currency: 'GBP' });
    expect(() => money(12.5, 'GBP')).toThrow(RangeError);
    expect(() => money(2 ** 60, 'GBP')).toThrow(RangeError);
    expect(() => money(2n ** 60n, 'GBP')).toThrow(RangeError);
    expect(money(-0, 'GBP').amount).toBe(0);
    expect(Object.is(money(-0, 'GBP').amount, -0)).toBe(false);
    expect(zero('JPY')).toEqual({ amount: 0, currency: 'JPY' });
  });

  it('adds, subtracts, negates, compares', () => {
    const a = money(1050, 'EUR');
    const b = money(250, 'EUR');
    expect(add(a, b).amount).toBe(1300);
    expect(subtract(b, a).amount).toBe(-800);
    expect(negate(a).amount).toBe(-1050);
    expect(absolute(negate(a)).amount).toBe(1050);
    expect(compare(a, b)).toBe(1);
    expect(compare(b, a)).toBe(-1);
    expect(compare(a, a)).toBe(0);
    expect(equals(a, money(1050, 'EUR'))).toBe(true);
    expect(equals(a, money(1050, 'GBP'))).toBe(false);
    expect(sum([a, b, b], 'EUR').amount).toBe(1550);
  });

  it('never mixes currencies', () => {
    expect(() => add(money(1, 'GBP'), money(1, 'EUR'))).toThrow(CurrencyMismatchError);
    expect(() => sum([money(1, 'GBP')], 'EUR')).toThrow(CurrencyMismatchError);
  });

  it('addition is associative and commutative (property)', () => {
    fc.assert(
      fc.property(minor, minor, minor, (x, y, z) => {
        const [a, b, c] = [money(x, 'GBP'), money(y, 'GBP'), money(z, 'GBP')];
        expect(add(add(a, b), c)).toEqual(add(a, add(b, c)));
        expect(add(a, b)).toEqual(add(b, a));
      }),
    );
  });
});

describe('parsing and printing', () => {
  it.each([
    ['12.34', 'GBP', 1234],
    ['12.3', 'GBP', 1230],
    ['12', 'GBP', 1200],
    ['-0.05', 'EUR', -5],
    ['1200', 'JPY', 1200],
    ['1200.5', 'JPY', 1200],
    ['1201.5', 'JPY', 1202],
    ['0.005', 'KWD', 5],
    ['1 234.56', 'EUR', 123456],
    ['0.125', 'GBP', 12],
    ['0.135', 'GBP', 14],
    ['.5', 'GBP', 50],
  ] as const)('fromMajor(%s, %s) = %s', (s, c, want) => {
    if (s === '.5') expect(() => fromMajor(s, c)).toThrow(SyntaxError);
    else expect(fromMajor(s, c).amount).toBe(want);
  });

  it('supports other rounding modes when parsing', () => {
    expect(fromMajor('0.125', 'GBP', 'half-up').amount).toBe(13);
  });

  it('rejects garbage', () => {
    expect(() => fromMajor('12,34', 'GBP')).toThrow(SyntaxError);
    expect(() => fromMajor('abc', 'GBP')).toThrow(SyntaxError);
  });

  it.each([
    [1234, 'GBP', '12.34'],
    [-5, 'GBP', '-0.05'],
    [1200, 'JPY', '1200'],
    [-7, 'JPY', '-7'],
    [5, 'KWD', '0.005'],
    [37125, 'KWD', '37.125'],
  ] as const)('toDecimalString(%s %s) = %s', (a, c, want) => {
    expect(toDecimalString(money(a, c))).toBe(want);
  });

  it('round-trips through the decimal string exactly (property)', () => {
    fc.assert(
      fc.property(minor, currency, (a, c) => {
        const m = money(a, c);
        expect(fromMajor(toDecimalString(m), c)).toEqual(m);
      }),
    );
  });

  it('gives an approximate number for charts only', () => {
    expect(toMajorNumber(money(1234, 'GBP'))).toBeCloseTo(12.34);
    expect(toMajorNumber(money(1234, 'KWD'))).toBeCloseTo(1.234);
  });
});

describe('allocate', () => {
  it('splits £100 three ways with no lost penny', () => {
    expect(split(money(10000, 'GBP'), 3).map((m) => m.amount)).toEqual([3334, 3333, 3333]);
  });

  it('respects weights and gives leftovers to the largest remainders', () => {
    expect(allocate(money(100, 'EUR'), [1, 2]).map((m) => m.amount)).toEqual([33, 67]);
    expect(allocate(money(5, 'JPY'), [1, 1, 1, 1, 1, 1]).map((m) => m.amount)).toEqual([1, 1, 1, 1, 1, 0]);
    expect(allocate(money(-10000, 'GBP'), [1, 1, 1]).map((m) => m.amount)).toEqual([-3334, -3333, -3333]);
    expect(allocate(money(100, 'GBP'), [0, 1]).map((m) => m.amount)).toEqual([0, 100]);
  });

  it('validates weights', () => {
    expect(() => allocate(money(1, 'GBP'), [])).toThrow(RangeError);
    expect(() => allocate(money(1, 'GBP'), [0, 0])).toThrow(RangeError);
    expect(() => allocate(money(1, 'GBP'), [1.5])).toThrow(RangeError);
    expect(() => allocate(money(1, 'GBP'), [-1, 2])).toThrow(RangeError);
    expect(() => split(money(1, 'GBP'), 0)).toThrow(RangeError);
  });

  it('always sums to the original amount (property)', () => {
    fc.assert(
      fc.property(
        minor,
        currency,
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 20 }),
        (a, c, w) => {
          fc.pre(w.some((x) => x > 0));
          const parts = allocate(money(a, c), w);
          expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(a);
          expect(parts.every((p) => p.currency === c)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('equal splits differ by at most one minor unit (property)', () => {
    fc.assert(
      fc.property(minor, fc.integer({ min: 1, max: 50 }), (a, n) => {
        const xs = split(money(a, 'GBP'), n).map((m) => m.amount);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe('multiplyBy', () => {
  it('applies decimal factors with banker’s rounding', () => {
    expect(multiplyBy(money(1005, 'GBP'), '0.5').amount).toBe(502);
    expect(multiplyBy(money(1015, 'GBP'), '0.5').amount).toBe(508);
    expect(multiplyBy(money(1000, 'GBP'), '-1.2').amount).toBe(-1200);
    expect(() => multiplyBy(money(1, 'GBP'), 'x')).toThrow(SyntaxError);
  });
});

describe('naive float baseline (what the engine replaces)', () => {
  it('loses a penny on a three-way split of £100', () => {
    const parts = naiveAllocate(100, [1, 1, 1], 2);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(9999);
  });

  it('mis-rounds 1.005 because 1.005 is not representable', () => {
    expect(roundTo(1.005, 2)).toBe(1); // exact half-up would be 1.01
    expect(fromMajor('1.005', 'GBP', 'half-up').amount).toBe(101);
    expect(naiveConvert(10, 1.1, 2)).toBe(11);
  });
});

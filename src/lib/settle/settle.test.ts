import fc from 'fast-check';
import { money } from '../money/money';
import {
  applyTransfers,
  balances,
  EXACT_LIMIT,
  greedyTransfers,
  optimalTransfers,
  pairwiseTransfers,
  type Expense,
} from './settle';

const e = (
  id: string,
  paidBy: string,
  amount: number,
  splitBetween: string[],
  weights?: number[],
): Expense => ({
  id,
  description: id,
  paidBy,
  amount: money(amount, 'EUR'),
  splitBetween,
  weights,
});

const allZero = (m: Map<string, number>) => [...m.values()].every((v) => v === 0);

describe('balances', () => {
  it('nets what each person paid against their share, summing to zero', () => {
    const net = balances(
      ['A', 'B', 'C'],
      [e('1', 'A', 3000, ['A', 'B', 'C']), e('2', 'B', 1000, ['A', 'B'], [1, 3])],
      'EUR',
    );
    expect(Object.fromEntries(net)).toEqual({ A: 2000 - 250, B: -1000 + 1000 - 750, C: -1000 });
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('keeps every cent when a bill does not divide evenly', () => {
    const net = balances(['A', 'B', 'C'], [e('1', 'A', 1000, ['A', 'B', 'C'])], 'EUR');
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('validates currency and participants', () => {
    expect(() => balances(['A'], [{ ...e('1', 'A', 1, ['A']), amount: money(1, 'GBP') }], 'EUR')).toThrow();
    expect(() => balances(['A'], [e('1', 'A', 1, [])], 'EUR')).toThrow();
  });
});

describe('settle-up plans', () => {
  const group = [
    e('1', 'A', 3000, ['A', 'B', 'C']),
    e('2', 'B', 3000, ['A', 'B', 'C']),
    e('3', 'C', 600, ['A', 'B', 'C']),
  ];

  it('pairwise pays each payer back, netted per pair', () => {
    const p = pairwiseTransfers(group, 'EUR');
    expect(p).toHaveLength(2);
    expect(allZero(applyTransfers(balances(['A', 'B', 'C'], group, 'EUR'), p))).toBe(true);
  });

  it('finds the zero-sum subgroups that greedy misses', () => {
    // A and B cancel each other, C and D cancel each other: optimum is 2 transfers.
    const net = new Map([
      ['A', 500],
      ['B', -500],
      ['C', 700],
      ['D', -300],
      ['E', -400],
    ]);
    expect(optimalTransfers(net, 'EUR')).toHaveLength(3);
    const tricky = new Map([
      ['A', 6],
      ['B', 4],
      ['C', -5],
      ['D', -5],
      ['E', 3],
      ['F', -3],
    ]);
    expect(optimalTransfers(tricky, 'EUR').length).toBeLessThanOrEqual(greedyTransfers(tricky, 'EUR').length);
    expect(optimalTransfers(tricky, 'EUR')).toHaveLength(4);
    expect(optimalTransfers(new Map([['A', 0]]), 'EUR')).toEqual([]);
  });

  it('falls back to greedy above the exact limit', () => {
    const big = new Map(Array.from({ length: EXACT_LIMIT + 2 }, (_, i) => [`P${i}`, i % 2 ? 100 : -100]));
    const plan = optimalTransfers(big, 'EUR');
    expect(allZero(applyTransfers(big, plan))).toBe(true);
  });

  it('every plan settles every balance to exactly zero, with optimal ≤ greedy ≤ n−1 (property)', () => {
    const people = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const expense = fc.record({
      payer: fc.integer({ min: 0, max: 6 }),
      amount: fc.integer({ min: 1, max: 100_000 }),
      mask: fc.integer({ min: 1, max: 127 }),
    });
    fc.assert(
      fc.property(fc.array(expense, { minLength: 1, maxLength: 15 }), (xs) => {
        const expenses = xs.map((x, i) =>
          e(
            String(i),
            people[x.payer]!,
            x.amount,
            people.filter((_, k) => x.mask & (1 << k)),
          ),
        );
        const net = balances(people, expenses, 'EUR');
        const opt = optimalTransfers(net, 'EUR');
        const gr = greedyTransfers(net, 'EUR');
        const pw = pairwiseTransfers(expenses, 'EUR');
        expect(allZero(applyTransfers(net, opt))).toBe(true);
        expect(allZero(applyTransfers(net, gr))).toBe(true);
        expect(allZero(applyTransfers(net, pw))).toBe(true);
        expect(opt.length).toBeLessThanOrEqual(gr.length);
        expect(gr.length).toBeLessThanOrEqual(Math.max(0, people.length - 1));
        expect(opt.every((t) => t.amount.amount > 0)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

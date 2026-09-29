import { addDays, addMonths } from '../data/dates';
import { enrich, generateHistory } from '../data/generate';
import { money } from '../money/money';
import {
  clusterByAmount,
  detectRecurring,
  fillRatio,
  findChain,
  CADENCES,
  medianStep,
  naiveRecurring,
  type Charge,
} from './detect';
import { nextDueAccuracy, score, sumScores } from './evaluate';

const c = (id: string, date: string, amount: number, merchantKey = 'netflix', category?: string): Charge => ({
  id,
  date,
  amount: money(-amount, 'GBP'),
  merchantKey,
  merchant: merchantKey,
  category,
});

function monthly(key: string, amount: number, n: number, start = '2025-01-15'): Charge[] {
  return Array.from({ length: n }, (_, i) => c(`${key}${i}`, addMonths(start, i), amount, key));
}

const MONTHLY = CADENCES.find((x) => x.cadence === 'monthly')!;

describe('detectRecurring', () => {
  it('finds a monthly subscription and predicts the next charge', () => {
    const [s] = detectRecurring(monthly('netflix', 1099, 12), '2025-12-20');
    expect(s).toMatchObject({
      merchantKey: 'netflix',
      cadence: 'monthly',
      count: 12,
      nextDue: '2026-01-15',
      active: true,
      priceChanged: false,
    });
    expect(s!.monthly.amount).toBe(1099);
  });

  it('follows a price rise within tolerance and flags it', () => {
    const charges = [...monthly('spotify', 1099, 6), ...monthly('spotify', 1199, 6, '2025-07-15')];
    const [s] = detectRecurring(charges, '2025-12-20');
    expect(s).toMatchObject({ cadence: 'monthly', count: 12, priceChanged: true });
    expect(s!.amount.amount).toBe(1199);
  });

  it('bridges a failed collection', () => {
    const charges = monthly('gym', 2499, 10).filter((_, i) => i !== 4);
    expect(detectRecurring(charges, '2025-10-20')[0]).toMatchObject({ cadence: 'monthly', count: 9 });
  });

  it('detects weekly and yearly cadences', () => {
    const weekly = Array.from({ length: 10 }, (_, i) =>
      c(`w${i}`, addDays('2025-03-01', i * 7), 2450, 'veg'),
    );
    const w = detectRecurring(weekly, '2025-05-10');
    expect(w[0]?.cadence).toBe('weekly');
    const y = detectRecurring(
      [c('y1', '2024-10-01', 31240, 'aviva'), c('y2', '2025-10-02', 33739, 'aviva')],
      '2025-11-01',
    );
    expect(y[0]).toMatchObject({ cadence: 'yearly', nextDue: '2026-10-02' });
  });

  it('ignores irregular purchases, income and transfers', () => {
    const coffee = [3, 4, 6, 7, 11, 12, 13, 20, 26, 27].map((d, i) =>
      c(`k${i}`, `2025-05-${String(d).padStart(2, '0')}`, 345, 'pret'),
    );
    expect(detectRecurring(coffee, '2025-06-01')).toEqual([]);
    const pot = monthly('savings', 20000, 8).map((x) => ({ ...x, category: 'transfers' }));
    expect(detectRecurring(pot, '2025-09-01')).toEqual([]);
    expect(
      detectRecurring([{ ...c('i', '2025-01-01', 1), amount: money(100, 'GBP') }], '2025-02-01'),
    ).toEqual([]);
  });

  it('marks stopped subscriptions inactive', () => {
    expect(detectRecurring(monthly('disney', 799, 6), '2026-01-01')[0]?.active).toBe(false);
  });

  it('helpers behave', () => {
    expect(
      clusterByAmount([c('a', '2025-01-01', 100), c('b', '2025-02-01', 500), c('c', '2025-03-01', 105)]),
    ).toHaveLength(2);
    const chain = findChain(monthly('n', 100, 5), MONTHLY);
    expect(chain).toHaveLength(5);
    expect(fillRatio(chain, MONTHLY)).toBe(1);
    expect(medianStep([c('a', '2025-01-01', 100)])).toBe(0);
    expect(medianStep(monthly('n', 100, 3))).toBe(0);
  });
});

describe('naive baseline and scoring', () => {
  it('flags any repeated identical amount (false positive on coffee)', () => {
    const coffee = [3, 4, 6, 7, 11].map((d, i) =>
      c(`k${i}`, `2025-05-${String(d).padStart(2, '0')}`, 345, 'pret'),
    );
    expect(naiveRecurring(coffee)).toEqual([{ merchantKey: 'pret', cadence: 'weekly' }]);
    expect(naiveRecurring([...monthly('n', 100, 3), ...monthly('n', 100, 3, '2025-06-15')])).toEqual([
      { merchantKey: 'n', cadence: 'monthly' },
    ]);
  });

  it('scores precision/recall and next-due accuracy', () => {
    const truth = [
      { merchant: 'Netflix', cadence: 'monthly' as const, dates: [], active: true, nextDue: '2026-01-15' },
    ];
    const s = score(
      [
        { merchantKey: 'netflix', cadence: 'monthly' },
        { merchantKey: 'pret', cadence: 'weekly' },
      ],
      truth,
    );
    expect(s).toMatchObject({ tp: 1, fp: 1, fn: 0, precision: 0.5, recall: 1 });
    expect(score([], [])).toMatchObject({ precision: 1, recall: 1 });
    expect(sumScores([s, s])).toMatchObject({ tp: 2, fp: 2, precision: 0.5 });
    expect(sumScores([])).toMatchObject({ precision: 1, recall: 1 });
    expect(
      nextDueAccuracy([{ merchantKey: 'netflix', cadence: 'monthly', nextDue: '2026-01-17' }], truth),
    ).toEqual({ hits: 1, total: 1 });
    expect(nextDueAccuracy([], truth)).toEqual({ hits: 0, total: 0 });
  });

  it('beats the baseline on seeded synthetic users', () => {
    const scores = [];
    const naive = [];
    for (let u = 0; u < 5; u++) {
      const h = generateHistory({ seed: 777 + u });
      const tx = enrich(h.transactions);
      scores.push(score(detectRecurring(tx, h.end), h.truth));
      naive.push(score(naiveRecurring(tx), h.truth));
    }
    expect(sumScores(scores).f1).toBeGreaterThan(sumScores(naive).f1);
    expect(sumScores(scores).precision).toBeGreaterThan(0.9);
  });
});

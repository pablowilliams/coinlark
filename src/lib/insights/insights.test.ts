import { enrich, generateHistory } from '../data/generate';
import type { Transaction } from '../data/types';
import { FIXTURE_RATES } from '../money/rates';
import { money } from '../money/money';
import {
  balancesInBase,
  budgetProgress,
  categoryTotals,
  DEFAULT_BUDGETS,
  kpis,
  spendByMonth,
  toBase,
} from './insights';

const tx = (
  date: string,
  amount: number,
  category: Transaction['category'],
  currency: 'GBP' | 'EUR' = 'GBP',
): Transaction => ({
  id: `${date}${amount}`,
  date,
  accountId: 'a',
  amount: money(amount, currency),
  raw: 'x',
  truth: { category, merchant: null },
  category,
  merchant: 'x',
  merchantKey: 'x',
  method: 'exact',
});

const rows = [
  tx('2026-08-03', -5000, 'groceries'),
  tx('2026-08-10', -2000, 'eating-out'),
  tx('2026-08-12', -10000, 'transfers'),
  tx('2026-08-25', 300000, 'income'),
  tx('2026-07-05', -4000, 'groceries'),
  tx('2026-07-25', 300000, 'income'),
  tx('2026-08-15', -1170, 'groceries', 'EUR'),
];

describe('insights', () => {
  it('spends by month and category, excluding transfers and converting currencies', () => {
    const months = spendByMonth(rows, 'GBP', FIXTURE_RATES, '2026-09-28', 3);
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    const aug = months[1]!;
    const eurInGbp = -toBase(money(-1170, 'EUR'), 'GBP', FIXTURE_RATES);
    expect(aug.total.amount).toBe(7000 + eurInGbp);
    expect(aug.byCategory.transfers).toBeUndefined();
    expect(months[2]!.total.amount).toBe(0);
    const cats = categoryTotals(aug);
    expect(cats[0]!.category).toBe('groceries');
    expect(cats.reduce((a, c) => a + c.share, 0)).toBeCloseTo(1);
    expect(categoryTotals({ ...months[2]!, byCategory: {} })).toEqual([]);
  });

  it('computes KPIs for the last complete month vs the one before', () => {
    const k = kpis(rows, 'GBP', FIXTURE_RATES, '2026-09-28');
    expect(k.month).toBe('2026-08');
    expect(k.previousMonth).toBe('2026-07');
    const spent = k.tiles.find((t) => t.id === 'spent')!;
    expect(spent.previous).toBe(4000);
    expect(spent.change).toBeCloseTo((spent.current - 4000) / 4000);
    expect(k.tiles.find((t) => t.id === 'income')!.change).toBe(0);
    const empty = kpis([], 'GBP', FIXTURE_RATES, '2026-09-28');
    expect(empty.tiles.every((t) => t.change === null || t.change === 0)).toBe(true);
  });

  it('tracks budget progress with warning and over states', () => {
    const month = {
      month: '2026-08',
      total: money(100000, 'GBP'),
      byCategory: { groceries: 50000, 'eating-out': 21000, transport: 1000 },
    };
    const p = budgetProgress(month, DEFAULT_BUDGETS, FIXTURE_RATES);
    expect(p.find((b) => b.category === 'groceries')!.status).toBe('over');
    expect(p.find((b) => b.category === 'eating-out')!.status).toBe('warning');
    expect(p.find((b) => b.category === 'transport')!.status).toBe('ok');
    expect(
      budgetProgress(month, [{ category: 'travel', limit: money(0, 'GBP') }], FIXTURE_RATES)[0]!.ratio,
    ).toBe(0);
  });

  it('totals multi-currency balances in any base', () => {
    const h = generateHistory({ seed: 1, months: 2 });
    const b = balancesInBase(h.accounts, 'EUR', FIXTURE_RATES);
    expect(b.lines).toHaveLength(5);
    expect(b.total.amount).toBe(b.lines.reduce((a, l) => a + l.inBase.amount, 0));
    expect(b.lines[1]!.inBase).toEqual(h.accounts[1]!.balance);
  });

  it('runs on the seeded history end to end', () => {
    const h = generateHistory({ seed: 20260929, subscriptions: 9 });
    const e = enrich(h.transactions);
    const months = spendByMonth(e, 'GBP', FIXTURE_RATES, h.end, 12);
    expect(months.every((m) => Number.isInteger(m.total.amount) && m.total.amount > 0)).toBe(true);
  });
});

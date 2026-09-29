import { type CategoryId, SPENDING_CATEGORIES } from '../data/categories';
import { addMonths, lastMonths, monthKey } from '../data/dates';
import type { Account, Transaction } from '../data/types';
import type { CurrencyCode } from '../money/currency';
import { convert, type RateTable } from '../money/fx';
import { type Money, money } from '../money/money';

/** Convert a signed amount into the base currency (exact integer maths, banker's rounding). */
export function toBase(m: Money, base: CurrencyCode, rates: RateTable): number {
  return m.currency === base ? m.amount : convert(m, base, rates).to.amount;
}

export interface MonthSpend {
  readonly month: string;
  readonly total: Money;
  readonly byCategory: Readonly<Partial<Record<CategoryId, number>>>;
}

/** Spending (money out, excluding transfers) per month and category, in the base currency. */
export function spendByMonth(
  txns: readonly Transaction[],
  base: CurrencyCode,
  rates: RateTable,
  end: string,
  months = 12,
): MonthSpend[] {
  const keys = lastMonths(end, months);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const rows = keys.map(() => ({ total: 0, byCategory: {} as Partial<Record<CategoryId, number>> }));
  for (const t of txns) {
    if (t.amount.amount >= 0 || !SPENDING_CATEGORIES.includes(t.category)) continue;
    const i = idx.get(monthKey(t.date));
    if (i === undefined) continue;
    const v = -toBase(t.amount, base, rates);
    const row = rows[i]!;
    row.total += v;
    row.byCategory[t.category] = (row.byCategory[t.category] ?? 0) + v;
  }
  return keys.map((month, i) => ({
    month,
    total: money(rows[i]!.total, base),
    byCategory: rows[i]!.byCategory,
  }));
}

export interface CategoryTotal {
  readonly category: CategoryId;
  readonly amount: Money;
  readonly share: number;
}

export function categoryTotals(month: MonthSpend): CategoryTotal[] {
  const total = month.total.amount || 1;
  return (Object.entries(month.byCategory) as Array<[CategoryId, number]>)
    .map(([category, v]) => ({ category, amount: money(v, month.total.currency), share: v / total }))
    .sort((a, b) => b.amount.amount - a.amount.amount);
}

export interface Kpi {
  readonly id: 'spent' | 'income' | 'net' | 'savingsRate';
  readonly current: number;
  readonly previous: number;
  /** Relative change vs the previous period, or null when the previous value is 0. */
  readonly change: number | null;
  readonly currency: CurrencyCode | null;
}

function change(cur: number, prev: number): number | null {
  return prev === 0 ? null : (cur - prev) / Math.abs(prev);
}

/**
 * KPI tiles for the latest complete month versus the month before. Uses complete months so a
 * partially elapsed month is never compared with a full one.
 */
export function kpis(
  txns: readonly Transaction[],
  base: CurrencyCode,
  rates: RateTable,
  end: string,
): { month: string; previousMonth: string; tiles: Kpi[] } {
  const month = monthKey(addMonths(`${monthKey(end)}-01`, -1));
  const previousMonth = monthKey(addMonths(`${month}-01`, -1));
  const agg = (m: string) => {
    let spent = 0;
    let income = 0;
    for (const t of txns) {
      if (monthKey(t.date) !== m || t.category === 'transfers') continue;
      const v = toBase(t.amount, base, rates);
      if (v < 0) spent -= v;
      else income += v;
    }
    return { spent, income, net: income - spent, savingsRate: income ? (income - spent) / income : 0 };
  };
  const c = agg(month);
  const p = agg(previousMonth);
  const tiles: Kpi[] = [
    { id: 'spent', current: c.spent, previous: p.spent, change: change(c.spent, p.spent), currency: base },
    {
      id: 'income',
      current: c.income,
      previous: p.income,
      change: change(c.income, p.income),
      currency: base,
    },
    { id: 'net', current: c.net, previous: p.net, change: change(c.net, p.net), currency: base },
    {
      id: 'savingsRate',
      current: c.savingsRate,
      previous: p.savingsRate,
      change: c.savingsRate - p.savingsRate,
      currency: null,
    },
  ];
  return { month, previousMonth, tiles };
}

export interface Budget {
  readonly category: CategoryId;
  /** Monthly limit in GBP minor units; converted to the base currency for display. */
  readonly limit: Money;
}

export const DEFAULT_BUDGETS: readonly Budget[] = [
  { category: 'groceries', limit: money(45000, 'GBP') },
  { category: 'eating-out', limit: money(25000, 'GBP') },
  { category: 'transport', limit: money(20000, 'GBP') },
  { category: 'shopping', limit: money(30000, 'GBP') },
  { category: 'entertainment', limit: money(9000, 'GBP') },
];

export interface BudgetProgress {
  readonly category: CategoryId;
  readonly spent: Money;
  readonly limit: Money;
  readonly ratio: number;
  readonly status: 'ok' | 'warning' | 'over';
}

export function budgetProgress(
  month: MonthSpend,
  budgets: readonly Budget[],
  rates: RateTable,
): BudgetProgress[] {
  const base = month.total.currency;
  return budgets.map((b) => {
    const limit = money(toBase(b.limit, base, rates), base);
    const spent = money(month.byCategory[b.category] ?? 0, base);
    const ratio = limit.amount ? spent.amount / limit.amount : 0;
    return {
      category: b.category,
      spent,
      limit,
      ratio,
      status: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok',
    };
  });
}

export interface BalanceLine {
  readonly account: Account;
  readonly inBase: Money;
}

export function balancesInBase(
  accounts: readonly Account[],
  base: CurrencyCode,
  rates: RateTable,
): { lines: BalanceLine[]; total: Money } {
  const lines = accounts.map((account) => ({
    account,
    inBase: money(toBase(account.balance, base, rates), base),
  }));
  return {
    lines,
    total: money(
      lines.reduce((a, l) => a + l.inBase.amount, 0),
      base,
    ),
  };
}

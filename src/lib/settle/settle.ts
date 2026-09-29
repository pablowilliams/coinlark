import type { CurrencyCode } from '../money/currency';
import { allocate, type Money, money } from '../money/money';

export interface Expense {
  readonly id: string;
  readonly description: string;
  readonly paidBy: string;
  readonly amount: Money;
  /** Who shares the cost. Defaults to an equal split; optional integer weights (e.g. 2 for a couple). */
  readonly splitBetween: readonly string[];
  readonly weights?: readonly number[];
}

export interface Transfer {
  readonly from: string;
  readonly to: string;
  readonly amount: Money;
}

/** Net position per member in minor units: positive = is owed money, negative = owes money. Always sums to 0. */
export function balances(
  members: readonly string[],
  expenses: readonly Expense[],
  currency: CurrencyCode,
): Map<string, number> {
  const net = new Map<string, number>(members.map((m) => [m, 0]));
  for (const e of expenses) {
    if (e.amount.currency !== currency) throw new Error(`Expense ${e.id} is not in ${currency}`);
    if (e.splitBetween.length === 0) throw new Error(`Expense ${e.id} has nobody to split between`);
    const shares = allocate(e.amount, e.weights ?? e.splitBetween.map(() => 1));
    net.set(e.paidBy, (net.get(e.paidBy) ?? 0) + e.amount.amount);
    e.splitBetween.forEach((who, i) => net.set(who, (net.get(who) ?? 0) - shares[i]!.amount));
  }
  return net;
}

/**
 * Naive settle-up: everyone pays back each payer for each expense they shared, netted per pair of people.
 * This is what you get from "everyone just pays back whoever paid".
 */
export function pairwiseTransfers(expenses: readonly Expense[], currency: CurrencyCode): Transfer[] {
  const owed = new Map<string, number>(); // "a→b" → amount a owes b
  for (const e of expenses) {
    const shares = allocate(e.amount, e.weights ?? e.splitBetween.map(() => 1));
    e.splitBetween.forEach((who, i) => {
      if (who === e.paidBy) return;
      const k = `${who}\u0000${e.paidBy}`;
      owed.set(k, (owed.get(k) ?? 0) + shares[i]!.amount);
    });
  }
  const out: Transfer[] = [];
  const done = new Set<string>();
  for (const [k, v] of owed) {
    const [a, b] = k.split('\u0000') as [string, string];
    const pair = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
    if (done.has(pair)) continue;
    done.add(pair);
    const back = owed.get(`${b}\u0000${a}`) ?? 0;
    const netAmt = v - back;
    if (netAmt > 0) out.push({ from: a, to: b, amount: money(netAmt, currency) });
    else if (netAmt < 0) out.push({ from: b, to: a, amount: money(-netAmt, currency) });
  }
  return out;
}

/** Greedy: repeatedly settle the largest debtor against the largest creditor. At most n − 1 transfers. */
export function greedyTransfers(net: ReadonlyMap<string, number>, currency: CurrencyCode): Transfer[] {
  const debtors = [...net].filter(([, v]) => v < 0).map(([k, v]) => ({ k, v: -v }));
  const creditors = [...net].filter(([, v]) => v > 0).map(([k, v]) => ({ k, v }));
  const out: Transfer[] = [];
  const byAmount = (a: { k: string; v: number }, b: { k: string; v: number }) =>
    b.v - a.v || (a.k < b.k ? -1 : 1);
  while (debtors.length && creditors.length) {
    debtors.sort(byAmount);
    creditors.sort(byAmount);
    const d = debtors[0]!;
    const c = creditors[0]!;
    const x = Math.min(d.v, c.v);
    out.push({ from: d.k, to: c.k, amount: money(x, currency) });
    d.v -= x;
    c.v -= x;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return out;
}

export const EXACT_LIMIT = 16;

/**
 * Minimum number of transfers. With k people who are owed or owe money, the optimum is k − (the largest
 * number of disjoint zero-sum subgroups), found by dynamic programming over subsets (k ≤ 16). Each subgroup
 * then settles internally with the greedy method. Falls back to greedy for larger groups.
 */
export function optimalTransfers(net: ReadonlyMap<string, number>, currency: CurrencyCode): Transfer[] {
  const people = [...net].filter(([, v]) => v !== 0);
  const k = people.length;
  if (k === 0) return [];
  if (k > EXACT_LIMIT) return greedyTransfers(net, currency);
  const full = (1 << k) - 1;
  const sums = new Float64Array(1 << k);
  const dp = new Int8Array(1 << k);
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    const i = 31 - Math.clz32(low);
    sums[mask] = sums[mask ^ low]! + people[i]![1];
    let best = 0;
    for (let rest = mask; rest; rest &= rest - 1) {
      const bit = rest & -rest;
      const v = dp[mask ^ bit]!;
      if (v > best) best = v;
    }
    dp[mask] = best + (sums[mask] === 0 ? 1 : 0);
  }
  // Reconstruct: peel members off in an order whose zero-sum prefixes mark the subgroups.
  const groups: number[][] = [];
  let current: number[] = [];
  let mask = full;
  while (mask) {
    const bonus = sums[mask] === 0 ? 1 : 0;
    let chosen = -1;
    for (let rest = mask; rest; rest &= rest - 1) {
      const bit = rest & -rest;
      if (dp[mask ^ bit]! + bonus === dp[mask]) {
        chosen = 31 - Math.clz32(bit);
        break;
      }
    }
    if (bonus && current.length) {
      groups.push(current);
      current = [];
    }
    current.push(chosen);
    mask ^= 1 << chosen;
  }
  if (current.length) groups.push(current);
  const out: Transfer[] = [];
  for (const g of groups) out.push(...greedyTransfers(new Map(g.map((i) => people[i]!)), currency));
  return out;
}

/** Apply transfers to balances; a correct settlement leaves everyone at exactly zero. */
export function applyTransfers(
  net: ReadonlyMap<string, number>,
  transfers: readonly Transfer[],
): Map<string, number> {
  const out = new Map(net);
  for (const t of transfers) {
    out.set(t.from, (out.get(t.from) ?? 0) + t.amount.amount);
    out.set(t.to, (out.get(t.to) ?? 0) - t.amount.amount);
  }
  return out;
}

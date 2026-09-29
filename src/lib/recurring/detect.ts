import { addDays, addMonths, daysBetween } from '../data/dates';
import type { Cadence } from '../data/merchants';
import type { CurrencyCode } from '../money/currency';
import { type Money, money } from '../money/money';

export interface Charge {
  readonly id: string;
  readonly date: string;
  readonly amount: Money;
  readonly merchantKey: string;
  readonly merchant: string;
  /** Transfers between your own pots and income are never treated as subscriptions. */
  readonly category?: string;
}

export interface RecurringSeries {
  readonly merchantKey: string;
  readonly merchant: string;
  readonly cadence: Cadence;
  /** Latest charge (positive amount). */
  readonly amount: Money;
  /** Cost normalised to a month, for totals. */
  readonly monthly: Money;
  readonly count: number;
  readonly first: string;
  readonly last: string;
  readonly nextDue: string;
  readonly active: boolean;
  /** Share of the amount cluster explained by the regular chain, times interval regularity. */
  readonly confidence: number;
  readonly chargeIds: readonly string[];
  readonly priceChanged: boolean;
}

interface CadenceSpec {
  readonly cadence: Cadence;
  readonly period: number;
  readonly tolerance: number;
  readonly minCount: number;
}

export const CADENCES: readonly CadenceSpec[] = [
  { cadence: 'weekly', period: 7, tolerance: 1.5, minCount: 6 },
  { cadence: 'monthly', period: 30.44, tolerance: 4, minCount: 3 },
  { cadence: 'yearly', period: 365.25, tolerance: 7, minCount: 2 },
];

export const AMOUNT_TOLERANCE = 0.16;
/** Subscriptions charge a fixed price that changes rarely: the median step between charges must be tiny. */
export const MAX_MEDIAN_STEP = 0.02;
export const MIN_FILL = 0.75;
const EXCLUDED = new Set(['transfers', 'income']);
export const MIN_COVERAGE = 0.6;

/** Cluster a merchant's charges (oldest first) so that each cluster tracks one price, allowing gradual rises. */
export function clusterByAmount(charges: readonly Charge[], tolerance = AMOUNT_TOLERANCE): Charge[][] {
  const clusters: Charge[][] = [];
  for (const c of charges) {
    const a = Math.abs(c.amount.amount);
    let best: Charge[] | null = null;
    let bestDiff = Infinity;
    for (const cl of clusters) {
      const last = Math.abs(cl[cl.length - 1]!.amount.amount);
      const diff = Math.abs(a - last) / Math.max(last, 1);
      if (diff <= tolerance && diff < bestDiff) {
        best = cl;
        bestDiff = diff;
      }
    }
    if (best) best.push(c);
    else clusters.push([c]);
  }
  return clusters;
}

/**
 * Walk back from the newest charge, each step looking for a charge one period earlier (or two or three, allowing
 * for failed collections). Returns the chain oldest-first.
 */
export function findChain(cluster: readonly Charge[], spec: CadenceSpec): Charge[] {
  const chain: Charge[] = [cluster[cluster.length - 1]!];
  let i = cluster.length - 1;
  while (i > 0) {
    const cur = chain[chain.length - 1]!;
    let pick = -1;
    let pickErr = Infinity;
    for (let j = i - 1; j >= 0; j--) {
      const gap = daysBetween(cluster[j]!.date, cur.date);
      if (gap > 3 * spec.period + spec.tolerance) break;
      for (const k of [1, 2, 3]) {
        const err = Math.abs(gap - k * spec.period) + (k - 1) * spec.tolerance; // prefer single steps
        if (Math.abs(gap - k * spec.period) <= spec.tolerance && err < pickErr) {
          pick = j;
          pickErr = err;
        }
      }
    }
    if (pick < 0) break;
    chain.push(cluster[pick]!);
    i = pick;
  }
  return chain.reverse();
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Charges found ÷ charges expected over the chain's span: low when the "chain" is mostly gaps. */
export function fillRatio(chain: readonly Charge[], spec: { period: number }): number {
  const span = daysBetween(chain[0]!.date, chain[chain.length - 1]!.date);
  return chain.length / (Math.round(span / spec.period) + 1);
}

/** Median relative change between consecutive charges in a chain. */
export function medianStep(chain: readonly Charge[]): number {
  if (chain.length < 2) return 0;
  const steps = chain.slice(1).map((c, i) => {
    const prev = Math.abs(chain[i]!.amount.amount);
    return Math.abs(Math.abs(c.amount.amount) - prev) / Math.max(prev, 1);
  });
  return median(steps);
}

function nextDate(chain: readonly Charge[], spec: CadenceSpec): string {
  const last = chain[chain.length - 1]!.date;
  if (spec.cadence === 'weekly') return addDays(last, 7);
  const anchor = Math.round(median(chain.map((c) => Number(c.date.slice(8, 10)))));
  return addMonths(last, spec.cadence === 'monthly' ? 1 : 12, anchor);
}

function monthlyEquivalent(m: Money, cadence: Cadence): Money {
  const factor = cadence === 'weekly' ? 52 / 12 : cadence === 'monthly' ? 1 : 1 / 12;
  return money(Math.round(m.amount * factor), m.currency);
}

/** Detect recurring outgoing payments from a list of charges (debits, any order). */
export function detectRecurring(charges: readonly Charge[], today: string): RecurringSeries[] {
  const groups = new Map<string, Charge[]>();
  for (const c of charges) {
    if (c.amount.amount >= 0 || (c.category && EXCLUDED.has(c.category))) continue;
    const key = `${c.merchantKey}|${c.amount.currency}`;
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  const out: RecurringSeries[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const cluster of clusterByAmount(group)) {
      if (cluster.length < 2) continue;
      let best: { spec: CadenceSpec; chain: Charge[]; score: number } | null = null;
      for (const spec of CADENCES) {
        if (cluster.length < spec.minCount) continue;
        const chain = findChain(cluster, spec);
        if (chain.length < spec.minCount) continue;
        if (fillRatio(chain, spec) < MIN_FILL) continue;
        if (spec.cadence !== 'yearly' && medianStep(chain) > MAX_MEDIAN_STEP) continue;
        // Two charges a year apart are weak evidence: only trust them from a merchant we rarely pay otherwise.
        if (spec.cadence === 'yearly' && chain.length / group.length < MIN_COVERAGE) continue;
        const coverage = chain.length / cluster.length;
        if (coverage < MIN_COVERAGE) continue;
        const score = coverage * chain.length;
        if (!best || score > best.score) best = { spec, chain, score };
      }
      if (!best) continue;
      const { spec, chain } = best;
      const last = chain[chain.length - 1]!;
      const amount = money(Math.abs(last.amount.amount), last.amount.currency as CurrencyCode);
      const first = chain[0]!;
      const next = nextDate(chain, spec);
      const coverage = chain.length / cluster.length;
      out.push({
        merchantKey: last.merchantKey,
        merchant: last.merchant,
        cadence: spec.cadence,
        amount,
        monthly: monthlyEquivalent(amount, spec.cadence),
        count: chain.length,
        first: first.date,
        last: last.date,
        nextDue: next,
        active: daysBetween(last.date, today) <= spec.period * 1.5 + spec.tolerance,
        confidence: Number(coverage.toFixed(2)),
        chargeIds: chain.map((c) => c.id),
        priceChanged: chain.some((c) => c.amount.amount !== first.amount.amount),
      });
    }
  }
  return out.sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
}

/**
 * Naive baseline: the same merchant charging the exact same amount three or more times is "recurring";
 * cadence is the period nearest to the median gap.
 */
export function naiveRecurring(charges: readonly Charge[]): Array<{ merchantKey: string; cadence: Cadence }> {
  const groups = new Map<string, Charge[]>();
  for (const c of charges) {
    if (c.amount.amount >= 0 || (c.category && EXCLUDED.has(c.category))) continue;
    const key = `${c.merchantKey}|${c.amount.currency}|${c.amount.amount}`;
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  const out: Array<{ merchantKey: string; cadence: Cadence }> = [];
  const seen = new Set<string>();
  for (const g of groups.values()) {
    if (g.length < 3) continue;
    g.sort((a, b) => (a.date < b.date ? -1 : 1));
    const gaps = g.slice(1).map((c, i) => daysBetween(g[i]!.date, c.date));
    const med = median(gaps);
    const cadence = CADENCES.reduce((a, b) =>
      Math.abs(b.period - med) < Math.abs(a.period - med) ? b : a,
    ).cadence;
    const key = `${g[0]!.merchantKey}|${cadence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ merchantKey: g[0]!.merchantKey, cadence });
  }
  return out;
}

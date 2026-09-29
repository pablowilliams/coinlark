import { Categoriser } from '../categorise/categorise';
import type { CurrencyCode } from '../money/currency';
import { fromMajor, money } from '../money/money';
import type { CategoryId } from './categories';
import { addDays, addMonths, toDays, fromDays } from './dates';
import { MERCHANTS, RECURRING_POOL, type Cadence, type MerchantDef } from './merchants';
import { FEED_NOISE, messyMerchant } from './noise';
import { createRng, type Rng } from './rng';
import type { Account, RawTransaction, Transaction, TruthSeries } from './types';

/** The synthetic "today": all data ends here so every run and screenshot is identical. */
export const DATA_END = '2026-09-28';
export const DEFAULT_SEED = 20260929;

/** Rough spending multipliers so a £10 coffee is ~€11.7 or ~¥2,000. Only used to make synthetic amounts. */
const PRICE_LEVEL: Record<CurrencyCode, number> = {
  GBP: 1,
  EUR: 1.17,
  USD: 1.33,
  CHF: 1.1,
  JPY: 208,
  KWD: 0.41,
};

const BY_NAME = new Map(MERCHANTS.map((m) => [m.name, m]));
export function merchantByName(name: string): MerchantDef {
  const m = BY_NAME.get(name);
  if (!m) throw new Error(`Unknown merchant ${name}`);
  return m;
}

function amountIn(major: number, currency: CurrencyCode) {
  const scaled = major * PRICE_LEVEL[currency];
  const places = currency === 'JPY' ? 0 : 2;
  return fromMajor(scaled.toFixed(places), currency);
}

function weightedPicker(rng: Rng, items: readonly MerchantDef[]): () => MerchantDef {
  const pool = items.filter((m) => m.weight > 0);
  const total = pool.reduce((a, m) => a + m.weight, 0);
  return () => {
    let x = rng.next() * total;
    for (const m of pool) {
      x -= m.weight;
      if (x < 0) return m;
    }
    return pool[pool.length - 1]!;
  };
}

function randomSpend(rng: Rng, m: MerchantDef): number {
  const [lo, hi] = m.range;
  // skew towards the low end of the range, like real card spend
  return lo + (hi - lo) * rng.next() ** 1.8;
}

export interface History {
  readonly accounts: Account[];
  readonly transactions: RawTransaction[];
  readonly truth: TruthSeries[];
  readonly end: string;
}

export interface HistoryOptions {
  readonly seed: number;
  readonly months?: number;
  readonly end?: string;
  /** How many recurring series to plant (drawn from RECURRING_POOL). */
  readonly subscriptions?: number;
}

const PERIOD_DAYS: Record<Cadence, number> = { weekly: 7, monthly: 30, yearly: 365 };

function schedule(rng: Rng, cadence: Cadence, start: string, stop: string): string[] {
  const dates: string[] = [];
  const anchor = Number(start.slice(8, 10));
  for (let k = 0; k < 400; k++) {
    let base: string;
    if (cadence === 'monthly') base = addMonths(start, k, anchor);
    else if (cadence === 'yearly') base = addMonths(start, 12 * k, anchor);
    else base = addDays(start, 7 * k);
    if (base > stop) break;
    const jitter =
      cadence === 'weekly' ? rng.int(0, 1) : cadence === 'monthly' ? rng.int(0, 2) : rng.int(0, 3);
    dates.push(addDays(base, jitter));
  }
  return dates;
}

/**
 * One person's seeded account history with planted recurring payments (ground truth) and realistic
 * distractors: daily coffees at a fixed price, weekly grocery shops of varying size, random Amazon orders.
 */
export function generateHistory(opts: HistoryOptions): History {
  const rng = createRng(opts.seed);
  const end = opts.end ?? DATA_END;
  const months = opts.months ?? 24;
  const start = addMonths(end, -months);
  const txns: Omit<RawTransaction, 'id'>[] = [];
  const truth: TruthSeries[] = [];
  const main = 'acc-gbp';

  const push = (
    date: string,
    accountId: string,
    currency: CurrencyCode,
    major: number,
    m: MerchantDef,
    sign = -1,
  ) => {
    const amt = amountIn(major, currency);
    txns.push({
      date,
      accountId,
      amount: money(sign * Math.abs(amt.amount), currency),
      raw: messyMerchant(m.name, rng, FEED_NOISE),
      truth: { category: m.category, merchant: m.name },
    });
  };

  // Income and fixed outgoings
  let salary = 3450 + rng.int(0, 60) * 10;
  const rentDates: string[] = [];
  for (let k = 0; k <= months; k++) {
    const payday = addMonths(start, k, 25);
    if (payday > end) break;
    if (k === 12) salary = Math.round(salary * 1.04);
    push(payday, main, 'GBP', salary, merchantByName('Payroll'), 1);
    const rentDay = addMonths(start, k, 1);
    if (rentDay >= start && rentDay <= end) {
      push(rentDay, main, 'GBP', 1250, merchantByName('Landlord Rent'));
      rentDates.push(rentDay);
    }
    const pot = addMonths(start, k, 26);
    if (pot <= end) push(pot, main, 'GBP', 150 + rng.int(0, 5) * 25, merchantByName('Savings Pot'));
  }

  truth.push({
    merchant: 'Landlord Rent',
    cadence: 'monthly',
    dates: rentDates,
    active: true,
    nextDue: addMonths(end, 1, 1),
  });

  // Planted recurring series
  const pool = [...RECURRING_POOL];
  const count = Math.min(opts.subscriptions ?? 8, pool.length);
  for (let i = 0; i < count; i++) {
    const def = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
    const m = merchantByName(def.merchant);
    const offset = def.cadence === 'yearly' ? rng.int(0, 60) : rng.int(0, Math.floor(months * 30 * 0.4));
    const first = addDays(start, offset);
    const cancelled = def.cadence !== 'yearly' && rng.chance(0.2);
    const stop = cancelled ? addDays(end, -rng.int(70, 200)) : end;
    const all = schedule(rng, def.cadence, first, addDays(end, 400));
    const dates = all.filter((d) => d <= stop && d >= start);
    const next = cancelled ? null : (all.find((d) => d > end) ?? null);
    const minCount = def.cadence === 'yearly' ? 2 : 3;
    if (dates.length < minCount) continue;
    const riseAt = rng.chance(0.3) ? rng.int(1, dates.length - 1) : -1;
    const riseFactor = 1 + rng.int(8, 15) / 100;
    const charged: string[] = [];
    dates.forEach((d, idx) => {
      if (def.cadence !== 'yearly' && rng.chance(0.03)) return; // a failed collection
      const amount = idx >= riseAt && riseAt >= 0 ? def.amount * riseFactor : def.amount;
      push(d, main, 'GBP', Number(amount.toFixed(2)), m);
      charged.push(d);
    });
    truth.push({ merchant: m.name, cadence: def.cadence, dates: charged, active: !cancelled, nextDue: next });
  }

  // Everyday spending
  const pick = weightedPicker(rng, MERCHANTS);
  const coffee = rng.pick(['Pret A Manger', 'Costa Coffee', 'Starbucks']);
  const coffeePrice = rng.pick([2.95, 3.2, 3.45, 3.6]);
  const grocer = rng.pick(['Tesco', "Sainsbury's", 'Lidl', 'Aldi']);
  const shopDay = rng.int(0, 6);
  const tripStarts = [rng.int(60, 200), rng.int(260, 420), rng.int(480, 640)];
  const tripCurrency: CurrencyCode[] = ['EUR', 'EUR', rng.pick(['USD', 'JPY', 'EUR'])];
  const tfl = merchantByName('TfL');
  for (let day = toDays(start); day <= toDays(end); day++) {
    const date = fromDays(day);
    const dayIdx = day - toDays(start);
    const tripIdx = tripStarts.findIndex((s) => dayIdx >= s && dayIdx < s + 8);
    const onTrip = tripIdx >= 0;
    const currency: CurrencyCode = onTrip ? tripCurrency[tripIdx]! : 'GBP';
    const account = onTrip ? `acc-${currency.toLowerCase()}` : main;
    const weekday = (day + 4) % 7; // 1970-01-01 was a Thursday; 0 = Sunday
    if (!onTrip && weekday >= 1 && weekday <= 5) {
      if (rng.chance(0.55)) push(date, main, 'GBP', coffeePrice, merchantByName(coffee));
      if (rng.chance(0.7)) push(date, main, 'GBP', 2.8, tfl);
    }
    if (!onTrip && weekday === shopDay && rng.chance(0.85)) {
      push(date, main, 'GBP', 35 + rng.next() * 60, merchantByName(grocer));
    }
    const extra = rng.int(0, 2);
    for (let k = 0; k < extra; k++) {
      const m = pick();
      if (onTrip && (m.category === 'bills' || m.category === 'transfers')) continue;
      push(date, account, currency, randomSpend(rng, m), m);
    }
  }

  txns.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const transactions = txns.map((t, i) => ({
    ...t,
    id: `h${opts.seed % 100000}-${String(i).padStart(5, '0')}`,
  }));
  const accounts: Account[] = [
    { id: 'acc-gbp', name: 'Everyday', currency: 'GBP', balance: fromMajor('4218.37', 'GBP') },
    { id: 'acc-eur', name: 'Euro wallet', currency: 'EUR', balance: fromMajor('1302.55', 'EUR') },
    { id: 'acc-usd', name: 'Dollar wallet', currency: 'USD', balance: fromMajor('486.10', 'USD') },
    { id: 'acc-jpy', name: 'Yen travel', currency: 'JPY', balance: fromMajor('48250', 'JPY') },
    { id: 'acc-kwd', name: 'Dinar leftovers', currency: 'KWD', balance: fromMajor('37.125', 'KWD') },
  ];
  return { accounts, transactions, truth, end };
}

const FEED_ACCOUNTS: ReadonlyArray<readonly [string, CurrencyCode, number]> = [
  ['acc-gbp', 'GBP', 0.7],
  ['acc-eur', 'EUR', 0.15],
  ['acc-usd', 'USD', 0.07],
  ['acc-jpy', 'JPY', 0.05],
  ['acc-kwd', 'KWD', 0.03],
];

/**
 * A large seeded feed (default 100,000 rows over two years) for the virtualised transaction list.
 * Rows are generated newest first.
 */
export function generateFeed(count: number, seed = DEFAULT_SEED, end = DATA_END): RawTransaction[] {
  const rng = createRng(seed ^ 0x5eed);
  const pick = weightedPicker(rng, MERCHANTS);
  const span = 730;
  const endDay = toDays(end);
  const out: RawTransaction[] = new Array(count);
  const payroll = merchantByName('Payroll');
  for (let i = 0; i < count; i++) {
    const day = endDay - Math.floor((i / count) * span);
    const r = rng.next();
    let acc = FEED_ACCOUNTS[0]!;
    let cum = 0;
    for (const a of FEED_ACCOUNTS) {
      cum += a[2];
      if (r < cum) {
        acc = a;
        break;
      }
    }
    const income = rng.chance(0.02);
    const m = income ? payroll : pick();
    const major = income ? 900 + rng.next() * 2400 : randomSpend(rng, m);
    const amt = amountIn(major, acc[1]);
    out[i] = {
      id: `f${String(i).padStart(6, '0')}`,
      date: fromDays(day),
      accountId: acc[0],
      amount: money(income ? amt.amount : -amt.amount, acc[1]),
      raw: messyMerchant(m.name, rng, FEED_NOISE),
      truth: { category: m.category, merchant: m.name },
    };
  }
  return out;
}

/** Run every descriptor through the categoriser. Results are cached per raw string. */
export function enrich(raw: readonly RawTransaction[], categoriser = new Categoriser()): Transaction[] {
  return raw.map((t) => {
    const c = categoriser.categorise(t.raw);
    const category: CategoryId = c.category;
    return {
      ...t,
      category,
      merchant: c.merchant ?? titleCase(c.normalised),
      merchantKey: c.merchantKey,
      method: c.method,
    };
  });
}

export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase()) || 'Unknown';
}

export { PERIOD_DAYS };

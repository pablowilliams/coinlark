import { type CurrencyCode, CURRENCY_CODES, exponentOf, isCurrencyCode } from './currency';
import { type Rational, divide, parseDecimal, reduce } from './decimal';
import { type Money, money } from './money';
import { divRound, type RoundingMode } from './rounding';

/** Rates quoted as "1 unit of `base` = rate units of currency", stored as exact decimal strings. */
export interface RateTable {
  readonly base: CurrencyCode;
  readonly date: string;
  readonly source: string;
  readonly rates: Readonly<Record<CurrencyCode, string>>;
  /** Currencies whose rate is synthetic rather than published by the source. */
  readonly synthetic?: readonly CurrencyCode[];
}

export interface ConvertOptions {
  /** Customer spread in basis points (100 bps = 1%) taken off the mid rate. */
  readonly spreadBps?: number;
  readonly mode?: RoundingMode;
}

export interface Conversion {
  readonly from: Money;
  readonly to: Money;
  /** What the same amount would have bought at the mid rate. */
  readonly atMid: Money;
  /** atMid − to, in the target currency. */
  readonly fee: Money;
  readonly midRate: Rational;
  readonly customerRate: Rational;
}

/** Mid cross rate: units of `to` per one unit of `from` (major units). */
export function crossRate(table: RateTable, from: CurrencyCode, to: CurrencyCode): Rational {
  if (from === to) return { num: 1n, den: 1n };
  const rf = parseDecimal(table.rates[from]);
  const rt = parseDecimal(table.rates[to]);
  return divide(rt, rf);
}

function convertMinor(
  amount: bigint,
  rate: Rational,
  from: CurrencyCode,
  to: CurrencyCode,
  mode: RoundingMode,
) {
  const ef = exponentOf(from);
  const et = exponentOf(to);
  // minor_to = minor_from × rate × 10^(et − ef)
  let num = amount * rate.num;
  let den = rate.den;
  if (et >= ef) num *= 10n ** BigInt(et - ef);
  else den *= 10n ** BigInt(ef - et);
  return divRound(num, den, mode);
}

export function convert(m: Money, to: CurrencyCode, table: RateTable, opts: ConvertOptions = {}): Conversion {
  const spreadBps = opts.spreadBps ?? 0;
  const mode = opts.mode ?? 'half-even';
  if (!Number.isInteger(spreadBps) || spreadBps < 0 || spreadBps >= 10_000) {
    throw new RangeError('spreadBps must be an integer in [0, 10000)');
  }
  const mid = crossRate(table, m.currency, to);
  const customer = reduce({ num: mid.num * BigInt(10_000 - spreadBps), den: mid.den * 10_000n });
  const amt = BigInt(m.amount);
  const atMid = money(convertMinor(amt, mid, m.currency, to, mode), to);
  const out = money(convertMinor(amt, customer, m.currency, to, mode), to);
  return {
    from: m,
    to: out,
    atMid,
    fee: money(atMid.amount - out.amount, to),
    midRate: mid,
    customerRate: customer,
  };
}

/** Convert many amounts into one base currency and total them exactly. */
export function totalIn(items: readonly Money[], base: CurrencyCode, table: RateTable): Money {
  let total = 0;
  for (const m of items) total += convert(m, base, table).to.amount;
  return money(total, base);
}

/** Build a RateTable from a Frankfurter/ECB-style payload ({ base, date, rates }). */
export function rateTableFromEcb(
  payload: { base: string; date: string; rates: Record<string, number | string> },
  source: string,
  syntheticRates: Partial<Record<CurrencyCode, string>> = {},
): RateTable {
  if (!isCurrencyCode(payload.base)) throw new Error(`Unsupported base ${payload.base}`);
  const rates = {} as Record<CurrencyCode, string>;
  const synthetic: CurrencyCode[] = [];
  for (const code of CURRENCY_CODES) {
    if (code === payload.base) rates[code] = '1';
    else if (payload.rates[code] !== undefined) rates[code] = String(payload.rates[code]);
    else if (syntheticRates[code] !== undefined) {
      rates[code] = syntheticRates[code];
      synthetic.push(code);
    } else throw new Error(`Missing rate for ${code}`);
  }
  return { base: payload.base, date: payload.date, source, rates, synthetic };
}

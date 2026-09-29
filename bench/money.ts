/**
 * Money-engine drift benchmark: integer minor units + banker's rounding vs naive floating point.
 * 1,000,000 seeded cases per experiment. Writes reports/parts/money.json.
 */
import { createRng } from '../src/lib/data/rng';
import { CURRENCY_CODES, type CurrencyCode, exponentOf } from '../src/lib/money/currency';
import { FIXTURE_RATES } from '../src/lib/money/rates';
import { allocate, money } from '../src/lib/money/money';
import { convert } from '../src/lib/money/fx';
import { naiveAllocate, naiveConvert } from '../src/lib/money/naive';

export const SEED = 20260929;

/** Independent exact reference: round n/d (bigints, d > 0) half-even or half-up. Deliberately not the engine's code. */
function refRound(n: bigint, d: bigint, halfEven: boolean): bigint {
  const neg = n < 0n;
  const a = neg ? -n : n;
  let q = a / d;
  const twice = (a % d) * 2n;
  if (twice > d || (twice === d && (!halfEven || q % 2n === 1n))) q += 1n;
  return neg ? -q : q;
}

function decimalParts(s: string): [bigint, bigint] {
  const [i, f = ''] = s.split('.');
  return [BigInt((i ?? '0') + f), 10n ** BigInt(f.length)];
}

export function runMoneyBench(n = 1_000_000, seed = SEED) {
  const rng = createRng(seed);
  const pickCur = (): CurrencyCode => CURRENCY_CODES[rng.int(0, CURRENCY_CODES.length - 1)]!;

  // 1. Splits
  let t0 = performance.now();
  const split = {
    cases: n,
    engineMismatches: 0,
    engineUnitsLost: 0,
    floatMismatches: 0,
    floatUnitsLost: 0,
    floatMaxLostInOneSplit: 0,
  };
  for (let i = 0; i < n; i++) {
    const cur = pickCur();
    const exp = exponentOf(cur);
    const amount = rng.int(1, 10_000_000);
    const parts = rng.int(2, 7);
    const weights = rng.chance(0.5)
      ? Array.from({ length: parts }, () => 1)
      : Array.from({ length: parts }, () => rng.int(1, 10));
    const shares = allocate(money(amount, cur), weights);
    const s = shares.reduce((a, m) => a + m.amount, 0);
    if (s !== amount) {
      split.engineMismatches++;
      split.engineUnitsLost += Math.abs(amount - s);
    }
    const f = naiveAllocate(amount / 10 ** exp, weights, exp);
    const fs = Math.round(f.reduce((a, b) => a + b, 0) * 10 ** exp);
    if (fs !== amount) {
      split.floatMismatches++;
      split.floatUnitsLost += Math.abs(amount - fs);
      split.floatMaxLostInOneSplit = Math.max(split.floatMaxLostInOneSplit, Math.abs(amount - fs));
    }
  }
  const splitMs = performance.now() - t0;

  // 2. Conversions vs an exact rational reference
  t0 = performance.now();
  const conv = {
    cases: n,
    engineMismatches: 0,
    floatMismatchesVsHalfEven: 0,
    floatMismatchesVsHalfUp: 0,
    floatMaxErrorUnits: 0,
  };
  for (let i = 0; i < n; i++) {
    const from = pickCur();
    let to = pickCur();
    while (to === from) to = pickCur();
    const amount = rng.int(1, 100_000_000);
    const [rfN, rfD] = decimalParts(FIXTURE_RATES.rates[from]);
    const [rtN, rtD] = decimalParts(FIXTURE_RATES.rates[to]);
    // minor_to = amount × (rt / rf) × 10^(et − ef)
    const ef = exponentOf(from);
    const et = exponentOf(to);
    let num = BigInt(amount) * rtN * rfD;
    let den = rtD * rfN;
    if (et >= ef) num *= 10n ** BigInt(et - ef);
    else den *= 10n ** BigInt(ef - et);
    const refEven = Number(refRound(num, den, true));
    const refUp = Number(refRound(num, den, false));
    const engine = convert(money(amount, from), to, FIXTURE_RATES).to.amount;
    if (engine !== refEven) conv.engineMismatches++;
    const rate = Number(FIXTURE_RATES.rates[to]) / Number(FIXTURE_RATES.rates[from]);
    const fl = Math.round(naiveConvert(amount / 10 ** ef, rate, et) * 10 ** et);
    if (fl !== refEven) conv.floatMismatchesVsHalfEven++;
    if (fl !== refUp) conv.floatMismatchesVsHalfUp++;
    conv.floatMaxErrorUnits = Math.max(conv.floatMaxErrorUnits, Math.abs(fl - refUp));
  }
  const convMs = performance.now() - t0;

  // 3. Round trips A → B → A at the mid rate: rounding bias of banker's vs half-up floats
  t0 = performance.now();
  const trip = {
    cases: n,
    engineSignedErrorSum: 0,
    engineMaxAbsError: 0,
    floatSignedErrorSum: 0,
    floatMaxAbsError: 0,
  };
  for (let i = 0; i < n; i++) {
    const a = pickCur();
    let b = pickCur();
    while (b === a) b = pickCur();
    const amount = rng.int(100, 10_000_000);
    const there = convert(money(amount, a), b, FIXTURE_RATES).to;
    const back = convert(there, a, FIXTURE_RATES).to.amount;
    trip.engineSignedErrorSum += back - amount;
    trip.engineMaxAbsError = Math.max(trip.engineMaxAbsError, Math.abs(back - amount));
    const ea = exponentOf(a);
    const eb = exponentOf(b);
    const r = Number(FIXTURE_RATES.rates[b]) / Number(FIXTURE_RATES.rates[a]);
    const fThere = naiveConvert(amount / 10 ** ea, r, eb);
    const fBack = Math.round(naiveConvert(fThere, 1 / r, ea) * 10 ** ea);
    trip.floatSignedErrorSum += fBack - amount;
    trip.floatMaxAbsError = Math.max(trip.floatMaxAbsError, Math.abs(fBack - amount));
  }
  const tripMs = performance.now() - t0;

  // 4. Running balance: 1,000,000 postings summed as integers vs as float major units
  t0 = performance.now();
  let intBal = 0;
  let floatBal = 0;
  let displayMismatches = 0;
  for (let i = 0; i < n; i++) {
    const amt = rng.int(-50_000, 50_000);
    intBal += amt;
    floatBal += amt / 100;
    const shown = floatBal.toFixed(2);
    // exact decimal from the integer balance (integer division, no float): pounds and pence
    const pounds = Math.trunc(Math.abs(intBal) / 100);
    const pence = Math.abs(intBal) % 100;
    const exactStr = `${intBal < 0 ? '-' : ''}${pounds}.${String(pence).padStart(2, '0')}`;
    if (shown !== exactStr && !(shown === '-0.00' && exactStr === '0.00')) displayMismatches++;
  }
  const ledger = {
    postings: n,
    engineDriftUnits: 0,
    floatDriftUnits: Math.abs(Math.round(floatBal * 100) - intBal),
    floatRawError: Math.abs(floatBal * 100 - intBal),
    floatDisplayMismatches: displayMismatches,
  };
  const ledgerMs = performance.now() - t0;

  return {
    seed,
    split: { ...split, ms: Math.round(splitMs) },
    conversion: { ...conv, ms: Math.round(convMs) },
    roundTrip: {
      ...trip,
      engineMeanSignedError: trip.engineSignedErrorSum / n,
      floatMeanSignedError: trip.floatSignedErrorSum / n,
      ms: Math.round(tripMs),
    },
    ledger: { ...ledger, ms: Math.round(ledgerMs) },
    currencies: CURRENCY_CODES,
    rates: { date: FIXTURE_RATES.date, source: FIXTURE_RATES.source, synthetic: FIXTURE_RATES.synthetic },
  };
}

import { daysBetween } from '../data/dates';
import type { Cadence } from '../data/merchants';
import type { TruthSeries } from '../data/types';
import { normalise } from '../categorise/normalise';

export interface Score {
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export function score(
  detected: ReadonlyArray<{ merchantKey: string; cadence: Cadence }>,
  truth: readonly TruthSeries[],
): Score {
  const want = new Set(truth.map((t) => `${normalise(t.merchant)}|${t.cadence}`));
  const got = new Set(detected.map((d) => `${d.merchantKey}|${d.cadence}`));
  let tp = 0;
  for (const g of got) if (want.has(g)) tp++;
  const fp = got.size - tp;
  const fn = want.size - tp;
  const precision = got.size ? tp / got.size : 1;
  const recall = want.size ? tp / want.size : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1 };
}

export function sumScores(scores: readonly Score[]): Score {
  const tp = scores.reduce((a, s) => a + s.tp, 0);
  const fp = scores.reduce((a, s) => a + s.fp, 0);
  const fn = scores.reduce((a, s) => a + s.fn, 0);
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1 };
}

/** For active truth series that were detected: is the predicted next charge within ±tolerance days? */
export function nextDueAccuracy(
  detected: ReadonlyArray<{ merchantKey: string; cadence: Cadence; nextDue: string }>,
  truth: readonly TruthSeries[],
  tolerance = 3,
): { hits: number; total: number } {
  let hits = 0;
  let total = 0;
  for (const t of truth) {
    if (!t.active || !t.nextDue) continue;
    const d = detected.find((x) => x.merchantKey === normalise(t.merchant) && x.cadence === t.cadence);
    if (!d) continue;
    total++;
    if (Math.abs(daysBetween(t.nextDue, d.nextDue)) <= tolerance) hits++;
  }
  return { hits, total };
}

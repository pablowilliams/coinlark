/**
 * Recurring-payment detection scored against planted ground truth, on held-out synthetic users.
 * Tuned on seeds 1000–1099 (dev); reported on seeds 50000–50299 (test).
 */
import { enrich, generateHistory } from '../src/lib/data/generate';
import { detectRecurring, naiveRecurring } from '../src/lib/recurring/detect';
import { nextDueAccuracy, score, sumScores, type Score } from '../src/lib/recurring/evaluate';

function evaluate(firstSeed: number, users: number) {
  const ours: Score[] = [];
  const naive: Score[] = [];
  let hits = 0;
  let total = 0;
  let txns = 0;
  let series = 0;
  let ms = 0;
  for (let u = 0; u < users; u++) {
    const h = generateHistory({ seed: firstSeed + u });
    const tx = enrich(h.transactions);
    txns += tx.length;
    series += h.truth.length;
    const t0 = performance.now();
    const det = detectRecurring(tx, h.end);
    ms += performance.now() - t0;
    ours.push(score(det, h.truth));
    naive.push(score(naiveRecurring(tx), h.truth));
    const nd = nextDueAccuracy(det, h.truth);
    hits += nd.hits;
    total += nd.total;
  }
  return {
    firstSeed,
    users,
    transactions: txns,
    truthSeries: series,
    detector: sumScores(ours),
    baseline: sumScores(naive),
    nextDueWithin3Days: { hits, total, rate: total ? hits / total : 0 },
    msPerUser: ms / users,
  };
}

export function runRecurringBench() {
  return { dev: evaluate(1000, 100), test: evaluate(50000, 300) };
}

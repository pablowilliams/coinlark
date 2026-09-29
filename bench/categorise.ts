/**
 * Merchant categorisation accuracy on a held-out labelled synthetic set.
 * Rules and thresholds were tuned on the DEV seed only; the TEST seed is reported.
 */
import { Categoriser, naiveCategorise, type Method } from '../src/lib/categorise/categorise';
import { labelledSet } from '../src/lib/data/labelled';

export const DEV_SEED = 1;
export const TEST_SEED = 20260929;

function evaluate(seed: number, n: number) {
  const data = labelledSet(seed, n);
  const cat = new Categoriser();
  const tally = {
    n: data.length,
    known: 0,
    unseen: 0,
    correct: 0,
    knownCorrect: 0,
    unseenCorrect: 0,
    naiveCorrect: 0,
    naiveKnownCorrect: 0,
    naiveUnseenCorrect: 0,
  };
  const byMethod: Record<Method, { n: number; correct: number }> = {
    exact: { n: 0, correct: 0 },
    fuzzy: { n: 0, correct: 0 },
    rule: { n: 0, correct: 0 },
    none: { n: 0, correct: 0 },
  };
  const t0 = performance.now();
  for (const e of data) {
    const r = cat.categorise(e.raw);
    const ok = r.category === e.category;
    const nk = naiveCategorise(e.raw) === e.category;
    byMethod[r.method].n++;
    if (ok) byMethod[r.method].correct++;
    if (e.known) tally.known++;
    else tally.unseen++;
    if (ok) {
      tally.correct++;
      if (e.known) tally.knownCorrect++;
      else tally.unseenCorrect++;
    }
    if (nk) {
      tally.naiveCorrect++;
      if (e.known) tally.naiveKnownCorrect++;
      else tally.naiveUnseenCorrect++;
    }
  }
  const ms = performance.now() - t0;
  return {
    seed,
    ...tally,
    accuracy: tally.correct / tally.n,
    knownAccuracy: tally.knownCorrect / tally.known,
    unseenAccuracy: tally.unseenCorrect / tally.unseen,
    naiveAccuracy: tally.naiveCorrect / tally.n,
    naiveKnownAccuracy: tally.naiveKnownCorrect / tally.known,
    naiveUnseenAccuracy: tally.naiveUnseenCorrect / tally.unseen,
    errorReduction: 1 - (tally.n - tally.correct) / (tally.n - tally.naiveCorrect),
    byMethod,
    msPerDescriptor: ms / tally.n,
    knowledgeBaseEntries: cat.knowledgeBaseSize,
  };
}

export function runCategoriseBench() {
  return {
    note: 'HARD noise: 35% typo, 30% truncation, processor prefixes, store numbers, locations. 20% of descriptors are unseen independent businesses.',
    dev: evaluate(DEV_SEED, 4000),
    test: evaluate(TEST_SEED, 10000),
  };
}

import { DEFAULT_SEED, enrich, generateFeed, generateHistory, type History } from '../lib/data/generate';
import type { Transaction } from '../lib/data/types';
import { detectRecurring, type RecurringSeries } from '../lib/recurring/detect';

export interface PersonalData extends History {
  readonly enriched: Transaction[];
  readonly recurring: RecurringSeries[];
}

let personal: PersonalData | null = null;

/** The demo user's seeded two-year history, enriched and analysed once per page load. */
export function getPersonal(): PersonalData {
  if (!personal) {
    const h = generateHistory({ seed: DEFAULT_SEED, subscriptions: 9 });
    const enriched = enrich(h.transactions);
    personal = { ...h, enriched, recurring: detectRecurring(enriched, h.end) };
  }
  return personal;
}

const feeds = new Map<number, Transaction[]>();

export const FEED_SIZES = [1_000, 10_000, 100_000] as const;
export const DEFAULT_FEED_SIZE = 100_000;

export function getFeed(n: number): Transaction[] {
  let f = feeds.get(n);
  if (!f) {
    f = enrich(generateFeed(n));
    feeds.set(n, f);
  }
  return f;
}

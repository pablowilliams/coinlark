import ecb from '../fixtures/frankfurter-eur-2026-09-28.json';
import { type RateTable, rateTableFromEcb } from './fx';

/**
 * KWD is not in the ECB reference set that Frankfurter publishes, so its rate here is SYNTHETIC
 * (chosen to be of a realistic magnitude) and is flagged as such in the UI.
 */
export const SYNTHETIC_RATES = { KWD: '0.3490' } as const;

/** Offline fixture: ECB reference rates for 2026-09-28 fetched once from api.frankfurter.app. */
export const FIXTURE_RATES: RateTable = rateTableFromEcb(
  ecb,
  'ECB reference rates via Frankfurter (fixture)',
  SYNTHETIC_RATES,
);

export const LIVE_RATES_URL = 'https://api.frankfurter.app/latest?from=EUR';

/** Optional live refresh. Resolves to the fixture on any failure so the app always works offline. */
export async function fetchLiveRates(
  fetchImpl: typeof fetch = fetch,
): Promise<{ table: RateTable; live: boolean }> {
  try {
    const res = await fetchImpl(LIVE_RATES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
    return {
      table: rateTableFromEcb(payload, 'ECB reference rates via Frankfurter (live)', SYNTHETIC_RATES),
      live: true,
    };
  } catch {
    return { table: FIXTURE_RATES, live: false };
  }
}

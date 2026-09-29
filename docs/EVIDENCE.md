# Evidence pack

Every requirement in `.kiro/specs` is linked to the tests that verify it and the number it produced.
Generated 2026-09-29T13:43:08Z by `npm run evidence`; the mapping lives in [`.kiro/evidence.yml`](../.kiro/evidence.yml) and every number comes from [`reports/results.json`](../reports/results.json).
All data is synthetic and seeded. Timings are lab measurements on one machine (headless Chromium, no throttling).

## At a glance

| Specs | Requirements | EARS criteria | Tasks done | Hooks | Unit tests | Coverage (src/lib) | Browser checks |
|---|---|---|---|---|---|---|---|
| 4 | 15 | 52 | 35/35 | 4 | 142/142 | 99.87% lines | 51/51 (+1 desktop-only skipped on mobile) |

## Evidence table

| ID | Requirement | Result | Baseline / comparison | Tests | Status |
|---|---|---|---|---|---|
| ME-1 | 3.1–3.3 Allocation never loses a minor unit | **0 units lost (0 bad splits)** | floats: 767,538 units lost in 571,547 of 1,000,000 splits | 53 passed | pass |
| ME-2 | 2.1–2.3 Exact FX conversion with banker's rounding | **0 of 1,000,000** | floats: 183 wrong even by their own half-up rule (346 vs half-even) | 13 passed | pass |
| ME-3 | 4.2 Round trips and running balances (reported even where floats tie) | **engine max 2 units (mean signed -0.00012) · ledger drift 0** | floats max 2 units (mean signed 0.00016) · ledger drift 0 after rounding (no measurable advantage here) | 66 passed | pass |
| TI-1 | 1.1–1.5 Virtualised 100k-row feed | **344 DOM nodes · 39.1 ms render · 31.9 ms median filter** | non-virtualised at 10k: 110,146 nodes · 1065.5 ms · 283.7 ms; at 100k: 12800.4 ms render, 16348.7 ms filter | 43 passed | pass |
| TI-2 | 2.1–2.4 Merchant categorisation on a held-out set | **97.9% (known 99.7%, unseen 90.4%)** | naive keywords: 71.9% (known 72.7%, unseen 68.6%); 93% fewer errors | 20 passed | pass |
| TI-3 | 3.1–3.5 Recurring-payment detection | **P 99.3% · R 99.4% · next due 96.1%** | same-amount ≥3×: P 78.2% · R 89.6% (675 false positives vs 18) | 10 passed | pass |
| SU-1 | 1.2, 2.1–2.2, 4.1 Minimum transfers that always balance | **6.54 per group (73% fewer); 1,000/1,000 groups settle to exactly 0** | pairwise: 24.00; greedy: 6.54 (exact beat greedy in 2 groups; 16 with whole €10 bills) | 46 passed | pass |
| IX-1 | 3.1 Zero axe violations on every page | **0 violations in 24 scans** | 994 rule checks passed | 24 passed | pass |
| IX-2 | 1.1–1.4, 2.1–2.3, 3.2–3.4 Dashboard, localisation, keyboard, responsive | **51 passed, 0 failed (1 desktop-only check skipped on mobile)** | 0 console errors, 0 px horizontal overflow at 375 px | 44 passed | pass |
| IX-3 | 4.1–4.2 Bundle budget and lab web vitals | **54.0 KB main (73.1 KB initial) · LCP 44.0 ms · CLS 0.000** | within budget: true | 0 passed | measured |
| ENG-1 | Definition of done: tests and coverage gate | **99.9% lines · 96.3% branches** | 142/142 tests passing | 142 passed | pass |

## Detail (CV-ready statements)

### ME-1 · Minor units lost over 1M splits
- **Tested:** 1,000,000 seeded random splits (2–7 parts, equal or weighted 1–10) across GBP, EUR, USD, CHF, JPY and KWD, checking that the parts add back to the total
- **Context:** Integer minor units + largest-remainder allocation vs splitting major-unit floats and rounding each share
- **Result:** 0 units lost (0 bad splits). **Compared with:** floats: 767,538 units lost in 571,547 of 1,000,000 splits.
- **Verified by:** `src/lib/money/money.test.ts` (53 passed).
- **Libraries:** TypeScript bigint, fast-check, Vitest.

### ME-2 · Conversions differing from the exact result
- **Tested:** 1,000,000 seeded conversions between the six currencies at ECB fixture rates, compared with an independent exact BigInt reference
- **Context:** Engine (rational rates, half-even) vs Math.round(amount × rate) on floats; float errors counted against both half-even and its own half-up policy
- **Result:** 0 of 1,000,000. **Compared with:** floats: 183 wrong even by their own half-up rule (346 vs half-even).
- **Verified by:** `src/lib/money/fx.test.ts` (13 passed).
- **Libraries:** TypeScript bigint, fast-check.

### ME-3 · Round-trip max error · ledger drift
- **Tested:** 1,000,000 A→B→A round trips at mid rate, and a 1,000,000-posting running balance
- **Context:** Both methods must round to the intermediate currency's minor unit, so round trips lose up to a couple of units either way
- **Result:** engine max 2 units (mean signed -0.00012) · ledger drift 0. **Compared with:** floats max 2 units (mean signed 0.00016) · ledger drift 0 after rounding (no measurable advantage here).
- **Verified by:** `src/lib/money/money.test.ts` (53 passed), `src/lib/money/fx.test.ts` (13 passed).
- **Libraries:** TypeScript bigint.

### TI-1 · DOM nodes · render · filter latency at 100k
- **Tested:** Loaded the seeded 100,000-row feed in the production build and measured DOM size, render time and search latency; the same list without virtualisation was measured at 1k, 10k and 100k
- **Context:** Headless Chromium 1440×900, no throttling, median of 3 cold loads; filter latency = input event → result painted, 20 samples
- **Result:** 344 DOM nodes · 39.1 ms render · 31.9 ms median filter. **Compared with:** non-virtualised at 10k: 110,146 nodes · 1065.5 ms · 283.7 ms; at 100k: 12800.4 ms render, 16348.7 ms filter.
- **Verified by:** `src/lib/feed/filter.test.ts` (4 passed), `src/test/pages.test.tsx` (12 passed), `e2e/app.spec.ts` (27 passed).
- **Libraries:** React 18, Playwright, Performance API.

### TI-2 · Category accuracy (test seed)
- **Tested:** 10,000 held-out messy descriptors (35% typos, 30% truncated, processor prefixes, store numbers, cities); 20% are unseen independent businesses
- **Context:** Rules and thresholds tuned on a separate dev seed; knowledge base of {categorise.test.knowledgeBaseEntries|int} names and aliases
- **Result:** 97.9% (known 99.7%, unseen 90.4%). **Compared with:** naive keywords: 71.9% (known 72.7%, unseen 68.6%); 93% fewer errors.
- **Verified by:** `src/lib/categorise/categorise.test.ts` (20 passed).
- **Libraries:** TypeScript, Jaro–Winkler (hand-written), Vitest.

### TI-3 · Precision · recall · next-due within ±3 days
- **Tested:** 300 held-out synthetic users × 24 months ({recurring.test.transactions|int} transactions) with {recurring.test.truthSeries|int} planted weekly/monthly/yearly series incl. price rises, failed collections and cancellations
- **Context:** Distractors: fixed-price coffees several times a week, weekly grocery shops, random Amazon orders; tuned on seeds 1000–1099, reported on 50000–50299
- **Result:** P 99.3% · R 99.4% · next due 96.1%. **Compared with:** same-amount ≥3×: P 78.2% · R 89.6% (675 false positives vs 18).
- **Verified by:** `src/lib/recurring/recurring.test.ts` (10 passed).
- **Libraries:** TypeScript.

### SU-1 · Transfers needed (mean per group)
- **Tested:** 1,000 seeded groups of 3–12 people with 4–30 expenses each (arbitrary amounts, 20% weighted splits)
- **Context:** Exact subset DP vs greedy vs everyone paying each payer back; every plan applied back to the balances
- **Result:** 6.54 per group (73% fewer); 1,000/1,000 groups settle to exactly 0. **Compared with:** pairwise: 24.00; greedy: 6.54 (exact beat greedy in 2 groups; 16 with whole €10 bills).
- **Verified by:** `src/lib/settle/settle.test.ts` (7 passed), `src/test/pages.test.tsx` (12 passed), `e2e/app.spec.ts` (27 passed).
- **Libraries:** TypeScript, fast-check.

### IX-1 · axe violations
- **Tested:** axe-core on 6 pages × light/dark × desktop/mobile
- **Context:** Tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice
- **Result:** 0 violations in 24 scans. **Compared with:** 994 rule checks passed.
- **Verified by:** `e2e/a11y.spec.ts` (24 passed).
- **Libraries:** axe-core, Playwright.

### IX-2 · Browser checks
- **Tested:** Every page on desktop 1440×900 and mobile 375×812: console errors, horizontal overflow, NaN/undefined text, locale switching, keyboard flow
- **Context:** Production build in Chromium
- **Result:** 51 passed, 0 failed (1 desktop-only check skipped on mobile). **Compared with:** 0 console errors, 0 px horizontal overflow at 375 px.
- **Verified by:** `e2e/app.spec.ts` (27 passed), `src/lib/i18n/i18n.test.ts` (12 passed), `src/lib/insights/insights.test.ts` (5 passed).
- **Libraries:** Playwright, Intl API, React Testing Library.

### IX-3 · Main chunk · LCP · CLS
- **Tested:** Gzipped the production build; measured 5 cold loads of the overview page
- **Context:** Budget: main ≤ {bundle.budget.mainGzipKb|int} KB gzip, initial ≤ {bundle.budget.initialGzipKb|int} KB; lab metrics, no throttling
- **Result:** 54.0 KB main (73.1 KB initial) · LCP 44.0 ms · CLS 0.000. **Compared with:** within budget: true.
- **Verified by:** measurement script only.
- **Libraries:** Vite, zlib, Playwright.

### ENG-1 · Coverage (lines, src/lib)
- **Tested:** Vitest unit, property and component tests with the coverage gate on src/lib
- **Context:** tsc strict + ESLint clean in CI
- **Result:** 99.9% lines · 96.3% branches. **Compared with:** 142/142 tests passing.
- **Verified by:** `src/` (142 passed).
- **Libraries:** Vitest, @vitest/coverage-v8, React Testing Library, fast-check.

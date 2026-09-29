# Architecture

Coinlark is a static single-page app. There is no backend: every dataset is generated in the browser from a fixed
seed, and FX rates come from a bundled fixture (with an optional live refresh). That keeps the demo reproducible,
offline-capable and free to host.

## Layers

```
┌──────────────────────────── UI (React 18, TypeScript strict) ────────────────────────────┐
│ pages/ Overview · Transactions · Subscriptions · Split · Convert · Categorise (lazy)     │
│ components/ Layout (nav, settings, skip link) · VirtualTable · SVG charts · Icon          │
│ state/ SettingsProvider (locale, base currency, theme, rates) · hash router · data cache  │
└───────────────────────────────────────────┬──────────────────────────────────────────────┘
                                            │ pure function calls only
┌──────────────────────────── Domain (src/lib, no React, no DOM) ──────────────────────────┐
│ money/       Money · divRound · Rational · convert · allocate · naive float baseline      │
│ categorise/  normalise → knowledge base → Jaro–Winkler → keyword rules                    │
│ recurring/   cluster by amount → cadence chains → filters → next due                      │
│ settle/      balances → pairwise | greedy | exact subset-DP                               │
│ insights/    spend by month/category · KPIs · budgets · balances in base                  │
│ feed/        search index · filter (Uint32Array of matches) · visible window               │
│ i18n/        Intl formatting from exact decimal strings · 4 message catalogues             │
│ data/        seeded RNG · UTC dates · merchants · noise model · generators                │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data flow

1. `generateHistory(seed)` builds the demo user's 24-month history (planted subscriptions = ground truth);
   `generateFeed(100_000)` builds the stress feed. Both emit messy descriptors such as `SQ *PRET A MANGER 0342 LONDON GB`.
2. `enrich()` runs every descriptor through the `Categoriser` (cached per raw string) to get merchant, category and a
   stable `merchantKey`.
3. `detectRecurring()` groups by `merchantKey`, so it benefits from categorisation (noisy descriptors of the same
   merchant land in one group).
4. `insights.ts` converts every amount into the chosen base currency with `convert()`; totals stay integers.
5. Formatting happens at the edge (`formatMoney`) and is locale-aware.

## Key decisions

| Decision                                             | Alternative                            | Why                                                                          |
| ---------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `number` minor units at rest, `bigint` in arithmetic | `bigint` everywhere; a decimal library | safe-integer range covers £90 trillion; React/JSON friendly; no dependency   |
| Banker's rounding by default                         | half-up                                | no systematic bias across many conversions                                   |
| Hand-written virtual list                            | react-window / TanStack Virtual        | ~100 lines, full control of ARIA table semantics, one less dependency        |
| Hand-written SVG charts                              | a chart library                        | main chunk stays at ~54 KB gzip; charts get `<title>` and table alternatives |
| Hash router                                          | React Router                           | six routes, works from any static host and `file://`-like previews           |
| Exact settle-up via subset DP (k ≤ 16)               | greedy only                            | provably minimal; greedy kept as fallback and comparison                     |
| Seeded synthetic data                                | real bank data                         | reproducible, shareable, and allows scoring against ground truth             |

## Quality gates

- `tsc` strict with `noUncheckedIndexedAccess`; ESLint strict + jsx-a11y strict + react-hooks.
- Vitest coverage ≥ 90% on `src/lib` (currently ~99.9% lines).
- Playwright on desktop (1440×900) and mobile (375×812): every page, navigation, keyboard, locales, overflow, console errors.
- axe-core: 0 violations on 6 pages × 2 themes × 2 viewports.
- Bundle budget: main ≤ 80 KB gzip, initial ≤ 110 KB gzip (`npm run bundle`).

## Evidence pipeline

`npm run evidence` → Vitest (junit + coverage) → `bench/run-all.ts` → build + bundle → Playwright (e2e + axe) →
Playwright perf → merge `reports/parts/*.json` into `reports/results.json` → evaluate `.kiro/evidence.yml` →
`reports/evidence.json` + `docs/EVIDENCE.md`.

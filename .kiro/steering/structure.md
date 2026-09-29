---
inclusion: always
---

# Structure

```
src/
  lib/                 pure, 100% unit-testable logic (coverage gate ≥ 90%)
    money/             currency table, Money, rounding, decimal, FX, rates fixture, naive float baseline
    categorise/        normalise, Jaro–Winkler, keyword rules, Categoriser + naive baseline
    recurring/         detectRecurring, naive baseline, scoring
    settle/            balances, pairwise, greedy, exact minimum transfers
    insights/          spend by month/category, KPIs, budgets, balances in base currency
    feed/              search index, filter, virtual window maths
    i18n/              Intl formatting, message catalogues (en-GB, it-IT, es-ES, de-DE)
    data/              seeded RNG, dates, merchants, noise, generators, labelled sets
    fixtures/          offline ECB rates (Frankfurter, 2026-09-28)
  components/          Layout, Icon, charts, VirtualTable
  pages/               Overview, Transactions, Subscriptions, Split, Convert, Categorise (lazy-loaded)
  state/               settings context, router, data singletons, safe storage
  test/                component tests
bench/                 benchmark scripts → reports/parts/*.json
e2e/                   Playwright specs (app, a11y, perf)
scripts/               evidence, bundle-size, screenshots, results merge, contrast
reports/               results.json (canonical numbers), evidence.json, junit, coverage
docs/                  ARCHITECTURE.md, EVIDENCE.md, screenshots/
.kiro/                 steering, specs, hooks, evidence.yml
```

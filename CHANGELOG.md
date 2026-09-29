# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-29

### Added

- Money engine: integer minor units with ISO 4217 exponents (JPY 0, GBP/EUR/USD/CHF 2, KWD 3), exact decimal
  parsing, banker's rounding, FX conversion with spread and fee, largest-remainder allocation.
- Offline ECB rate fixture (2026-09-28, via Frankfurter) with an optional live refresh and a flagged synthetic KWD rate.
- Virtualised transaction feed (100,000 seeded rows) with search and category/account/direction filters.
- Merchant categoriser: normalisation, knowledge base, Jaro–Winkler fuzzy matching and multilingual keyword rules.
- Recurring-payment detection with cadence, next due date, price-change flag and active status.
- Split the bill with exact minimum transfers (subset DP) and a pairwise comparison.
- Insights dashboard: KPI tiles vs previous month, spend by month and category, budgets, balances in a base currency.
- Localisation: en-GB, it-IT, es-ES, de-DE; light, dark and system themes; responsive down to 375 px.
- Benchmarks, Playwright e2e (desktop + mobile), axe accessibility checks, bundle budget, lab web vitals.
- Kiro steering docs, four specs, agent hooks, `evidence.yml` and `npm run evidence`.
- GitHub Actions CI (lint → typecheck → unit → e2e → build).

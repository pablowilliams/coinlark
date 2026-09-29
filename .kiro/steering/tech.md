---
inclusion: always
---

# Tech stack & conventions

| Layer   | Choice                                                                     | Why                                                              |
| ------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| UI      | React 18 + TypeScript (strict, `noUncheckedIndexedAccess`)                 | typed components, no runtime surprises                           |
| Build   | Vite                                                                       | fast dev server, code-split production build                     |
| Charts  | Hand-written SVG                                                           | keeps the bundle small; every chart has a data-table alternative |
| Money   | `src/lib/money` with `bigint` intermediates                                | exact arithmetic; no dependency                                  |
| Tests   | Vitest + React Testing Library + fast-check                                | unit, component and property-based tests                         |
| Browser | Playwright 1.63 (Chromium) + @axe-core/playwright                          | e2e on desktop and mobile, accessibility, performance            |
| Quality | ESLint (typescript-eslint strict, react-hooks, jsx-a11y strict) + Prettier | clean lint is a CI gate                                          |
| CI      | GitHub Actions                                                             | lint → typecheck → unit → e2e → build                            |

## Conventions

- `src/lib/**` is pure TypeScript: no React, no DOM, no I/O except `rates.ts#fetchLiveRates` (injectable fetch).
- Amounts: `Money { amount: number /* safe integer of minor units */, currency }`. Use `fromMajor`, `allocate`, `convert`, `formatMoney`.
- Rounding: banker's (half-even) unless a caller asks otherwise.
- Dates are ISO `YYYY-MM-DD` strings handled in UTC.
- Randomness only through `createRng(seed)`; default seed `20260929`, synthetic "today" `2026-09-28`.
- Colours only via CSS tokens in `src/styles.css`; contrast pairs checked with `scripts/contrast.ts`.
- User-facing strings only through `t(key)`; all four catalogues must have identical keys and placeholders.

## Commands

```bash
npm run dev          # http://localhost:5190
npm test             # unit + component
npm run coverage     # with the 90% gate on src/lib
npm run e2e          # Playwright desktop + mobile (+ axe)
npm run bench        # money / categorise / recurring / settle benchmarks
npm run bench:feed   # virtualisation + web-vitals measurements
npm run evidence     # everything → reports/results.json, reports/evidence.json, docs/EVIDENCE.md
```

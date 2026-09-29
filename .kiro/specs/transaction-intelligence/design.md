# Design: Transaction intelligence

## Feed

- `generateFeed(n, seed)` → `enrich()` (categoriser with a per-string cache) → `buildIndex()` pre-lower-cases one haystack string per row.
- `applyFilter()` returns a `Uint32Array` of matching indexes (no row copies). Search terms are ANDed.
- `VirtualTable`: fixed row height (60 px desktop, 64 px mobile), `translateY` positioning, overscan 8, `contain: strict` scroller,
  ARIA `table/rowgroup/row/cell` semantics, focusable scroll region. `useDeferredValue` keeps typing responsive.
- Baseline: the same component with `virtual=false` renders every row (`#/transactions?n=…&virtual=0`).
- `window.__feedPerf` records generation time and data-ready → rows-painted time for `e2e/perf.spec.ts`.

## Categoriser

```
raw ─► normalise ─► exact KB match on leading token windows ─► fuzzy JW (≥0.90; ≥0.95 if an exact rule also fired;
                                                               prefix of ≥6 chars = truncation → 0.97) ─► rules ─► general
```

The knowledge base is the merchant catalogue names plus curated aliases (167 keys). Evaluation data comes from
`labelledSet(seed)`: 80% known merchants under HARD noise (35% typos, 30% truncation), 20% unseen independents.

## Recurring detection

`detectRecurring` → group by `merchantKey|currency` → `clusterByAmount` → per cadence `findChain` walks back from the
newest charge one period (or 2–3 periods for missed collections) at a time → filters (min count, coverage, fill, median
step ≤ 2%; yearly needs the merchant to be mostly this charge) → best-scoring cadence. Next due = last + period, monthly
anchored to the median day of month.

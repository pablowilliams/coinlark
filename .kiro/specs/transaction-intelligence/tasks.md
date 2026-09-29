# Implementation plan: Transaction intelligence

- [x] 1. Seeded feed generator and noise model. _Requirements: 1.1, 2.4_
- [x] 2. Search index, filter and visible-window maths. _Requirements: 1.2, 1.3_
- [x] 3. VirtualTable with ARIA table semantics and non-virtual baseline mode. _Requirements: 1.2, 1.5_
- [x] 4. Transactions page: filters, empty state, dataset size. _Requirements: 1.3, 1.4_
- [x] 5. Playwright perf spec (DOM nodes, render, filter latency) → `reports/parts/feed.json`. _Requirements: 1.5_
- [x] 6. Normaliser, Jaro–Winkler, keyword rules (typo-tolerant). _Requirements: 2.1, 2.2, 2.3_
- [x] 7. Categoriser + naive baseline; dev/test labelled sets; benchmark. _Requirements: 2.4_
- [x] 8. Recurring detector (cluster, chain, filters, next due). _Requirements: 3.1, 3.2, 3.3, 3.4_
- [x] 9. Ground-truth planting, naive baseline, scoring, held-out benchmark. _Requirements: 3.5_
- [x] 10. Subscriptions page and "Coming up" card. _Requirements: 3.3_

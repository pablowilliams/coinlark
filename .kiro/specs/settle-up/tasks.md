# Implementation plan: Split the bill

- [x] 1. `balances` with exact allocation and validation. _Requirements: 1.1, 1.2, 1.3_
- [x] 2. Pairwise and greedy plans. _Requirements: 2.3_
- [x] 3. Exact subset-DP plan with greedy fallback. _Requirements: 2.1, 2.2_
- [x] 4. Property tests with fast-check. _Requirements: 1.2, 2.2_
- [x] 5. Split page: people, expenses, validation, plan vs pairwise. _Requirements: 2.3, 3.1, 3.2_
- [x] 6. Benchmark across 2 × 1,000 seeded groups. _Requirements: 4.1_

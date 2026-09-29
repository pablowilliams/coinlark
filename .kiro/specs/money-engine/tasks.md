# Implementation plan: Money engine

- [x] 1. Currency table with exponents and type guard. _Requirements: 1.1, 1.2_
- [x] 2. `divRound` with five rounding modes. _Requirements: 1.5, 2.3_
- [x] 3. `Money` constructors, arithmetic, currency-mismatch errors. _Requirements: 1.1, 1.3, 1.4_
- [x] 4. Exact decimal parse/print (`fromMajor`, `toDecimalString`). _Requirements: 1.5_
- [x] 5. Rational rates, cross rates, `convert` with spread and fee. _Requirements: 2.1, 2.2, 2.3_
- [x] 6. ECB fixture + synthetic KWD flag + live refresh with fallback. _Requirements: 2.4, 2.5_
- [x] 7. `allocate` / `split` (largest remainder). _Requirements: 3.1, 3.2, 3.3_
- [x] 8. Property tests (fast-check) and example tests. _Requirements: 4.3_
- [x] 9. 1M-case benchmark vs floats → `reports/parts/money.json`. _Requirements: 4.1, 4.2_
- [x] 10. Convert page with split demo (engine vs float). _Requirements: 2.2, 3.2_

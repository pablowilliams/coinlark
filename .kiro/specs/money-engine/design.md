# Design: Money engine

```
fromMajor("12.345", GBP) ──► Money{1234, GBP} ──► convert(→EUR, table, {spreadBps}) ──► Conversion{to, atMid, fee}
                                  │                         │
                                  └─► allocate([1,1,1])     └─ minor_to = minor_from × rt/rf × 10^(eₜ−e_f), divRound(half-even)
```

- `Money` is `{ amount: number; currency }`; constructors assert `Number.isSafeInteger`.
- Intermediates use `bigint`, so `amount × rate numerator` can exceed 2^53 without error.
- Rates are decimal strings parsed to `Rational {num, den}`; cross rate = rate(to) / rate(from).
- Customer rate = mid × (10,000 − bps) / 10,000; `fee = atMid − to`.
- `divRound(n, d, mode)` supports half-even, half-up, floor, ceil, trunc; tested for sign symmetry and |error| ≤ ½.
- `allocate`: floor shares, then hand the leftover units to the largest remainders (earliest index wins ties).
- Formatting (`i18n/format.ts`) passes the exact decimal _string_ to `Intl.NumberFormat`, never a float.
- Baseline (`money/naive.ts`): major-unit floats with `Math.round(x × 10^e) / 10^e`.
- Benchmark (`bench/money.ts`) uses its own independent BigInt reference for correctness, not the engine's code.

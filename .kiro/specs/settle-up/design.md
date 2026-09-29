# Design: Split the bill

- `balances()` uses `allocate()` for each expense, so shares always sum to the bill.
- `pairwiseTransfers()` accumulates what each participant owes each payer, then nets each unordered pair.
- `greedyTransfers()` repeatedly matches the largest debtor with the largest creditor (≤ n − 1 transfers).
- `optimalTransfers()`: with k non-zero members, min transfers = k − max number of disjoint zero-sum subgroups.
  `dp[mask] = max_i dp[mask \ i] + [sum(mask) = 0]`, O(2^k · k). The partition is recovered by peeling members along
  the optimal path (zero-sum prefixes delimit subgroups); each subgroup is settled with greedy.
- Property test: for random groups, all three plans zero every balance and `optimal ≤ greedy ≤ n − 1`.

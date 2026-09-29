---
inclusion: always
---

# Product: Coinlark

Coinlark is a multi-currency money app demo, built as a portfolio piece for fintech frontend roles. It is not a
bank, holds no money and has no affiliation with any real bank or brand. **All data is synthetic and seeded.**

## Users and problems

| User problem                                                                       | Feature                                                                                                    | How we prove it works                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| "My balances in five currencies don't add up, and splitting a bill loses a penny." | Money engine: integer minor units, currency exponents, exact FX with spread, banker's rounding, allocation | 1,000,000 seeded splits/conversions vs floating point               |
| "My statement is 100k lines of `SQ *PRET 0342 LDN`."                               | Virtualised transaction feed with search and filters                                                       | DOM nodes, render time and filter latency vs a non-virtualised list |
| "What is `CRV*TRTTORIA GARCIA` and what did I spend on eating out?"                | Merchant categorisation (normalise → knowledge base → fuzzy → rules)                                       | Accuracy on a held-out labelled set vs naive keywords               |
| "Which subscriptions am I still paying for, and when is the next one?"             | Recurring-payment detection                                                                                | Precision/recall vs planted ground truth and a naive baseline       |
| "Who owes whom after the trip?"                                                    | Split the bill with minimum transfers                                                                      | Transfer count vs pairwise settle-up, totals always balance         |
| "How am I doing this month?"                                                       | Insights: KPIs vs previous month, budgets, spend by category/month, balances in a base currency            | Unit tests on exact figures                                         |
| "I think in euros and read German."                                                | Localisation: en-GB, it-IT, es-ES, de-DE                                                                   | Catalogue parity tests and e2e checks                               |

## Principles

1. Money is never a float. Floats appear only for chart geometry.
2. Every headline number is produced by a script and written to `reports/results.json`. No hand-typed figures.
3. Weak results are reported, not tuned away (e.g. exact settle-up rarely beats greedy on random amounts).
4. Accessible by default: WCAG 2.2 AA, keyboard-first, 0 axe violations is a release gate.
5. Works offline: fixtures for FX; the live rates call is optional.

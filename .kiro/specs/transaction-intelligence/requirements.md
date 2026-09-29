# Requirements: Transaction intelligence

## Introduction

A 100,000-row transaction feed that stays fast, with messy descriptors turned into merchants and categories, and
recurring payments found automatically. Each capability is scored against a naive baseline.

## Requirement 1: Virtualised feed

**User story:** As a customer with years of history, I want to scroll and search 100,000 transactions without the page freezing.

1. The system SHALL generate a seeded synthetic feed of 100,000 transactions across five currency accounts.
2. The system SHALL render only the visible rows plus overscan, exposing the full size through `aria-rowcount`/`aria-rowindex`.
3. WHEN the user types a search or changes a category, account or direction filter THEN the list SHALL update without blocking input.
4. WHEN no row matches THEN the system SHALL show an empty state with a clear-filters action.
5. The system SHALL measure DOM nodes, render time and filter latency against a non-virtualised list, AND SHALL say where the baseline was measured at a smaller N.

## Requirement 2: Merchant categorisation

**User story:** As a customer, I want "SQ *PRET A MANGER 0342 LONDON GB" shown as "Pret A Manger · Eating out".

1. The system SHALL normalise descriptors: strip processor prefixes, reference codes, store numbers, locations, legal suffixes and punctuation.
2. The system SHALL match the normalised text against a merchant knowledge base, then fuzzy-match (Jaro–Winkler ≥ 0.90) to survive typos and truncation.
3. WHERE a merchant is unknown THE system SHALL apply multilingual keyword rules (typo-tolerant for words of ≥ 5 letters), else "General".
4. The system SHALL report accuracy on a held-out labelled synthetic set (tuned on a separate dev seed) next to a naive word-boundary keyword baseline.

## Requirement 3: Recurring-payment detection

**User story:** As a customer, I want to see my subscriptions, how often they charge and when the next charge is due.

1. The system SHALL group debits by merchant, cluster by amount (±16%, allowing price rises) and find weekly, monthly or yearly chains, tolerating failed collections.
2. The system SHALL require a minimum number of charges, ≥ 60% coverage of the amount cluster, ≥ 75% fill of the expected dates and a stable price.
3. The system SHALL output cadence, latest amount, monthly equivalent, next due date, active flag and whether the price changed.
4. The system SHALL exclude transfers between own accounts and income.
5. The system SHALL report precision, recall and next-due accuracy (±3 days) on held-out synthetic users against planted ground truth, next to a naive "same amount ≥ 3 times" baseline.

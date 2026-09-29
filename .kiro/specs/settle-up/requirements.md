# Requirements: Split the bill

## Introduction

Shared expenses for a group, settled with as few bank transfers as possible, with totals that always balance.

## Requirement 1: Balances

**User story:** As a group member, I want to see who owes what after shared expenses.

1. The system SHALL compute each member's net balance from expenses split equally or by integer weights, using exact allocation.
2. The sum of all balances SHALL be exactly zero.
3. IF an expense has no participants or a different currency THEN the system SHALL reject it.

## Requirement 2: Minimum transfers

**User story:** As a group, we want the fewest transfers to square up.

1. The system SHALL compute the minimum number of transfers exactly for up to 16 non-zero members (subset dynamic programming), falling back to greedy above that.
2. WHEN the plan's transfers are applied THEN every balance SHALL be exactly zero.
3. The system SHALL show the plan next to the naive pairwise count ("everyone pays each payer back").

## Requirement 3: Editing

1. The user SHALL be able to add and remove people and add expenses with localised amount input.
2. IF the amount is not greater than zero, the name is empty or duplicate, or nobody is selected THEN the system SHALL show an inline error linked to the field.

## Requirement 4: Measured

1. The system SHALL compare transfer counts for pairwise, greedy and exact across ≥ 1,000 seeded groups in two scenarios (arbitrary amounts; whole €10 bills), AND SHALL report how often exact beats greedy.

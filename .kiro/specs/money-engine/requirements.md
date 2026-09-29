# Requirements: Money engine

## Introduction

Exact money arithmetic for a multi-currency wallet: amounts, FX conversion with a spread, rounding and splitting,
benchmarked against the floating-point maths a naive implementation would use.

## Requirement 1: Integer minor units with currency exponents

**User story:** As a customer holding GBP, EUR, JPY and KWD, I want every balance to be exact, so that nothing drifts.

1. The system SHALL store every amount as a safe integer number of minor units together with an ISO 4217 code.
2. The system SHALL use the currency's exponent: GBP, EUR, USD, CHF 2; JPY 0; KWD 3.
3. IF an amount is not a safe integer THEN the system SHALL reject it with a RangeError.
4. IF two amounts in different currencies are added, subtracted or compared THEN the system SHALL throw a CurrencyMismatchError.
5. WHEN a user types a decimal amount THE system SHALL parse it without floating point, rounding extra places half-even.

## Requirement 2: FX conversion with a spread

**User story:** As a customer, I want to see the mid rate, my rate and what the spread costs me, so that pricing is transparent.

1. The system SHALL convert using exact rational cross rates derived from a base-currency rate table.
2. WHEN a spread in basis points is applied THEN the system SHALL report the converted amount, the amount at mid and the fee.
3. The system SHALL round conversion results half-even (banker's rounding) by default.
4. The system SHALL work offline from a dated rate fixture AND SHALL flag any synthetic rate (KWD) in the UI.
5. WHEN the user asks for live rates AND the service is unreachable THEN the system SHALL keep the fixture and say so.

## Requirement 3: Allocation with no lost minor units

**User story:** As someone splitting a bill, I want the shares to add up to the bill exactly.

1. The system SHALL split an amount by integer weights with the largest-remainder method.
2. The sum of the parts SHALL always equal the original amount.
3. Equal splits SHALL differ by at most one minor unit.

## Requirement 4: Measured against floating point

1. The system SHALL run ≥ 1,000,000 seeded random splits and conversions and report minor units lost or mismatched for the engine and for naive float maths.
2. The system SHALL report round-trip rounding error and running-balance drift even where floats perform equally well.
3. Properties (sum preservation, rounding bounds, monotonicity, parse/print round-trip) SHALL be tested with fast-check.

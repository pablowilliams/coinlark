# Requirements: Insights and experience

## Introduction

The dashboard, localisation and the quality bar (accessibility, responsiveness, performance budget) for every page.

## Requirement 1: Insights dashboard

**User story:** As a customer, I want to know how this month compares with last month and where my money went.

1. The system SHALL show KPI tiles (spent, income, net saved, savings rate) for the latest complete month with the change versus the previous month.
2. The system SHALL chart spending by month for 12 complete months and by category, each with a data-table alternative.
3. The system SHALL show budget progress per category with ok, warning (≥ 80%) and over states.
4. The system SHALL total multi-currency balances in a user-chosen base currency using the money engine.

## Requirement 2: Localisation

1. The system SHALL support en-GB, it-IT, es-ES and de-DE for UI text, numbers, currencies and dates, switchable at runtime and remembered.
2. All message catalogues SHALL have identical keys and placeholders.
3. WHEN the user types an amount THEN the system SHALL parse it using the active locale's separators.

## Requirement 3: Accessibility and layout

1. Every page SHALL have 0 axe-core violations (WCAG 2.0/2.1/2.2 A and AA, best practices) in light and dark themes, on desktop and mobile.
2. The system SHALL be fully keyboard operable, with a skip link and visible focus.
3. WHILE the viewport is 375 px wide THE system SHALL not scroll horizontally.
4. The system SHALL offer light, dark and system themes.

## Requirement 4: Performance budget

1. The main JavaScript chunk SHALL be ≤ 80 KB gzip and the initial load ≤ 110 KB gzip; the build SHALL fail the budget script otherwise.
2. The system SHALL report lab web-vitals (FCP, LCP, CLS, TTFB) from Playwright.

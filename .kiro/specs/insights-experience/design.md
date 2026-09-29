# Design: Insights and experience

- `insights.ts` is pure: `spendByMonth`, `categoryTotals`, `kpis`, `budgetProgress`, `balancesInBase`; every value
  converted with `convert()` so totals are exact integers in the base currency.
- KPIs use the latest _complete_ month so a partial month is never compared with a full one.
- Charts are hand-written SVG (`role="img"` + `<title>`) with a `<details>` data table. Colour is never the only cue.
- `SettingsProvider` holds locale, base currency, theme and rates; preferences are stored with a try/catch wrapper.
- Theme tokens are CSS variables under `:root` and `:root[data-theme="dark"]`; an inline script sets the theme pre-paint.
- Pages other than Overview are lazy-loaded to keep the main chunk small.
- Axe runs in `e2e/a11y.spec.ts` for 6 pages × 2 themes × 2 viewports; results are written to `reports/axe/`.

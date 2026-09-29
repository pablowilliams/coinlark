# Contributing

Thanks for taking a look. Coinlark is a portfolio project, but it is run like a product team's repo.

## Setup

```bash
npm ci
npx playwright install chromium   # once; Playwright is pinned to 1.63.0
npm run dev                        # http://localhost:5190
```

## Workflow

1. Start from a spec in `.kiro/specs/`. New behaviour gets an EARS acceptance criterion in `requirements.md`
   and a task in `tasks.md` that cites it (`_Requirements: 2.3_`).
2. Put logic in `src/lib/` as pure functions with unit tests (and a property test if it handles money).
3. UI strings go through `t(key)`; add the key to all four catalogues with a real translation.
4. Run the checks before opening a PR:
   ```bash
   npm run lint && npm run typecheck && npm run coverage && npm run e2e && npm run build && npm run bundle
   ```
5. If you change an algorithm, run `npm run bench` (or `npm run evidence`) and explain any change in
   `reports/results.json` in the PR. Tune on the dev seeds only; the test seeds are for reporting.

## Rules that are not negotiable

- Money is never a JavaScript float. Use `Money`, `fromMajor`, `allocate`, `convert`, `formatMoney`.
- No invented numbers in docs: every figure must come from `reports/results.json`.
- 0 axe violations. Fix the markup rather than disabling a rule.
- No real bank's name, logo, colours or copy.

## Commit style

Conventional-ish: `feat(settle): exact minimum transfers`, `fix(i18n): es-ES grouping`, `docs: …`, `test: …`.

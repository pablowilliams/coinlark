import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PAGES } from './pages';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

for (const theme of ['light', 'dark'] as const) {
  for (const p of PAGES) {
    test(`axe: ${p.name} (${theme}) has no WCAG 2.2 AA violations`, async ({ page }, info) => {
      const sep = p.path.includes('?') ? '&' : '?';
      await page.goto(`./#${p.path}${sep}theme=${theme}`);
      await expect(page.locator('main h1')).toBeVisible();
      if (p.name === 'transactions')
        await expect(page.getByTestId('result-count')).toHaveAttribute('data-ready', 'true', {
          timeout: 30_000,
        });
      // Open the chart's data table too so its markup is checked.
      if (p.name === 'overview') await page.locator('details.data-table summary').click();
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const summary = results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`,
      );
      mkdirSync('reports/axe', { recursive: true });
      writeFileSync(
        `reports/axe/${info.project.name}-${p.name}-${theme}.json`,
        JSON.stringify({
          page: p.name,
          theme,
          project: info.project.name,
          violations: results.violations.length,
          passes: results.passes.length,
          summary,
        }),
      );
      expect(summary).toEqual([]);
    });
  }
}

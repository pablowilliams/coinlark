import { expect, test, type Page } from '@playwright/test';
import { PAGES } from './pages';

async function open(page: Page, path: string, extra = '') {
  const sep = path.includes('?') ? '&' : '?';
  await page.goto(`./#${path}${extra ? sep + extra : ''}`);
  await expect(page.locator('main h1')).toBeVisible();
  if (path.startsWith('/transactions'))
    await expect(page.getByTestId('result-count')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

test.describe('every page', () => {
  for (const p of PAGES) {
    test(`${p.name}: renders, no console errors, no horizontal scroll, no NaN`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await open(page, p.path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.heading);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.locator('body')).not.toContainText(/\bNaN\b|undefined|\{\w+\}/);
      expect(errors).toEqual([]);
    });
  }
});

test('navigation works from the menu and marks the current page', async ({ page, isMobile }) => {
  await open(page, '/');
  for (const p of PAGES.slice(1)) {
    if (isMobile) await page.getByTestId('menu-button').click();
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: p.nav, exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.heading);
    if (!isMobile)
      await expect(
        page.getByRole('navigation', { name: 'Main' }).locator('[aria-current="page"]'),
      ).toBeVisible();
  }
});

test('keyboard: skip link, focus order and visible focus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard flow is desktop-only');
  await open(page, '/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.goto('./#/convert');
  const amount = page.getByTestId('convert-amount');
  await amount.focus();
  const outline = await amount.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('convert-from')).toBeFocused();
});

test('language switching localises numbers, dates and labels', async ({ page, isMobile }) => {
  await open(page, '/');
  const expectations = [
    ['it-IT', 'Panoramica', /\d\.?\d{3},\d\d/],
    ['es-ES', 'Resumen', /\d{1,3}\.?\d{3},\d\d/],
    ['de-DE', 'Übersicht', /\d\.\d{3},\d\d/],
    ['en-GB', 'Overview', /£[\d,]+\.\d\d/],
  ] as const;
  for (const [locale, heading, pattern] of expectations) {
    if (isMobile) await page.getByTestId('menu-button').click();
    await page.getByTestId('locale-select').selectOption(locale);
    if (isMobile) await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.getByTestId('balance-total')).toHaveText(pattern);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(locale);
  }
});

test('base currency and theme switch', async ({ page, isMobile }) => {
  await open(page, '/');
  if (isMobile) await page.getByTestId('menu-button').click();
  await page.getByTestId('base-select').selectOption('JPY');
  await page.getByTestId('theme-select').selectOption('dark');
  if (isMobile) await page.keyboard.press('Escape');
  await expect(page.getByTestId('balance-total')).toHaveText(/^JP¥[\d,]+$/);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.reload();
  await expect(page.getByTestId('balance-total')).toHaveText(/^JP¥[\d,]+$/);
});

test('transactions: search and filters on a virtualised feed', async ({ page }) => {
  await open(page, '/transactions?n=10000');
  const count = page.getByTestId('result-count');
  await expect(count).toHaveText('10,000 results');
  const rows = await page.locator('[data-testid="feed-scroll"] [role="row"]').count();
  expect(rows).toBeLessThan(50);
  await page.getByTestId('search').fill('tesco');
  await expect(count).toHaveAttribute('data-query', 'tesco');
  const n = Number(await count.getAttribute('data-count'));
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(10_000);
  await page.getByTestId('direction-filter').selectOption('in');
  await expect(page.getByTestId('feed-empty')).toBeVisible();
  await page.getByTestId('feed-empty').getByRole('button').click();
  await expect(count).toHaveText('10,000 results');
  // Scroll half-way: the rows in the DOM must be the ones around row 5,000, and there must still be few of them.
  await page.getByTestId('feed-scroll').evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
  await expect
    .poll(async () =>
      Number(
        await page.locator('[data-testid="feed-scroll"] [role="row"]').first().getAttribute('aria-rowindex'),
      ),
    )
    .toBeGreaterThan(4900);
  expect(await page.locator('[data-testid="feed-scroll"] [role="row"]').count()).toBeLessThan(50);
});

test('split: add an expense and still settle to zero', async ({ page }) => {
  await open(page, '/split');
  const form = page.getByTestId('expense-form');
  await form.getByLabel('Description').fill('Taxi');
  await form.getByLabel('Amount (EUR)').fill('33.33');
  await form.getByRole('button', { name: 'Add expense' }).click();
  await expect(page.getByTestId('expenses')).toContainText('Taxi');
  await expect(page.getByTestId('split-check')).toContainText('€0.00');
  const plan = Number((await page.getByTestId('plan-count').textContent())!.match(/\d+/)![0]);
  const naive = Number(await page.getByTestId('naive-count').textContent());
  expect(plan).toBeLessThan(naive);
});

test('convert: exact result, spread and offline fixture', async ({ page }) => {
  await page.route('**/api.frankfurter.app/**', (r) => r.abort());
  await open(page, '/convert');
  await expect(page.getByTestId('convert-result')).toHaveText('€1,159.88');
  await page.getByTestId('convert-amount').fill('10');
  await page.getByTestId('convert-to').selectOption('KWD');
  await expect(page.getByTestId('convert-result')).toHaveText(/^KWD\s?\d+\.\d{3}$/);
  await page.getByRole('button', { name: /Fetch live ECB rates/ }).click();
  await expect(page.getByText(/still using the offline fixture/)).toBeVisible();
});

test('categoriser: typo-tolerant rules beat the naive keyword baseline', async ({ page }) => {
  await open(page, '/categorise');
  await page.getByTestId('cat-input').fill('PIZZZERIA MARINO DUBLIN');
  await expect(page.getByTestId('cat-category')).toHaveText('Eating out');
  await expect(page.getByTestId('cat-naive')).toHaveText('General');
});

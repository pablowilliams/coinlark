/**
 * Screenshot every page: 1440×900 in dark and light, and 375×812 mobile (light + dark).
 * Also records console errors and horizontal overflow per shot. Needs `npm run build` first.
 *   npm run screenshots            → docs/screenshots/*.jpg + reports/parts/screenshots.json
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, writePart } from './results';
import { startPreview } from './serve';

const PAGES = [
  ['overview', '/'],
  ['transactions', '/transactions'],
  ['subscriptions', '/subscriptions'],
  ['split', '/split'],
  ['convert', '/convert'],
  ['categorise', '/categorise'],
] as const;

const VIEWS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 375, height: 812, mobile: true },
] as const;

const out = join(ROOT, 'docs', 'screenshots');
mkdirSync(out, { recursive: true });
const only = process.argv[2];
const locale = process.argv[3];

const server = await startPreview(5192);
const browser = await chromium.launch();
const shots: Array<Record<string, unknown>> = [];
try {
  for (const view of VIEWS) {
    for (const theme of ['dark', 'light'] as const) {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: view.mobile ? 2 : 1,
        isMobile: view.mobile,
        hasTouch: view.mobile,
        colorScheme: theme,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      for (const [name, path] of PAGES) {
        if (only && only !== name) continue;
        errors.length = 0;
        const q = new URLSearchParams({ theme, ...(locale ? { lang: locale } : {}) });
        await page.goto(`${server.url}#${path}?${q}`);
        await page.waitForSelector('main h1');
        if (name === 'transactions') await page.waitForSelector('[data-ready="true"]', { timeout: 30_000 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(250);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        const bad = await page.evaluate(() => /\bNaN\b|undefined|\{\w+\}/.test(document.body.innerText));
        const file = `${name}-${view.name === 'mobile' ? 'mobile-' : ''}${theme}${locale ? `-${locale}` : ''}.jpg`;
        await page.screenshot({
          path: join(out, file),
          type: 'jpeg',
          quality: 82,
          fullPage: view.mobile || name !== 'transactions',
        });
        shots.push({
          file,
          view: view.name,
          theme,
          overflowPx: overflow,
          suspiciousText: bad,
          consoleErrors: [...errors],
        });
        console.log(
          `${file}: overflow ${overflow}px${bad ? ' · suspicious text' : ''}${errors.length ? ` · ${errors.length} console errors` : ''}`,
        );
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
if (!only && !locale) {
  writePart('screenshots', {
    count: shots.length,
    maxOverflowPx: Math.max(...shots.map((s) => s.overflowPx as number)),
    consoleErrors: shots.reduce((a, s) => a + (s.consoleErrors as string[]).length, 0),
    suspiciousText: shots.filter((s) => s.suspiciousText).length,
    shots,
  });
}

/**
 * Performance evidence, measured in headless Chromium against the production build (no CPU/network throttling).
 * Writes reports/parts/feed.json and reports/parts/vitals.json via scripts/results.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { writePart } from '../scripts/results';

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN;
};
const p95 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]!;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

async function loadFeed(page: Page, n: number, virtual: boolean, timeout: number) {
  await page.goto('about:blank'); // cold load every time: nothing cached in memory
  await page.goto(`./#/transactions?n=${n}&virtual=${virtual ? 1 : 0}`);
  await page.waitForFunction(() => window.__feedPerf?.done === true, undefined, { timeout, polling: 100 });
  return page.evaluate(() => ({
    generateMs: window.__feedPerf!.generateMs,
    renderMs: window.__feedPerf!.renderMs!,
    domNodes: document.getElementsByTagName('*').length,
    rowsInDom: document.querySelectorAll('[data-testid="feed-scroll"] [role="row"]').length,
  }));
}

/** Time from the input event to the filtered result being committed and painted. */
async function filterLatency(page: Page, query: string): Promise<number> {
  return page.evaluate(async (q) => {
    const input = document.getElementById('tx-search') as HTMLInputElement;
    const status = document.querySelector('[data-testid="result-count"]') as HTMLElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const t0 = performance.now();
    setter.call(input, q);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise<void>((resolve) => {
      const check = () =>
        status.dataset.query === q ? requestAnimationFrame(() => resolve()) : requestAnimationFrame(check);
      check();
    });
    return performance.now() - t0;
  }, query);
}

const QUERIES = ['tesco', 'uber', 'amazon', 'coffee', 'netflix', 'pret', 'lidl', 'shell', 'zara', 'boots'];

test('feed: virtualised vs non-virtualised baseline', async ({ page }) => {
  const runs: Array<Record<string, unknown>> = [];
  const configs: Array<{ n: number; virtual: boolean; reps: number; timeout: number }> = [
    { n: 1_000, virtual: true, reps: 3, timeout: 60_000 },
    { n: 10_000, virtual: true, reps: 3, timeout: 60_000 },
    { n: 100_000, virtual: true, reps: 3, timeout: 120_000 },
    { n: 1_000, virtual: false, reps: 3, timeout: 60_000 },
    { n: 10_000, virtual: false, reps: 3, timeout: 120_000 },
    { n: 100_000, virtual: false, reps: 1, timeout: 180_000 },
  ];
  for (const c of configs) {
    const loads = [];
    let error: string | null = null;
    for (let r = 0; r < c.reps; r++) {
      try {
        loads.push(await loadFeed(page, c.n, c.virtual, c.timeout));
      } catch (e) {
        error = `did not finish within ${c.timeout / 1000}s (${String(e).split('\n')[0]})`;
        break;
      }
    }
    let latencies: number[] = [];
    if (!error) {
      // warm-up, then measure each query twice (typing it and clearing back to empty)
      await filterLatency(page, 'warmup');
      // The 100k non-virtualised baseline re-renders 100k rows per keystroke, so it gets fewer samples.
      for (const q of c.n === 100_000 && !c.virtual ? QUERIES.slice(0, 3) : QUERIES) {
        latencies.push(await filterLatency(page, q));
        latencies.push(await filterLatency(page, ''));
      }
    } else {
      latencies = [];
      await page.goto('about:blank');
    }
    runs.push({
      n: c.n,
      virtual: c.virtual,
      completed: !error,
      error,
      reps: loads.length,
      generateMs: r1(median(loads.map((l) => l.generateMs))),
      renderMs: r1(median(loads.map((l) => l.renderMs))),
      domNodes: loads.length ? median(loads.map((l) => l.domNodes)) : null,
      rowsInDom: loads.length ? median(loads.map((l) => l.rowsInDom)) : null,
      filterMedianMs: latencies.length ? r1(median(latencies)) : null,
      filterP95Ms: latencies.length ? r1(p95(latencies)) : null,
      filterSamples: latencies.length,
    });
    console.log(JSON.stringify(runs[runs.length - 1]));
  }
  const find = (n: number, v: boolean) => runs.find((r) => r.n === n && r.virtual === v)!;
  writePart('feed', {
    note: 'Headless Chromium 1440×900, production build, no throttling, one machine. generateMs = seeded generation + categorisation (same for both modes); renderMs = data ready → first paint of rows; filter latency = input event → filtered result committed and painted.',
    runs,
    headline: {
      virtual100k: find(100_000, true),
      baseline10k: find(10_000, false),
      baseline100k: find(100_000, false),
      virtual10k: find(10_000, true),
    },
  });
  expect(find(100_000, true).completed).toBe(true);
});

test('web vitals (lab) on page load', async ({ page }) => {
  const pages = [
    ['overview', './#/'],
    ['transactions-100k', './#/transactions'],
  ] as const;
  const out: Record<string, unknown> = {};
  for (const [name, url] of pages) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      await page.goto('about:blank');
      await page.goto(url);
      await page.locator('main h1').waitFor();
      if (name.startsWith('transactions'))
        await page.waitForFunction(() => window.__feedPerf?.done === true, undefined, { timeout: 60_000 });
      await page.waitForTimeout(500);
      samples.push(
        await page.evaluate(
          () =>
            new Promise<{ fcp: number; lcp: number; cls: number; ttfb: number; domContentLoaded: number }>(
              (resolve) => {
                let lcp = 0;
                let cls = 0;
                new PerformanceObserver((l) => {
                  for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
                }).observe({ type: 'largest-contentful-paint', buffered: true });
                new PerformanceObserver((l) => {
                  for (const e of l.getEntries() as Array<
                    PerformanceEntry & { value: number; hadRecentInput: boolean }
                  >)
                    if (!e.hadRecentInput) cls += e.value;
                }).observe({ type: 'layout-shift', buffered: true });
                setTimeout(() => {
                  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
                  const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN;
                  resolve({
                    fcp,
                    lcp,
                    cls,
                    ttfb: nav.responseStart,
                    domContentLoaded: nav.domContentLoadedEventEnd,
                  });
                }, 300);
              },
            ),
        ),
      );
    }
    out[name] = {
      samples: samples.length,
      fcpMs: r1(median(samples.map((s) => s.fcp))),
      lcpMs: r1(median(samples.map((s) => s.lcp))),
      cls: Math.round(median(samples.map((s) => s.cls)) * 1000) / 1000,
      ttfbMs: r1(median(samples.map((s) => s.ttfb))),
      domContentLoadedMs: r1(median(samples.map((s) => s.domContentLoaded))),
    };
  }
  writePart('vitals', {
    note: 'Lab metrics (not field data): headless Chromium, local preview server, no throttling, median of 5 cold loads. Thresholds for "good": LCP ≤ 2500 ms, CLS ≤ 0.1.',
    ...out,
  });
});

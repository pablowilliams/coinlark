/**
 * Bundle-size budget. Reads dist/ (run `npm run build` first), gzips every asset and checks the budget.
 * Writes reports/parts/bundle.json; exits 1 if the main chunk is over budget.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ROOT, writePart } from './results';

export const BUDGET_MAIN_GZIP_KB = 80;
export const BUDGET_INITIAL_GZIP_KB = 110;

const dist = join(ROOT, 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const kb = (n: number) => Math.round((n / 1024) * 10) / 10;
const assets = readdirSync(join(dist, 'assets')).map((f) => {
  const buf = readFileSync(join(dist, 'assets', f));
  return {
    file: f,
    rawKb: kb(statSync(join(dist, 'assets', f)).size),
    gzipKb: kb(gzipSync(buf, { level: 9 }).length),
  };
});
const mainFile = /<script type="module" crossorigin src="\.\/assets\/([^"]+)"/.exec(html)?.[1];
const preloads = [...html.matchAll(/rel="modulepreload" crossorigin href="\.\/assets\/([^"]+)"/g)].map(
  (m) => m[1],
);
const css = [...html.matchAll(/rel="stylesheet" crossorigin href="\.\/assets\/([^"]+)"/g)].map((m) => m[1]);
const main = assets.find((a) => a.file === mainFile);
if (!main) throw new Error('main chunk not found in dist/index.html');
const initial = assets.filter(
  (a) => a.file === mainFile || preloads.includes(a.file) || css.includes(a.file),
);
const initialGzipKb = kb(initial.reduce((s, a) => s + a.gzipKb * 1024, 0));
const result = {
  main: main.file,
  mainGzipKb: main.gzipKb,
  mainRawKb: main.rawKb,
  initialGzipKb,
  initialFiles: initial.map((a) => a.file),
  totalGzipKb: kb(assets.reduce((s, a) => s + a.gzipKb * 1024, 0)),
  budget: { mainGzipKb: BUDGET_MAIN_GZIP_KB, initialGzipKb: BUDGET_INITIAL_GZIP_KB },
  withinBudget: main.gzipKb <= BUDGET_MAIN_GZIP_KB && initialGzipKb <= BUDGET_INITIAL_GZIP_KB,
  assets,
};
writePart('bundle', result);
console.log(
  `main ${main.gzipKb} KB gzip (budget ${BUDGET_MAIN_GZIP_KB}) · initial ${initialGzipKb} KB (budget ${BUDGET_INITIAL_GZIP_KB})`,
);
if (!result.withinBudget) process.exit(1);

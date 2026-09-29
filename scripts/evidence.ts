/**
 * Build the Kiro evidence pack: spec requirement → tests → measured number.
 *
 *   npm run evidence                 # unit + coverage, benchmarks, build + bundle, e2e + axe, perf
 *   npm run evidence -- --fast       # skip Playwright (reuses the last e2e/perf results on disk)
 *   npm run evidence -- --no-run     # only re-evaluate .kiro/evidence.yml against existing reports
 *
 * Outputs: reports/results.json, reports/evidence.json, docs/EVIDENCE.md
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { mergeResults, PARTS, REPORTS, ROOT, writePart } from './results';

const args = new Set(process.argv.slice(2));
const run = (cmd: string, env: Record<string, string> = {}) => {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    return true;
  } catch {
    console.warn(`(command failed: ${cmd})`);
    return false;
  }
};

type Status = 'passed' | 'failed' | 'skipped';
function parseJunit(file: string): Array<{ id: string; status: Status }> {
  if (!existsSync(file)) return [];
  const xml = readFileSync(file, 'utf8');
  const out: Array<{ id: string; status: Status }> = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const m of xml.matchAll(re)) {
    const attrs = m[1] ?? '';
    const body = m[3] ?? '';
    const get = (k: string) => new RegExp(`${k}="([^"]*)"`).exec(attrs)?.[1] ?? '';
    const status: Status = /<(failure|error)\b/.test(body)
      ? 'failed'
      : /<skipped\b/.test(body)
        ? 'skipped'
        : 'passed';
    out.push({ id: `${get('classname')} :: ${get('name')}`, status });
  }
  return out;
}

// ---------------------------------------------------------------- run everything
if (!args.has('--no-run')) {
  run('npx vitest run --coverage --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml');
  run('npx tsx bench/run-all.ts');
  run('npx tsc -b && npx vite build');
  run('npx tsx scripts/bundle-size.ts');
  if (!args.has('--fast')) {
    rmSync(join(REPORTS, 'axe'), { recursive: true, force: true });
    run('npx playwright test', { PLAYWRIGHT_JUNIT_OUTPUT_NAME: 'reports/e2e-junit.xml' });
    run('npx playwright test -c playwright.perf.config.ts');
  }
}

// ---------------------------------------------------------------- collect test + quality results
const unit = parseJunit(join(REPORTS, 'junit.xml'));
const e2e = parseJunit(join(REPORTS, 'e2e-junit.xml'));
const covFile = join(REPORTS, 'coverage', 'coverage-summary.json');
const cov = existsSync(covFile) ? JSON.parse(readFileSync(covFile, 'utf8')).total : null;
const count = (xs: typeof unit, s: Status) => xs.filter((x) => x.status === s).length;
writePart('tests', {
  unit: {
    total: unit.length,
    passed: count(unit, 'passed'),
    failed: count(unit, 'failed'),
    skipped: count(unit, 'skipped'),
  },
  coverage: cov
    ? {
        scope: 'src/lib/**',
        lines: cov.lines.pct,
        statements: cov.statements.pct,
        branches: cov.branches.pct,
        functions: cov.functions.pct,
      }
    : null,
  e2e: {
    total: e2e.length,
    passed: count(e2e, 'passed'),
    failed: count(e2e, 'failed'),
    skipped: count(e2e, 'skipped'),
    projects: ['desktop 1440×900', 'mobile 375×812'],
  },
});

const axeDir = join(REPORTS, 'axe');
if (existsSync(axeDir)) {
  const scans = readdirSync(axeDir).map(
    (f) =>
      JSON.parse(readFileSync(join(axeDir, f), 'utf8')) as {
        violations: number;
        passes: number;
        page: string;
        theme: string;
        project: string;
      },
  );
  writePart('a11y', {
    tool: 'axe-core via @axe-core/playwright; tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice',
    scans: scans.length,
    pages: [...new Set(scans.map((s) => s.page))].length,
    violations: scans.reduce((a, s) => a + s.violations, 0),
    scansWithViolations: scans.filter((s) => s.violations > 0).length,
    passedRuleChecks: scans.reduce((a, s) => a + s.passes, 0),
  });
}
const results = mergeResults() as Record<string, unknown>;

// ---------------------------------------------------------------- evaluate .kiro/evidence.yml
const lookup = (path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], results);
const FORMATS: Record<string, (v: number) => string> = {
  int: (v) => Math.round(v).toLocaleString('en-GB'),
  pct: (v) => `${(v * 100).toFixed(1)}%`,
  pct0: (v) => `${Math.round(v * 100)}%`,
  pct2: (v) => `${(v * 100).toFixed(2)}%`,
  f1: (v) => v.toFixed(1),
  f2: (v) => v.toFixed(2),
  f3: (v) => v.toFixed(3),
  f5: (v) => v.toFixed(5),
  ms: (v) => `${v.toFixed(1)} ms`,
  kb: (v) => `${v.toFixed(1)} KB`,
  raw: (v) => String(v),
};
function render(template: string): string {
  return template.replace(/\{([\w.]+)(?:\|(\w+))?\}/g, (_m, path: string, fmt = 'raw') => {
    const v = lookup(path);
    if (v === undefined || v === null) return `n/a(${path})`;
    if (typeof v !== 'number') return String(v);
    const f = FORMATS[fmt];
    if (!f) throw new Error(`unknown format ${fmt}`);
    return f(v);
  });
}

interface Item {
  id: string;
  spec: string;
  requirement: string;
  tested: string;
  context: string;
  metric: string;
  value: string;
  baseline?: string;
  tests: string[];
  libraries: string[];
}
const spec = parse(readFileSync(join(ROOT, '.kiro', 'evidence.yml'), 'utf8')) as { items: Item[] };
const items = spec.items.map((it) => {
  const hits = it.tests.map((pattern) => {
    const pool = pattern.startsWith('e2e/') ? e2e : unit;
    const needle = pattern.replace(/^e2e\//, '');
    const [file, name] = needle.split('::').map((s) => s.trim());
    const m = pool.filter((t) => t.id.includes(file!) && (!name || t.id.includes(name)));
    return {
      id: pattern,
      passed: count(m, 'passed'),
      failed: count(m, 'failed'),
      skipped: count(m, 'skipped'),
    };
  });
  const passed = hits.reduce((a, h) => a + h.passed, 0);
  const failed = hits.reduce((a, h) => a + h.failed, 0);
  const value = render(it.value);
  const baseline = it.baseline ? render(it.baseline) : '';
  const missing = value.includes('n/a(') || baseline.includes('n/a(');
  return {
    ...it,
    value,
    baseline,
    tests: hits,
    testsPassed: passed,
    testsFailed: failed,
    status: failed || missing ? 'fail' : passed ? 'pass' : 'measured',
  };
});

const specsDir = join(ROOT, '.kiro', 'specs');
const specs = readdirSync(specsDir)
  .sort()
  .map((name) => {
    const req = readFileSync(join(specsDir, name, 'requirements.md'), 'utf8');
    const tasks = readFileSync(join(specsDir, name, 'tasks.md'), 'utf8');
    return {
      name,
      requirements: (req.match(/^## Requirement/gm) ?? []).length,
      criteria: (req.match(/^\d+\. /gm) ?? []).length,
      tasksDone: (tasks.match(/- \[x\]/g) ?? []).length,
      tasksTotal: (tasks.match(/- \[[ x]\]/g) ?? []).length,
    };
  });
const tests = results.tests as {
  unit: { passed: number; total: number };
  e2e: { passed: number; total: number; skipped: number };
  coverage: { lines: number } | null;
};
const summary = {
  specs: specs.length,
  requirements: specs.reduce((a, s) => a + s.requirements, 0),
  criteria: specs.reduce((a, s) => a + s.criteria, 0),
  tasksDone: specs.reduce((a, s) => a + s.tasksDone, 0),
  tasksTotal: specs.reduce((a, s) => a + s.tasksTotal, 0),
  hooks: readdirSync(join(ROOT, '.kiro', 'hooks')).filter((f) => f.endsWith('.kiro.hook')).length,
  steeringDocs: readdirSync(join(ROOT, '.kiro', 'steering')).length,
  unitPassed: tests.unit.passed,
  unitTotal: tests.unit.total,
  e2ePassed: tests.e2e.passed,
  e2eRun: tests.e2e.total - tests.e2e.skipped,
  e2eSkipped: tests.e2e.skipped,
  coverageLines: tests.coverage?.lines ?? null,
  evidenceItems: items.length,
  evidencePassing: items.filter((i) => i.status !== 'fail').length,
};
const generatedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
writeFileSync(
  join(REPORTS, 'evidence.json'),
  JSON.stringify({ generatedAt, summary, specs, items }, null, 2) + '\n',
);

const md = [
  '# Evidence pack',
  '',
  'Every requirement in `.kiro/specs` is linked to the tests that verify it and the number it produced.',
  `Generated ${generatedAt} by \`npm run evidence\`; the mapping lives in [\`.kiro/evidence.yml\`](../.kiro/evidence.yml) and every number comes from [\`reports/results.json\`](../reports/results.json).`,
  'All data is synthetic and seeded. Timings are lab measurements on one machine (headless Chromium, no throttling).',
  '',
  '## At a glance',
  '',
  '| Specs | Requirements | EARS criteria | Tasks done | Hooks | Unit tests | Coverage (src/lib) | Browser checks |',
  '|---|---|---|---|---|---|---|---|',
  `| ${summary.specs} | ${summary.requirements} | ${summary.criteria} | ${summary.tasksDone}/${summary.tasksTotal} | ${summary.hooks} | ${summary.unitPassed}/${summary.unitTotal} | ${summary.coverageLines ?? 'n/a'}% lines | ${summary.e2ePassed}/${summary.e2eRun}${summary.e2eSkipped ? ` (+${summary.e2eSkipped} desktop-only skipped on mobile)` : ''} |`,
  '',
  '## Evidence table',
  '',
  '| ID | Requirement | Result | Baseline / comparison | Tests | Status |',
  '|---|---|---|---|---|---|',
  ...items.map(
    (i) =>
      `| ${i.id} | ${i.requirement} | **${i.value}** | ${i.baseline} | ${i.testsPassed} passed${i.testsFailed ? `, ${i.testsFailed} failed` : ''} | ${i.status} |`,
  ),
  '',
  '## Detail (CV-ready statements)',
  '',
  ...items.flatMap((i) => [
    `### ${i.id} · ${i.metric}`,
    `- **Tested:** ${i.tested}`,
    `- **Context:** ${i.context}`,
    `- **Result:** ${i.value}. **Compared with:** ${i.baseline || 'n/a'}.`,
    `- **Verified by:** ${i.tests.map((t) => `\`${t.id}\` (${t.passed} passed)`).join(', ') || 'measurement script only'}.`,
    `- **Libraries:** ${i.libraries.join(', ')}.`,
    '',
  ]),
];
writeFileSync(join(ROOT, 'docs', 'EVIDENCE.md'), md.join('\n'));
console.log(
  `\nevidence: ${summary.evidencePassing}/${summary.evidenceItems} items OK · ${summary.unitPassed}/${summary.unitTotal} unit · ${summary.e2ePassed}/${summary.e2eRun} e2e · coverage ${summary.coverageLines}%`,
);
void PARTS;
if (summary.evidencePassing !== summary.evidenceItems) process.exit(1);

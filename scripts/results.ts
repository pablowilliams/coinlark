import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPORTS = join(ROOT, 'reports');
export const PARTS = join(REPORTS, 'parts');

/** Write one section of the results (e.g. "money") and rebuild reports/results.json from all sections. */
export function writePart(name: string, data: unknown): void {
  mkdirSync(PARTS, { recursive: true });
  writeFileSync(join(PARTS, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  mergeResults();
}

export function mergeResults(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (existsSync(PARTS)) {
    for (const f of readdirSync(PARTS)
      .filter((f) => f.endsWith('.json'))
      .sort()) {
      out[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(PARTS, f), 'utf8'));
    }
  }
  const results = {
    note: 'Every number in this file is produced by a script in this repo (see .kiro/evidence.yml). All data is synthetic and seeded.',
    generated_at: new Date().toISOString(),
    node: process.version,
    ...out,
  };
  writeFileSync(join(REPORTS, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  return results;
}

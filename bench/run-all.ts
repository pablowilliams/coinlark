import { writePart } from '../scripts/results';
import { runCategoriseBench } from './categorise';
import { runMoneyBench } from './money';
import { runRecurringBench } from './recurring';
import { runSettleBench } from './settle';

const only = process.argv[2];
const steps: Array<[string, () => unknown]> = [
  ['money', () => runMoneyBench()],
  ['categorise', () => runCategoriseBench()],
  ['recurring', () => runRecurringBench()],
  ['settle', () => runSettleBench()],
];
for (const [name, run] of steps) {
  if (only && only !== name) continue;
  const t0 = performance.now();
  writePart(name, run());
  console.log(`bench ${name}: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
}

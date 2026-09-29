/**
 * Settle-up: transfers needed by the naive pairwise approach vs greedy vs exact minimum,
 * across seeded random groups. Also checks every plan leaves every balance at exactly zero.
 */
import { createRng } from '../src/lib/data/rng';
import { money } from '../src/lib/money/money';
import {
  applyTransfers,
  balances,
  greedyTransfers,
  optimalTransfers,
  pairwiseTransfers,
  type Expense,
} from '../src/lib/settle/settle';

export function randomGroup(seed: number, round = false) {
  const rng = createRng(seed);
  const size = rng.int(3, 12);
  const members = Array.from({ length: size }, (_, i) => `P${i + 1}`);
  const expenses: Expense[] = [];
  const count = rng.int(4, 30);
  for (let e = 0; e < count; e++) {
    const between = members.filter(() => rng.chance(0.6));
    if (between.length === 0) between.push(members[0]!);
    expenses.push({
      id: `e${e}`,
      description: `Expense ${e + 1}`,
      paidBy: rng.pick(members),
      // round: whole €10 bills split evenly, as friends often do; otherwise any amount, sometimes weighted
      amount: money(round ? rng.int(1, 12) * 1000 : rng.int(100, 40_000), 'EUR'),
      splitBetween: between,
      weights: !round && rng.chance(0.2) ? between.map(() => rng.int(1, 3)) : undefined,
    });
  }
  return { members, expenses };
}

function scenario(groups: number, firstSeed: number, round: boolean) {
  let naive = 0;
  let greedy = 0;
  let optimal = 0;
  let balanced = 0;
  let conserved = 0;
  let optimalBeatsGreedy = 0;
  let people = 0;
  let expenseCount = 0;
  let ms = 0;
  for (let g = 0; g < groups; g++) {
    const { members, expenses } = randomGroup(firstSeed + g, round);
    people += members.length;
    expenseCount += expenses.length;
    const net = balances(members, expenses, 'EUR');
    const sum = [...net.values()].reduce((a, b) => a + b, 0);
    if (sum === 0) conserved++;
    const p = pairwiseTransfers(expenses, 'EUR');
    const gr = greedyTransfers(net, 'EUR');
    const t0 = performance.now();
    const op = optimalTransfers(net, 'EUR');
    ms += performance.now() - t0;
    naive += p.length;
    greedy += gr.length;
    optimal += op.length;
    if (op.length < gr.length) optimalBeatsGreedy++;
    const allZero = (m: Map<string, number>) => [...m.values()].every((v) => v === 0);
    if (
      allZero(applyTransfers(net, op)) &&
      allZero(applyTransfers(net, gr)) &&
      allZero(applyTransfers(net, p))
    )
      balanced++;
  }
  return {
    groups,
    firstSeed,
    amounts: round ? 'whole €10 bills, equal splits' : 'any amount €1–€400, 20% weighted splits',
    meanGroupSize: people / groups,
    meanExpenses: expenseCount / groups,
    transfers: { pairwise: naive, greedy, optimal },
    meanTransfers: { pairwise: naive / groups, greedy: greedy / groups, optimal: optimal / groups },
    reductionVsPairwise: 1 - optimal / naive,
    optimalBeatsGreedyInGroups: optimalBeatsGreedy,
    groupsBalancedToZero: balanced,
    groupsWhereSharesSumToTotal: conserved,
    msPerGroupOptimal: ms / groups,
  };
}

export function runSettleBench(groups = 1000) {
  return { random: scenario(groups, 7000, false), roundBills: scenario(groups, 9000, true) };
}

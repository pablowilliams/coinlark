import type { CategoryId } from './categories';
import { MERCHANTS } from './merchants';
import { HARD_NOISE, messyMerchant, type NoiseLevel } from './noise';
import { createRng } from './rng';

const NAMES = [
  'Rossi',
  'Bianchi',
  'Garcia',
  'Lopez',
  'Muller',
  'Schmidt',
  'Patel',
  'Jones',
  'Marino',
  'Romano',
  'Fernandez',
  'Weber',
  'Taylor',
  'Conti',
  'Ricci',
  'Navarro',
  'Becker',
  'Evans',
  'Okafor',
  'Novak',
  'Kowalski',
  'Moreau',
  'Silva',
  'Hughes',
];

/** Independent businesses that are NOT in the knowledge base, with their true category. */
const UNSEEN_TEMPLATES: ReadonlyArray<readonly [CategoryId, string]> = [
  ['eating-out', 'Trattoria {n}'],
  ['eating-out', 'Pizzeria {n}'],
  ['eating-out', "{n}'s Kitchen"],
  ['eating-out', 'Cafe {n}'],
  ['eating-out', 'Bar {n}'],
  ['eating-out', '{n} Sushi'],
  ['eating-out', 'Osteria {n}'],
  ['eating-out', 'Panaderia {n}'],
  ['eating-out', '{n} Burger Co'],
  ['eating-out', 'Da {n}'],
  ['groceries', '{n} Supermarket'],
  ['groceries', 'Alimentari {n}'],
  ['groceries', '{n} Organic Market'],
  ['groceries', 'Metzgerei {n}'],
  ['groceries', 'Supermercado {n}'],
  ['groceries', '{n} Family Grocers'],
  ['transport', '{n} Taxis'],
  ['transport', '{n} Parking'],
  ['transport', 'Tankstelle {n}'],
  ['transport', '{n} Cabs'],
  ['health', 'Farmacia {n}'],
  ['health', '{n} Pharmacy'],
  ['health', 'Apotheke {n}'],
  ['health', '{n} Dental Clinic'],
  ['health', '{n} Fitness'],
  ['travel', 'Hotel {n}'],
  ['travel', '{n} Hostel'],
  ['travel', 'Albergo {n}'],
  ['shopping', '{n} Books'],
  ['shopping', '{n} Boutique'],
  ['shopping', 'Ferramenta {n}'],
  ['shopping', '{n} & Co'],
  ['entertainment', 'Cinema {n}'],
  ['entertainment', 'Teatro {n}'],
  ['entertainment', '{n} Bowling'],
];

export interface LabelledExample {
  readonly raw: string;
  readonly category: CategoryId;
  readonly known: boolean;
}

/**
 * A labelled set of messy descriptors. Tune on one seed (dev) and report on another (test): the test
 * strings are never seen while writing rules or thresholds.
 */
export function labelledSet(
  seed: number,
  n: number,
  unseenShare = 0.2,
  level: NoiseLevel = HARD_NOISE,
): LabelledExample[] {
  const rng = createRng(seed);
  const out: LabelledExample[] = [];
  for (let i = 0; i < n; i++) {
    if (rng.chance(unseenShare)) {
      const [category, template] = rng.pick(UNSEEN_TEMPLATES);
      const name = template.replace('{n}', rng.pick(NAMES));
      out.push({ raw: messyMerchant(name, rng, level), category, known: false });
    } else {
      const m = rng.pick(MERCHANTS);
      out.push({ raw: messyMerchant(m.name, rng, level), category: m.category, known: true });
    }
  }
  return out;
}

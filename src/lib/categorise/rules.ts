import type { CategoryId } from '../data/categories';
import { jaroWinkler } from './fuzzy';

/**
 * Generic keyword rules for merchants that are not in the knowledge base (independent shops, restaurants,
 * pharmacies). Matched against whole normalised tokens, so "bar" does not fire inside "barber".
 * Multilingual on purpose: English, Italian, Spanish and German descriptors.
 */
export const KEYWORD_RULES: ReadonlyArray<readonly [CategoryId, readonly string[]]> = [
  [
    'eating-out',
    [
      'cafe',
      'caffe',
      'coffee',
      'kaffee',
      'restaurant',
      'ristorante',
      'restaurante',
      'trattoria',
      'osteria',
      'pizzeria',
      'pizza',
      'bistro',
      'bakery',
      'baeckerei',
      'backerei',
      'panaderia',
      'pasticceria',
      'gelateria',
      'sushi',
      'burger',
      'kebab',
      'grill',
      'taqueria',
      'bar',
      'pub',
      'tapas',
      'kitchen',
      'noodle',
      'deli',
    ],
  ],
  [
    'groceries',
    [
      'supermarket',
      'supermercato',
      'supermercado',
      'supermarkt',
      'grocer',
      'grocery',
      'mkt',
      'market',
      'mercato',
      'mercado',
      'markt',
      'alimentari',
      'fruttivendolo',
      'butcher',
      'macelleria',
      'carniceria',
      'metzgerei',
      'organic',
      'bio',
    ],
  ],
  [
    'transport',
    [
      'taxi',
      'cab',
      'cabs',
      'parking',
      'parcheggio',
      'aparcamiento',
      'parkhaus',
      'fuel',
      'petrol',
      'benzina',
      'gasolinera',
      'tankstelle',
      'rail',
      'railway',
      'metro',
      'bus',
      'tram',
      'ferry',
      'toll',
      'autostrade',
    ],
  ],
  [
    'health',
    [
      'pharmacy',
      'chemist',
      'farmacia',
      'apotheke',
      'dental',
      'dentist',
      'dentista',
      'zahnarzt',
      'clinic',
      'clinica',
      'klinik',
      'optician',
      'physio',
      'gym',
      'fitness',
      'palestra',
      'gimnasio',
    ],
  ],
  [
    'travel',
    [
      'hotel',
      'hostel',
      'albergo',
      'hostal',
      'airline',
      'airlines',
      'airways',
      'airport',
      'aeroporto',
      'aeropuerto',
      'flughafen',
      'resort',
      'bnb',
    ],
  ],
  [
    'shopping',
    [
      'store',
      'shop',
      'boutique',
      'negozio',
      'tienda',
      'laden',
      'books',
      'libreria',
      'buchhandlung',
      'outlet',
      'fashion',
      'electronics',
      'hardware',
      'ferramenta',
      'florist',
      'fioraio',
    ],
  ],
  [
    'bills',
    [
      'energy',
      'electric',
      'electricity',
      'water',
      'gas',
      'broadband',
      'mobile',
      'telecom',
      'insurance',
      'assicurazioni',
      'seguros',
      'versicherung',
      'council',
      'rent',
      'affitto',
      'alquiler',
      'miete',
    ],
  ],
  [
    'entertainment',
    [
      'cinema',
      'cine',
      'kino',
      'theatre',
      'teatro',
      'theater',
      'museum',
      'museo',
      'concert',
      'tickets',
      'games',
      'bowling',
    ],
  ],
  ['income', ['salary', 'payroll', 'wages', 'stipendio', 'nomina', 'gehalt', 'refund', 'dividend']],
  ['transfers', ['transfer', 'atm', 'cash', 'withdrawal', 'bonifico', 'transferencia', 'uberweisung']],
];

const INDEX = new Map<string, CategoryId>();
for (const [cat, words] of KEYWORD_RULES) for (const w of words) INDEX.set(w, cat);

const LONG_KEYWORDS = [...INDEX.keys()].filter((k) => k.length >= 5);

export const RULE_FUZZY_THRESHOLD = 0.9;

/**
 * Whole-token keyword match first; then, for tokens of five letters or more, a typo-tolerant match
 * (Jaro–Winkler ≥ 0.9) so "pizzzeria" and "farmcia" still hit their rule.
 */
export function ruleCategory(
  tokens: readonly string[],
): { category: CategoryId; keyword: string; fuzzy: boolean } | null {
  for (const t of tokens) {
    const hit = INDEX.get(t);
    if (hit) return { category: hit, keyword: t, fuzzy: false };
  }
  let best: { keyword: string; score: number } | null = null;
  for (const t of tokens) {
    if (t.length < 5) continue;
    for (const k of LONG_KEYWORDS) {
      if (Math.abs(k.length - t.length) > 2) continue;
      const score = jaroWinkler(t, k);
      if (score >= RULE_FUZZY_THRESHOLD && (!best || score > best.score)) best = { keyword: k, score };
    }
  }
  return best ? { category: INDEX.get(best.keyword)!, keyword: best.keyword, fuzzy: true } : null;
}

import type { CategoryId } from '../data/categories';
import { MERCHANTS, type MerchantDef } from '../data/merchants';
import { jaroWinkler } from './fuzzy';
import { normalise } from './normalise';
import { ruleCategory, KEYWORD_RULES } from './rules';

export type Method = 'exact' | 'rule' | 'fuzzy' | 'none';

export interface Categorisation {
  readonly raw: string;
  readonly normalised: string;
  readonly category: CategoryId;
  /** Canonical merchant name when the knowledge base recognised it. */
  readonly merchant: string | null;
  readonly method: Method;
  /** 1 for exact/rule matches, the similarity score for fuzzy matches, 0 when unknown. */
  readonly confidence: number;
  /** A stable key used to group transactions from the same merchant (for recurring detection). */
  readonly merchantKey: string;
}

interface KbEntry {
  readonly key: string;
  readonly merchant: MerchantDef;
}

export const FUZZY_THRESHOLD = 0.9;

export class Categoriser {
  private readonly exact = new Map<string, MerchantDef>();
  private readonly entries: KbEntry[] = [];
  private readonly cache = new Map<string, Categorisation>();

  constructor(merchants: readonly MerchantDef[] = MERCHANTS) {
    for (const m of merchants) {
      for (const key of [normalise(m.name), ...(m.aliases ?? [])]) {
        if (!key || this.exact.has(key)) continue;
        this.exact.set(key, m);
        this.entries.push({ key, merchant: m });
      }
    }
  }

  get knowledgeBaseSize(): number {
    return this.entries.length;
  }

  categorise(raw: string): Categorisation {
    const cached = this.cache.get(raw);
    if (cached) return cached;
    const result = this.compute(raw);
    if (this.cache.size > 200_000) this.cache.clear();
    this.cache.set(raw, result);
    return result;
  }

  private known(raw: string, normalised: string, m: MerchantDef, method: Method, confidence: number) {
    return {
      raw,
      normalised,
      category: m.category,
      merchant: m.name,
      method,
      confidence,
      merchantKey: normalise(m.name),
    };
  }

  private compute(raw: string): Categorisation {
    const normalised = normalise(raw);
    const tokens = normalised.split(' ').filter(Boolean);
    // 1. Exact knowledge-base match on the longest leading token window ("pret a manger london" → "pret a manger").
    for (let n = tokens.length; n >= 1; n--) {
      const hit = this.exact.get(tokens.slice(0, n).join(' '));
      if (hit) return this.known(raw, normalised, hit, 'exact', 1);
    }
    // 2. Generic multilingual keyword rules for merchants we have never seen.
    const rule = ruleCategory(tokens);
    // 3. Fuzzy match (Jaro–Winkler) on leading windows, to survive typos and truncation.
    let best: { entry: KbEntry; score: number } | null = null;
    for (let n = Math.min(tokens.length, 4); n >= 1; n--) {
      const window = tokens.slice(0, n).join(' ');
      if (window.length < 4) continue;
      for (const entry of this.entries) {
        if (Math.abs(entry.key.length - window.length) > 3 && !entry.key.startsWith(window)) continue;
        // A truncated descriptor is a prefix of the full name: score it as a strong match.
        const score =
          window.length >= 6 && entry.key.startsWith(window) ? 0.97 : jaroWinkler(window, entry.key);
        if (!best || score > best.score) best = { entry, score };
      }
    }
    if (best && best.score >= FUZZY_THRESHOLD && !(rule && !rule.fuzzy && best.score < 0.95)) {
      return this.known(raw, normalised, best.entry.merchant, 'fuzzy', Number(best.score.toFixed(3)));
    }
    if (rule) {
      return {
        raw,
        normalised,
        category: rule.category,
        merchant: null,
        method: 'rule',
        confidence: 1,
        merchantKey: normalised,
      };
    }
    return {
      raw,
      normalised,
      category: 'general',
      merchant: null,
      method: 'none',
      confidence: 0,
      merchantKey: normalised,
    };
  }
}

/**
 * Naive baseline: case-insensitive substring search of the raw descriptor for any known merchant name
 * or rule keyword, first match wins. Same knowledge as the categoriser, without normalisation or fuzzy matching.
 */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w: string) => new RegExp(`(^|[^a-z0-9])${escape(w.toLowerCase())}($|[^a-z0-9])`);
const NAIVE_RULES: ReadonlyArray<readonly [RegExp, CategoryId]> = [
  ...MERCHANTS.map((m) => [wordRe(m.name), m.category] as const),
  ...KEYWORD_RULES.flatMap(([cat, words]) => words.map((w) => [wordRe(w), cat] as const)),
];

export function naiveCategorise(raw: string): CategoryId {
  const s = raw.toLowerCase();
  for (const [re, cat] of NAIVE_RULES) if (re.test(s)) return cat;
  return 'general';
}

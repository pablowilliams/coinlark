export const CATEGORY_IDS = [
  'groceries',
  'eating-out',
  'transport',
  'shopping',
  'bills',
  'entertainment',
  'travel',
  'health',
  'income',
  'transfers',
  'general',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export function isCategoryId(v: string): v is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(v);
}

/** Categories that count as spending in insights. */
export const SPENDING_CATEGORIES: readonly CategoryId[] = CATEGORY_IDS.filter(
  (c) => c !== 'income' && c !== 'transfers',
);

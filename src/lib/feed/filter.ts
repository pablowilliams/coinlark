import type { CategoryId } from '../data/categories';
import type { Transaction } from '../data/types';

export interface FeedFilter {
  readonly query: string;
  readonly category: CategoryId | 'all';
  readonly accountId: string | 'all';
  readonly direction: 'all' | 'in' | 'out';
}

export const EMPTY_FILTER: FeedFilter = { query: '', category: 'all', accountId: 'all', direction: 'all' };

export interface FeedIndex {
  readonly rows: readonly Transaction[];
  /** Pre-lower-cased search text per row, so filtering never allocates per keystroke. */
  readonly haystack: readonly string[];
}

export function buildIndex(rows: readonly Transaction[]): FeedIndex {
  return { rows, haystack: rows.map((t) => `${t.merchant} ${t.raw} ${t.category}`.toLowerCase()) };
}

/** Returns the indexes of matching rows, in feed order. All search terms must match (AND). */
export function applyFilter(index: FeedIndex, f: FeedFilter): Uint32Array {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const { rows, haystack } = index;
  const out = new Uint32Array(rows.length);
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i]!;
    if (f.category !== 'all' && t.category !== f.category) continue;
    if (f.accountId !== 'all' && t.accountId !== f.accountId) continue;
    if (f.direction === 'in' && t.amount.amount <= 0) continue;
    if (f.direction === 'out' && t.amount.amount >= 0) continue;
    if (terms.length) {
      const h = haystack[i]!;
      let ok = true;
      for (const term of terms) {
        if (!h.includes(term)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    out[n++] = i;
  }
  return out.slice(0, n);
}

/** Visible window for a fixed-height virtual list, with overscan. */
export function visibleRange(
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  count: number,
  overscan = 8,
) {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return { start, end };
}

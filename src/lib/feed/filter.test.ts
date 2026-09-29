import { enrich, generateFeed } from '../data/generate';
import { applyFilter, buildIndex, EMPTY_FILTER, visibleRange } from './filter';

const rows = enrich(generateFeed(5000, 42));
const index = buildIndex(rows);

describe('feed filter', () => {
  it('returns everything with the empty filter', () => {
    expect(applyFilter(index, EMPTY_FILTER)).toHaveLength(5000);
  });

  it('filters by search terms (AND, case-insensitive)', () => {
    const r = applyFilter(index, { ...EMPTY_FILTER, query: 'TESCO' });
    expect(r.length).toBeGreaterThan(0);
    expect([...r].every((i) => index.haystack[i]!.includes('tesco'))).toBe(true);
    const both = applyFilter(index, { ...EMPTY_FILTER, query: 'tesco groceries' });
    expect(both.length).toBeLessThanOrEqual(r.length);
    expect(applyFilter(index, { ...EMPTY_FILTER, query: 'zzzz-no-match' })).toHaveLength(0);
  });

  it('filters by category, account and direction, keeping feed order', () => {
    const r = applyFilter(index, {
      query: '',
      category: 'transport',
      accountId: 'acc-eur',
      direction: 'out',
    });
    expect(r.length).toBeGreaterThan(0);
    for (const i of r) {
      const t = rows[i]!;
      expect(t.category).toBe('transport');
      expect(t.accountId).toBe('acc-eur');
      expect(t.amount.amount).toBeLessThan(0);
    }
    expect([...r]).toEqual([...r].sort((a, b) => a - b));
    const incoming = applyFilter(index, { ...EMPTY_FILTER, direction: 'in' });
    expect([...incoming].every((i) => rows[i]!.amount.amount > 0)).toBe(true);
  });

  it('computes the visible window with overscan', () => {
    expect(visibleRange(0, 600, 60, 1000)).toEqual({ start: 0, end: 18 });
    expect(visibleRange(6000, 600, 60, 1000)).toEqual({ start: 92, end: 118 });
    expect(visibleRange(59_000, 600, 60, 1000)).toEqual({ start: 975, end: 1000 });
  });
});

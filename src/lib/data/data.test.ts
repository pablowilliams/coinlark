import { addDays, addMonths, daysBetween, fromDays, lastMonths, monthKey, toDays } from './dates';
import { enrich, generateFeed, generateHistory, merchantByName, titleCase } from './generate';
import { isCategoryId } from './categories';
import { labelledSet } from './labelled';
import { createRng } from './rng';

describe('rng', () => {
  it('is deterministic and in range', () => {
    const a = createRng(7);
    const b = createRng(7);
    const xs = Array.from({ length: 100 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b.next()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const r = createRng(1);
    for (let i = 0; i < 100; i++) {
      const n = r.int(3, 5);
      expect(n >= 3 && n <= 5).toBe(true);
    }
    expect(() => r.pick([])).toThrow(RangeError);
    expect(typeof r.normal()).toBe('number');
    expect([true, false]).toContain(r.chance(0.5));
  });
});

describe('dates (UTC)', () => {
  it('does calendar maths without time-zone drift', () => {
    expect(fromDays(toDays('2026-09-28'))).toBe('2026-09-28');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15');
    expect(addMonths('2026-02-10', 1, 31)).toBe('2026-03-31');
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
    expect(monthKey('2026-09-28')).toBe('2026-09');
    expect(lastMonths('2026-02-10', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('generators', () => {
  it('generates a deterministic history with ground truth', () => {
    const a = generateHistory({ seed: 5 });
    const b = generateHistory({ seed: 5 });
    expect(a.transactions).toEqual(b.transactions);
    expect(a.truth.length).toBeGreaterThan(3);
    expect(a.truth[0]!.merchant).toBe('Landlord Rent');
    expect(a.transactions.every((t) => Number.isSafeInteger(t.amount.amount))).toBe(true);
    expect(a.transactions[0]!.date >= a.transactions[a.transactions.length - 1]!.date).toBe(true);
  });

  it('generates a large feed quickly and categorises it', () => {
    const f = generateFeed(2000, 1);
    expect(f).toHaveLength(2000);
    expect(new Set(f.map((t) => t.id)).size).toBe(2000);
    const e = enrich(f);
    const acc = e.filter((t) => t.category === t.truth.category).length / e.length;
    expect(acc).toBeGreaterThan(0.97);
  });

  it('labelled sets contain known and unseen merchants', () => {
    const l = labelledSet(1, 500);
    expect(l.some((x) => x.known)).toBe(true);
    expect(l.some((x) => !x.known)).toBe(true);
    expect(l.every((x) => isCategoryId(x.category))).toBe(true);
  });

  it('helpers', () => {
    expect(() => merchantByName('Nope')).toThrow();
    expect(titleCase('pret a manger')).toBe('Pret A Manger');
    expect(titleCase('')).toBe('Unknown');
  });
});

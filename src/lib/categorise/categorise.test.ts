import fc from 'fast-check';
import { labelledSet } from '../data/labelled';
import { MERCHANTS } from '../data/merchants';
import { messyMerchant, HARD_NOISE, typo } from '../data/noise';
import { createRng } from '../data/rng';
import { Categoriser, naiveCategorise } from './categorise';
import { jaroWinkler } from './fuzzy';
import { normalise } from './normalise';
import { ruleCategory } from './rules';

describe('normalise', () => {
  it.each([
    ['SQ *PRET A MANGER 0342 LONDON GB', 'pret a manger'],
    ['AMZN Mktp UK*2K4L91', 'amzn mktp'],
    ['PAYPAL *NETFLIX.COM', 'netflix'],
    ["Sainsbury's S/mkt 0221", 'sainsburys s mkt'],
    ['BOOKING.COM LONDON NL', 'booking'],
    ['Café Nero MILANO IT', 'cafe nero'],
    ['H&M 0412', 'h m'],
    ['SP SPOTIFY P1B2C3', 'spotify'],
    ['   ', ''],
  ])('%s → %s', (raw, want) => {
    expect(normalise(raw)).toBe(want);
  });

  it('keeps a location word when it is the whole name', () => {
    expect(normalise('LONDON GB')).toBe('london');
  });
});

describe('jaroWinkler', () => {
  it('scores identical, disjoint and typo strings', () => {
    expect(jaroWinkler('tesco', 'tesco')).toBe(1);
    expect(jaroWinkler('', 'abc')).toBe(0);
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('netflxi', 'netflix')).toBeGreaterThan(0.9);
  });

  it('is symmetric and bounded (property)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (a, b) => {
        const s = jaroWinkler(a, b);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        expect(s).toBeCloseTo(jaroWinkler(b, a), 10);
      }),
    );
  });
});

describe('rules', () => {
  it('matches whole tokens, then tolerates typos in long keywords', () => {
    expect(ruleCategory(['trattoria', 'rossi'])).toMatchObject({ category: 'eating-out', fuzzy: false });
    expect(ruleCategory(['pizzzeria', 'marino'])).toMatchObject({ category: 'eating-out', fuzzy: true });
    expect(ruleCategory(['barber'])).toBeNull();
    expect(ruleCategory(['da', 'weber'])).toBeNull();
  });
});

describe('Categoriser', () => {
  const c = new Categoriser();

  it('recognises known merchants through processor noise', () => {
    expect(c.categorise('SQ *PRET A MANGER 0342 LONDON GB')).toMatchObject({
      merchant: 'Pret A Manger',
      category: 'eating-out',
      method: 'exact',
    });
    expect(c.categorise('AMZN Mktp UK*2K4L91')).toMatchObject({ merchant: 'Amazon', category: 'shopping' });
    expect(c.categorise('OCTOPUS ENERGY LTD DD')).toMatchObject({
      merchant: 'Octopus Energy',
      category: 'bills',
    });
  });

  it('survives typos and truncation with fuzzy matching', () => {
    expect(c.categorise('PAYPAL *NETFLXI')).toMatchObject({ merchant: 'Netflix', method: 'fuzzy' });
    expect(c.categorise('MEDIAMARK 0231')).toMatchObject({
      merchant: 'MediaMarkt',
      method: 'fuzzy',
      confidence: 0.97,
    });
  });

  it('falls back to keyword rules for unseen businesses and to general otherwise', () => {
    expect(c.categorise('FARMACIA BIANCHI ROMA')).toMatchObject({
      category: 'health',
      method: 'rule',
      merchant: null,
    });
    expect(c.categorise('Da Weber*NETARV')).toMatchObject({
      category: 'general',
      method: 'none',
      confidence: 0,
    });
  });

  it('caches by raw string and gives a stable merchant key', () => {
    const a = c.categorise('NETFLIX.COM');
    expect(c.categorise('NETFLIX.COM')).toBe(a);
    expect(c.categorise('PAYPAL *NETFLIX').merchantKey).toBe(a.merchantKey);
    expect(c.knowledgeBaseSize).toBeGreaterThan(MERCHANTS.length);
  });

  it('beats the naive keyword baseline on a held-out noisy set', () => {
    const data = labelledSet(424242, 1500);
    const ours = data.filter((e) => c.categorise(e.raw).category === e.category).length / data.length;
    const naive = data.filter((e) => naiveCategorise(e.raw) === e.category).length / data.length;
    expect(ours).toBeGreaterThan(0.95);
    expect(ours - naive).toBeGreaterThan(0.15);
  });

  it('naive baseline uses word boundaries', () => {
    expect(naiveCategorise('TESCO STORES')).toBe('groceries');
    expect(naiveCategorise('COFFEE HOUSE')).toBe('eating-out');
    expect(naiveCategorise('TSECO STORES')).toBe('general');
    expect(naiveCategorise('XYZ')).toBe('general');
  });
});

describe('noise generator', () => {
  it('is deterministic and changes strings', () => {
    const a = messyMerchant('Pret A Manger', createRng(1), HARD_NOISE);
    const b = messyMerchant('Pret A Manger', createRng(1), HARD_NOISE);
    expect(a).toBe(b);
    expect(typo('abc', createRng(1))).toBe('abc');
    expect(typo('wagamama', createRng(3))).not.toBe('wagamama');
  });
});

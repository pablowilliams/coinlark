import fc from 'fast-check';
import { CURRENCY_CODES, type CurrencyCode } from './currency';
import { divide, multiply, parseDecimal, reduce, toFixedString, toNumber } from './decimal';
import { convert, crossRate, rateTableFromEcb, totalIn, type RateTable } from './fx';
import { money } from './money';
import { FIXTURE_RATES, fetchLiveRates, SYNTHETIC_RATES } from './rates';

const table: RateTable = {
  base: 'EUR',
  date: '2026-09-28',
  source: 'test',
  rates: { EUR: '1', GBP: '0.85', USD: '1.1', CHF: '0.95', JPY: '160', KWD: '0.335' },
};

describe('decimal', () => {
  it('parses and reduces exactly', () => {
    expect(parseDecimal('1.1378')).toEqual({ num: 11378n, den: 10000n });
    expect(parseDecimal('-0.5')).toEqual({ num: -5n, den: 10n });
    expect(reduce({ num: 10n, den: -4n })).toEqual({ num: -5n, den: 2n });
    expect(divide({ num: 1n, den: 2n }, { num: 1n, den: 4n })).toEqual({ num: 2n, den: 1n });
    expect(multiply({ num: 2n, den: 3n }, { num: 3n, den: 4n })).toEqual({ num: 1n, den: 2n });
    expect(() => parseDecimal('1e5')).toThrow(SyntaxError);
    expect(() => divide({ num: 1n, den: 1n }, { num: 0n, den: 1n })).toThrow(RangeError);
    expect(() => reduce({ num: 1n, den: 0n })).toThrow(RangeError);
    expect(toNumber({ num: 1n, den: 4n })).toBe(0.25);
  });

  it('prints fixed decimals with half-even rounding', () => {
    expect(toFixedString({ num: 1n, den: 3n }, 4)).toBe('0.3333');
    expect(toFixedString({ num: 5n, den: 8n }, 2)).toBe('0.62');
    expect(toFixedString({ num: 7n, den: 8n }, 2)).toBe('0.88');
    expect(toFixedString({ num: -1n, den: 3n }, 3)).toBe('-0.333');
    expect(toFixedString({ num: 5n, den: 2n }, 0)).toBe('2');
  });
});

describe('FX conversion', () => {
  it('computes cross rates through the base', () => {
    expect(toFixedString(crossRate(table, 'GBP', 'USD'), 6)).toBe('1.294118');
    expect(crossRate(table, 'GBP', 'GBP')).toEqual({ num: 1n, den: 1n });
  });

  it('respects exponents: GBP → JPY → KWD', () => {
    // £10.00 at 160/0.85 = ¥1882.35… → ¥1882
    expect(convert(money(1000, 'GBP'), 'JPY', table).to).toEqual(money(1882, 'JPY'));
    // ¥1000 at 0.335/160 = 2.09375 KWD → 2.094 (half-even on 2093.75 fils)
    expect(convert(money(1000, 'JPY'), 'KWD', table).to).toEqual(money(2094, 'KWD'));
  });

  it('applies the spread and reports the fee', () => {
    const c = convert(money(100000, 'EUR'), 'GBP', table, { spreadBps: 50 });
    expect(c.atMid.amount).toBe(85000);
    expect(c.to.amount).toBe(84575);
    expect(c.fee.amount).toBe(425);
    expect(toFixedString(c.customerRate, 6)).toBe('0.845750');
    expect(() => convert(money(1, 'EUR'), 'GBP', table, { spreadBps: -1 })).toThrow(RangeError);
    expect(() => convert(money(1, 'EUR'), 'GBP', table, { spreadBps: 1.5 })).toThrow(RangeError);
  });

  it('uses banker’s rounding on exact ties by default', () => {
    const t: RateTable = { ...table, rates: { ...table.rates, USD: '1.5' } };
    expect(convert(money(1, 'EUR'), 'USD', t).to.amount).toBe(2); // 1.5 → 2
    expect(convert(money(3, 'EUR'), 'USD', t).to.amount).toBe(4); // 4.5 → 4
    expect(convert(money(3, 'EUR'), 'USD', t, { mode: 'half-up' }).to.amount).toBe(5);
  });

  it('is monotonic in the amount (property)', () => {
    const cur = fc.constantFrom<CurrencyCode>(...CURRENCY_CODES);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e10 }),
        fc.integer({ min: 0, max: 1e6 }),
        cur,
        cur,
        (a, d, from, to) => {
          const x = convert(money(a, from), to, FIXTURE_RATES).to.amount;
          const y = convert(money(a + d, from), to, FIXTURE_RATES).to.amount;
          expect(y).toBeGreaterThanOrEqual(x);
        },
      ),
    );
  });

  it('never gives more with a spread than at mid (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e10 }), fc.integer({ min: 0, max: 500 }), (a, bps) => {
        const c = convert(money(a, 'GBP'), 'EUR', FIXTURE_RATES, { spreadBps: bps });
        expect(c.fee.amount).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('totals mixed currencies in a base currency', () => {
    expect(totalIn([money(1000, 'EUR'), money(850, 'GBP')], 'EUR', table)).toEqual(money(2000, 'EUR'));
  });
});

describe('rate tables', () => {
  it('loads the offline ECB fixture and flags KWD as synthetic', () => {
    expect(FIXTURE_RATES.base).toBe('EUR');
    expect(FIXTURE_RATES.date).toBe('2026-09-28');
    expect(FIXTURE_RATES.rates.GBP).toBe('0.85785');
    expect(FIXTURE_RATES.rates.KWD).toBe(SYNTHETIC_RATES.KWD);
    expect(FIXTURE_RATES.synthetic).toEqual(['KWD']);
  });

  it('rejects unsupported bases and missing rates', () => {
    expect(() => rateTableFromEcb({ base: 'AUD', date: 'x', rates: {} }, 's')).toThrow();
    expect(() => rateTableFromEcb({ base: 'EUR', date: 'x', rates: { GBP: 1 } }, 's')).toThrow(
      /Missing rate/,
    );
  });

  it('falls back to the fixture when the live service fails', async () => {
    const failing = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    await expect(fetchLiveRates(failing)).resolves.toEqual({ table: FIXTURE_RATES, live: false });
    const bad = (() => Promise.resolve({ ok: false, status: 503 })) as unknown as typeof fetch;
    expect((await fetchLiveRates(bad)).live).toBe(false);
  });

  it('uses live rates when available', async () => {
    const payload = { base: 'EUR', date: '2026-09-29', rates: { GBP: 0.86, USD: 1.14, CHF: 0.95, JPY: 179 } };
    const ok = (() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })) as unknown as typeof fetch;
    const r = await fetchLiveRates(ok);
    expect(r.live).toBe(true);
    expect(r.table.rates.GBP).toBe('0.86');
    expect(r.table.date).toBe('2026-09-29');
  });
});

import { money } from '../money/money';
import {
  formatAmount,
  formatDate,
  formatMoney,
  formatMonth,
  formatNumber,
  formatPercent,
  isLocale,
  LOCALES,
  parseLocalisedAmount,
} from './format';
import { CATEGORY_LABELS, MESSAGES, translate } from './messages';

const nb = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('currency formatting per locale', () => {
  it.each([
    ['en-GB', '£1,234.56'],
    // CLDR: Italian and Spanish do not group 4-digit amounts; es-ES shows the GBP code, not £.
    ['it-IT', '1234,56 £'],
    ['es-ES', '1234,56 GBP'],
    ['de-DE', '1.234,56 £'],
  ] as const)('%s', (locale, want) => {
    expect(nb(formatMoney(money(123456, 'GBP'), locale))).toBe(want);
  });

  it('uses the currency exponent (JPY 0, KWD 3) and exact decimals', () => {
    expect(nb(formatMoney(money(48250, 'JPY'), 'en-GB'))).toBe('JP¥48,250');
    expect(nb(formatMoney(money(37125, 'KWD'), 'de-DE'))).toBe('37,125 KWD');
    expect(nb(formatMoney(money(9007199254740991, 'GBP'), 'en-GB'))).toBe('£90,071,992,547,409.91');
    expect(nb(formatAmount(-500, 'EUR', 'it-IT', { signDisplay: 'exceptZero' }))).toBe('-5,00 €');
    expect(nb(formatAmount(123456, 'EUR', 'en-GB', { whole: true }))).toBe('€1,235');
  });

  it('formats dates, months, numbers and percentages', () => {
    expect(formatDate('2026-09-28', 'en-GB')).toBe('28 Sept 2026');
    expect(formatDate('2026-09-28', 'it-IT')).toBe('28 set 2026');
    expect(formatDate('2026-09-28', 'de-DE', 'short')).toBe('28. Sept.');
    expect(formatDate('2026-09-28', 'es-ES', 'long')).toBe('lunes, 28 de septiembre de 2026');
    expect(formatMonth('2026-08', 'de-DE', 'long')).toBe('August 2026');
    expect(nb(formatNumber(100000, 'de-DE'))).toBe('100.000');
    expect(nb(formatPercent(0.125, 'it-IT', { digits: 1 }))).toBe('12,5%');
    expect(formatPercent(0.05, 'en-GB', { signed: true })).toBe('+5%');
  });

  it('parses localised input', () => {
    expect(parseLocalisedAmount('1.234,56', 'de-DE')).toBe('1234.56');
    expect(parseLocalisedAmount('1,234.56', 'en-GB')).toBe('1234.56');
    expect(parseLocalisedAmount('12,5', 'es-ES')).toBe('12.5');
    expect(parseLocalisedAmount('', 'en-GB')).toBeNull();
    expect(parseLocalisedAmount('abc', 'en-GB')).toBeNull();
    expect(isLocale('fr-FR')).toBe(false);
  });
});

describe('message catalogues', () => {
  const keys = Object.keys(MESSAGES['en-GB']).sort();
  it.each(LOCALES)('%s has every key with the same placeholders', (locale) => {
    expect(Object.keys(MESSAGES[locale]).sort()).toEqual(keys);
    for (const k of keys) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(MESSAGES[locale][k as keyof (typeof MESSAGES)['en-GB']])).toEqual(
        ph(MESSAGES['en-GB'][k as keyof (typeof MESSAGES)['en-GB']]),
      );
    }
    expect(Object.keys(CATEGORY_LABELS[locale])).toHaveLength(11);
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('it-IT', 'tx.results', { count: 3 })).toBe('3 risultati');
    expect(translate('en-GB', 'tx.results')).toBe('{count} results');
  });
});

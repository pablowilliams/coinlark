/**
 * ISO 4217 currencies supported by the engine, with their minor-unit exponents.
 * The exponent is the number of decimal places in one major unit: GBP 2 (pence), JPY 0, KWD 3 (fils).
 */
export const CURRENCIES = {
  GBP: { code: 'GBP', exponent: 2 },
  EUR: { code: 'EUR', exponent: 2 },
  USD: { code: 'USD', exponent: 2 },
  CHF: { code: 'CHF', exponent: 2 },
  JPY: { code: 'JPY', exponent: 0 },
  KWD: { code: 'KWD', exponent: 3 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function exponentOf(code: CurrencyCode): number {
  return CURRENCIES[code].exponent;
}

/** 10^exponent as a bigint, i.e. how many minor units make one major unit. */
export function minorPerMajor(code: CurrencyCode): bigint {
  return 10n ** BigInt(exponentOf(code));
}

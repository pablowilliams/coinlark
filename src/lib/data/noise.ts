import type { Rng } from './rng';

export const PROCESSOR_PREFIXES = [
  'SQ *',
  'SUMUP *',
  'PAYPAL *',
  'CRV*',
  'ZTL*',
  'IZ *',
  'SP ',
  'GOOGLE *',
  'CKO*',
];
export const CITIES = [
  'LONDON',
  'MANCHESTER',
  'LEEDS',
  'MILANO',
  'ROMA',
  'MADRID',
  'BARCELONA',
  'BERLIN',
  'MUNCHEN',
  'DUBLIN',
];
export const COUNTRIES = ['GB', 'GBR', 'IT', 'ITA', 'ES', 'ESP', 'DE', 'DEU', 'IE', 'LU', 'NL'];

const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

function ref(rng: Rng, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALNUM[rng.int(0, ALNUM.length - 1)];
  return s;
}

/** Introduce one keyboard-style typo: drop, swap or double a letter (never the first letter). */
export function typo(word: string, rng: Rng): string {
  if (word.length < 5) return word;
  const i = rng.int(1, word.length - 2);
  switch (rng.int(0, 2)) {
    case 0:
      return word.slice(0, i) + word.slice(i + 1);
    case 1:
      return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    default:
      return word.slice(0, i) + word[i] + word.slice(i);
  }
}

export interface NoiseLevel {
  /** Probability of a keyboard typo in the merchant name. */
  readonly typo: number;
  /** Probability of truncating to a 22-character terminal width. */
  readonly truncate: number;
}

export const FEED_NOISE: NoiseLevel = { typo: 0.04, truncate: 0.15 };
export const HARD_NOISE: NoiseLevel = { typo: 0.35, truncate: 0.3 };

/**
 * Turn a clean merchant name (or alias) into the kind of string a card statement shows:
 * "SQ *PRET A MANGER 0342 LONDON GB", "AMZN Mktp UK*2K4L91", "Sainsburys S/mkt".
 */
export function messyMerchant(name: string, rng: Rng, level: NoiseLevel = FEED_NOISE): string {
  let s = name.replace(/[’']/g, rng.chance(0.5) ? '' : "'");
  if (rng.chance(level.typo)) {
    const words = s.split(' ');
    const idx = words.reduce((best, w, i) => (w.length > (words[best]?.length ?? 0) ? i : best), 0);
    words[idx] = typo(words[idx] ?? '', rng);
    s = words.join(' ');
  }
  if (rng.chance(0.25)) s = rng.pick(PROCESSOR_PREFIXES) + s;
  if (rng.chance(0.35)) s += ` ${rng.int(1, 9999).toString().padStart(4, '0')}`;
  if (rng.chance(0.2)) s += `*${ref(rng, 6)}`;
  if (rng.chance(0.35)) s += ` ${rng.pick(CITIES)}`;
  if (rng.chance(0.3)) s += ` ${rng.pick(COUNTRIES)}`;
  const style = rng.int(0, 9);
  if (style < 6) s = s.toUpperCase();
  else if (style < 8) s = s.toLowerCase();
  if (rng.chance(level.truncate) && s.length > 22) s = s.slice(0, 22).trimEnd();
  return s;
}

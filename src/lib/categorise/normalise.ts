import { CITIES, COUNTRIES } from '../data/noise';

const PREFIX_RE = /^(sq|sumup|paypal|crv|ztl|iz|sp|google|cko|pp|stripe|tst|sms)\s*\*\s*/i;
const SP_PREFIX_RE = /^sp\s+/i;
const REF_RE = /\*[a-z0-9]{3,}/gi;
const DOMAIN_RE = /\b(www\.)?([a-z0-9-]+)\.(com|co\.uk|co|uk|it|es|de|eu|net|org)\b/gi;
const STOP_TOKENS = new Set([
  ...CITIES.map((c) => c.toLowerCase()),
  ...COUNTRIES.map((c) => c.toLowerCase()),
  'uk',
  'ltd',
  'plc',
  'gmbh',
  'srl',
  'spa',
  'sl',
  'sa',
  'inc',
  'help',
  'bill',
  'pos',
  'purchase',
  'card',
  'contactless',
]);

/**
 * Canonicalise a raw statement descriptor: strip payment-processor prefixes, reference codes, store numbers,
 * locations and legal suffixes, fold accents and punctuation, and collapse whitespace.
 * "SQ *PRET A MANGER 0342 LONDON GB" → "pret a manger".
 */
export function normalise(raw: string): string {
  let s = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(PREFIX_RE, '').replace(SP_PREFIX_RE, '');
  s = s.replace(REF_RE, ' ');
  s = s.replace(DOMAIN_RE, (_m, _w, host: string) => ` ${host} `);
  s = s.toLowerCase().replace(/&/g, ' ').replace(/[’'`]/g, '');
  s = s.replace(/[^a-z0-9]+/g, ' ');
  const tokens = s
    .split(' ')
    .filter((t) => t.length > 0 && !/^\d+$/.test(t) && !/^[a-z]*\d[a-z0-9]*$/.test(t));
  // Locations and legal suffixes are only noise after the first token.
  const kept = tokens.filter((t, i) => i === 0 || !STOP_TOKENS.has(t));
  return kept.join(' ').trim();
}

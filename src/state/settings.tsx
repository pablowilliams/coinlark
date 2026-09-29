import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isLocale, type Locale } from '../lib/i18n/format';
import { translate, type MessageKey } from '../lib/i18n/messages';
import { isCurrencyCode, type CurrencyCode } from '../lib/money/currency';
import type { RateTable } from '../lib/money/fx';
import { FIXTURE_RATES } from '../lib/money/rates';
import { load, save } from './storage';

export type ThemePref = 'system' | 'light' | 'dark';

interface Settings {
  locale: Locale;
  setLocale: (l: Locale) => void;
  base: CurrencyCode;
  setBase: (c: CurrencyCode) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  rates: RateTable;
  setRates: (r: RateTable) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<Settings | null>(null);

function initialLocale(): Locale {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const fromUrl = params.get('lang');
  if (fromUrl && isLocale(fromUrl)) return fromUrl;
  const stored = load('coinlark.locale');
  return stored && isLocale(stored) ? stored : 'en-GB';
}

function initialTheme(): ThemePref {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const fromUrl = params.get('theme');
  if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl;
  const stored = load('coinlark.theme');
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function systemDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [base, setBaseState] = useState<CurrencyCode>(() => {
    const s = load('coinlark.base');
    return s && isCurrencyCode(s) ? s : 'GBP';
  });
  const [theme, setThemeState] = useState<ThemePref>(initialTheme);
  const [rates, setRates] = useState<RateTable>(FIXTURE_RATES);
  const [prefersDark, setPrefersDark] = useState(systemDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setPrefersDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    save('coinlark.locale', l);
  }, []);
  const setBase = useCallback((c: CurrencyCode) => {
    setBaseState(c);
    save('coinlark.base', c);
  }, []);
  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    save('coinlark.theme', t);
  }, []);

  const value = useMemo<Settings>(
    () => ({
      locale,
      setLocale,
      base,
      setBase,
      theme,
      setTheme,
      rates,
      setRates,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale, base, setBase, theme, setTheme, rates],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSettings must be used inside <SettingsProvider>');
  return s;
}

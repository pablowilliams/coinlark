import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LOCALES, type Locale } from '../lib/i18n/format';
import { CURRENCY_CODES, type CurrencyCode } from '../lib/money/currency';
import { useSettings, type ThemePref } from '../state/settings';
import type { MessageKey } from '../lib/i18n/messages';
import { Icon, Logo, type IconName } from './Icon';

export const NAV: ReadonlyArray<{ path: string; key: MessageKey; icon: IconName }> = [
  { path: '/', key: 'nav.overview', icon: 'overview' },
  { path: '/transactions', key: 'nav.transactions', icon: 'transactions' },
  { path: '/subscriptions', key: 'nav.subscriptions', icon: 'subscriptions' },
  { path: '/split', key: 'nav.split', icon: 'split' },
  { path: '/convert', key: 'nav.convert', icon: 'convert' },
  { path: '/categorise', key: 'nav.categorise', icon: 'categorise' },
];

const LANGUAGE_NAMES: Record<Locale, string> = {
  'en-GB': 'English (UK)',
  'it-IT': 'Italiano',
  'es-ES': 'Español',
  'de-DE': 'Deutsch',
};

export function SettingsControls() {
  const { locale, setLocale, base, setBase, theme, setTheme, t } = useSettings();
  return (
    <div className="settings" data-testid="settings">
      <label className="field">
        <span>{t('settings.language')}</span>
        <select
          className="select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          data-testid="locale-select"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_NAMES[l]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('settings.base')}</span>
        <select
          className="select"
          value={base}
          onChange={(e) => setBase(e.target.value as CurrencyCode)}
          data-testid="base-select"
        >
          {CURRENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('settings.theme')}</span>
        <select
          className="select"
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemePref)}
          data-testid="theme-select"
        >
          <option value="system">{t('settings.system')}</option>
          <option value="light">{t('settings.light')}</option>
          <option value="dark">{t('settings.dark')}</option>
        </select>
      </label>
    </div>
  );
}

export function Layout({ path, children }: { path: string; children: ReactNode }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Move focus to the page on navigation (for screen-reader and keyboard users).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {t('app.skip')}
      </a>
      <header className="topbar">
        <a className="brand" href="#/" onClick={() => setOpen(false)}>
          <Logo size={28} />
          <span className="brand-name">Coinlark</span>
        </a>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-expanded={open}
          aria-controls="sidebar"
          aria-label={t('nav.menu')}
          onClick={() => setOpen((o) => !o)}
          data-testid="menu-button"
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </header>
      <div className="app">
        <aside id="sidebar" className={`sidebar${open ? ' open' : ''}`}>
          <a className="brand" href="#/">
            <Logo />
            <span className="stack">
              <span className="brand-name">Coinlark</span>
              <span className="brand-tag">{t('app.tagline')}</span>
            </span>
          </a>
          <nav aria-label={t('nav.main')}>
            <ul className="nav">
              {NAV.map((n) => (
                <li key={n.path}>
                  <a
                    href={`#${n.path}`}
                    onClick={() => setOpen(false)}
                    aria-current={path === n.path ? 'page' : undefined}
                  >
                    <Icon name={n.icon} />
                    {t(n.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="sidebar-foot">
            <SettingsControls />
            <span className="demo-badge">{t('app.demo')}</span>
          </div>
        </aside>
        <main id="main" className="main" ref={mainRef} tabIndex={-1}>
          {children}
          <p className="footer-note">{t('footer.note')}</p>
        </main>
      </div>
    </>
  );
}

export function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

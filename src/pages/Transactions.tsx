import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/Layout';
import { VirtualTable } from '../components/VirtualTable';
import { CATEGORY_IDS, isCategoryId, type CategoryId } from '../lib/data/categories';
import type { Transaction } from '../lib/data/types';
import { applyFilter, buildIndex, EMPTY_FILTER, type FeedFilter } from '../lib/feed/filter';
import { formatAmount, formatDate, formatNumber } from '../lib/i18n/format';
import { CATEGORY_LABELS } from '../lib/i18n/messages';
import { DEFAULT_FEED_SIZE, FEED_SIZES, getFeed, getPersonal } from '../state/data';
import { useSettings } from '../state/settings';

declare global {
  interface Window {
    __feedPerf?: {
      n: number;
      virtual: boolean;
      generateMs: number;
      readyAt: number;
      renderMs?: number;
      done: boolean;
    };
  }
}

const ROW_HEIGHT_DESKTOP = 60;
const ROW_HEIGHT_MOBILE = 64;

function useRowHeight(): number {
  const query = '(max-width: 640px)';
  const get = () =>
    typeof window.matchMedia === 'function' && window.matchMedia(query).matches
      ? ROW_HEIGHT_MOBILE
      : ROW_HEIGHT_DESKTOP;
  const [h, setH] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setH(mq.matches ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return h;
}

export default function Transactions({ params }: { params: URLSearchParams }) {
  const { locale, t } = useSettings();
  const requested = Number(params.get('n'));
  const [size, setSize] = useState<number>(
    Number.isInteger(requested) && requested > 0 && requested <= 200_000 ? requested : DEFAULT_FEED_SIZE,
  );
  const virtual = params.get('virtual') !== '0';
  const [loaded, setLoaded] = useState<{ key: string; rows: Transaction[] } | null>(null);
  const key = `${size}|${virtual}`;
  const rows = loaded?.key === key ? loaded.rows : null;
  const [filter, setFilter] = useState<FeedFilter>(EMPTY_FILTER);
  const deferred = useDeferredValue(filter);
  const rowHeight = useRowHeight();
  const accounts = getPersonal().accounts;

  // Generate after first paint so the page shell (and a loading state) shows immediately.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const t0 = performance.now();
      const data = getFeed(size);
      const readyAt = performance.now();
      window.__feedPerf = { n: size, virtual, generateMs: readyAt - t0, readyAt, done: false };
      setLoaded({ key: `${size}|${virtual}`, rows: data });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [size, virtual]);

  useEffect(() => {
    if (!rows || !window.__feedPerf || window.__feedPerf.done) return;
    // Rows are committed; wait for the next frame to be painted. renderMs = data ready → rows painted.
    requestAnimationFrame(() =>
      setTimeout(() => {
        const p = window.__feedPerf;
        if (p) Object.assign(p, { renderMs: performance.now() - p.readyAt, done: true });
      }, 0),
    );
  }, [rows]);

  const index = useMemo(() => (rows ? buildIndex(rows) : null), [rows]);
  const matches = useMemo(
    () => (index ? applyFilter(index, deferred) : new Uint32Array(0)),
    [index, deferred],
  );

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const methodLabel = useCallback((m: Transaction['method']) => t(`tx.method.${m}`), [t]);

  const renderRow = useCallback(
    (i: number) => {
      const tx = index!.rows[matches[i]!]!;
      const cat = CATEGORY_LABELS[locale][tx.category];
      const amount = formatAmount(tx.amount.amount, tx.amount.currency, locale, {
        signDisplay: 'exceptZero',
      });
      return (
        <>
          <span role="cell" className="cell-date num">
            {formatDate(tx.date, locale)}
          </span>
          <span role="cell" className="cell-merchant stack">
            <span className="row-title">{tx.merchant}</span>
            <span className="row-sub mono">{tx.raw}</span>
          </span>
          <span role="cell" className="cell-category stack">
            <span className="row-title">{cat}</span>
            <span className="row-sub">{methodLabel(tx.method)}</span>
          </span>
          <span role="cell" className="cell-account row-sub">
            {accountName.get(tx.accountId)}
          </span>
          <span role="cell" className={`cell-amount num${tx.amount.amount > 0 ? ' pos' : ''}`}>
            {amount}
          </span>
          <span className="cell-meta-mobile" aria-hidden="true">
            {formatDate(tx.date, locale)} · {cat} · {accountName.get(tx.accountId)}
          </span>
        </>
      );
    },
    [index, matches, locale, accountName, methodLabel],
  );

  const set = (patch: Partial<FeedFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const dirty =
    filter.query !== '' ||
    filter.category !== 'all' ||
    filter.accountId !== 'all' ||
    filter.direction !== 'all';

  return (
    <>
      <PageHead title={t('tx.title')} subtitle={t('tx.subtitle', { count: formatNumber(size, locale) })}>
        <label className="field">
          <span>{t('tx.dataset')}</span>
          <select
            className="select"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            data-testid="size-select"
          >
            {[...new Set([...FEED_SIZES, size])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {formatNumber(n, locale)}
                </option>
              ))}
          </select>
        </label>
      </PageHead>

      <div className="filters" role="search">
        <label className="field field-search">
          <span>{t('tx.search')}</span>
          <input
            id="tx-search"
            className="input"
            type="search"
            value={filter.query}
            onChange={(e) => set({ query: e.target.value })}
            autoComplete="off"
            data-testid="search"
          />
        </label>
        <label className="field">
          <span>{t('tx.category')}</span>
          <select
            className="select"
            value={filter.category}
            onChange={(e) => set({ category: isCategoryId(e.target.value) ? e.target.value : 'all' })}
            data-testid="category-filter"
          >
            <option value="all">{t('tx.all')}</option>
            {CATEGORY_IDS.map((c: CategoryId) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[locale][c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('tx.account')}</span>
          <select
            className="select"
            value={filter.accountId}
            onChange={(e) => set({ accountId: e.target.value })}
            data-testid="account-filter"
          >
            <option value="all">{t('tx.all')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>
        <label className="field field-direction">
          <span>{t('tx.direction')}</span>
          <select
            className="select"
            value={filter.direction}
            onChange={(e) => set({ direction: e.target.value as FeedFilter['direction'] })}
            data-testid="direction-filter"
          >
            <option value="all">{t('tx.all')}</option>
            <option value="in">{t('tx.in')}</option>
            <option value="out">{t('tx.out')}</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setFilter(EMPTY_FILTER)}
          disabled={!dirty}
        >
          {t('tx.clear')}
        </button>
      </div>

      <div className="feed-meta">
        <p
          role="status"
          aria-live="polite"
          data-testid="result-count"
          data-count={matches.length}
          data-query={deferred.query}
          data-category={deferred.category}
          data-ready={rows ? 'true' : 'false'}
        >
          {rows ? t('tx.results', { count: formatNumber(matches.length, locale) }) : t('tx.loading')}
        </p>
      </div>

      {rows ? (
        <VirtualTable
          label={t('tx.title')}
          columns={[
            { key: 'date', label: t('tx.date'), className: 'cell-date' },
            { key: 'merchant', label: t('tx.merchant'), className: 'cell-merchant' },
            { key: 'category', label: t('tx.category'), className: 'cell-category' },
            { key: 'account', label: t('tx.account'), className: 'cell-account' },
            { key: 'amount', label: t('tx.amount'), className: 'cell-amount' },
          ]}
          count={matches.length}
          rowHeight={rowHeight}
          renderRow={renderRow}
          virtual={virtual}
          empty={
            <div className="empty" data-testid="feed-empty">
              <p>{t('tx.empty')}</p>
              <button type="button" className="btn btn-ghost" onClick={() => setFilter(EMPTY_FILTER)}>
                {t('tx.clear')}
              </button>
            </div>
          }
        />
      ) : (
        <div className="vtable empty" aria-hidden="true" style={{ minHeight: 360 }} />
      )}
    </>
  );
}

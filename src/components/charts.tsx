import { useEffect, useId, useState } from 'react';
import type { CategoryId } from '../lib/data/categories';
import { formatAmount, formatMonth, formatPercent } from '../lib/i18n/format';
import { CATEGORY_LABELS } from '../lib/i18n/messages';
import type { CategoryTotal, MonthSpend } from '../lib/insights/insights';
import { useSettings } from '../state/settings';

/** Round an axis maximum up to a "nice" number (1, 2, 2.5, 5 × 10^k). */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function useCompact(): boolean {
  const q = '(max-width: 640px)';
  const get = () => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  const [c, setC] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(q);
    const on = () => setC(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return c;
}

/** Monthly spending bars. Accessible: the SVG has a title/description and a data table alternative. */
export function MonthlyBars({ months }: { months: readonly MonthSpend[] }) {
  const { locale, t } = useSettings();
  const titleId = useId();
  const currency = months[0]?.total.currency ?? 'GBP';
  const values = months.map((m) => m.total.amount);
  const max = niceMax(Math.max(...values, 1));
  const compact = useCompact();
  const W = compact ? 360 : 720;
  const H = compact ? 220 : 240;
  const padL = compact ? 52 : 64;
  const padB = 28;
  const padT = 12;
  const plotW = W - padL - 8;
  const plotH = H - padB - padT;
  const bw = plotW / months.length;
  const ticks = (compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => f * max);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{t('chart.monthly')}</title>
        {ticks.map((v) => {
          const y = padT + plotH - (v / max) * plotH;
          return (
            <g key={v}>
              <line className="gridline" x1={padL} x2={W - 8} y1={y} y2={y} />
              <text className="axis" x={padL - 8} y={y + 4} textAnchor="end">
                {formatAmount(v, currency, locale, { whole: true })}
              </text>
            </g>
          );
        })}
        {months.map((m, i) => {
          const h = (m.total.amount / max) * plotH;
          const x = padL + i * bw + bw * 0.18;
          return (
            <g key={m.month}>
              <rect
                className={`bar${i === months.length - 1 ? ' current' : ''}`}
                x={x}
                y={padT + plotH - h}
                width={bw * 0.64}
                height={Math.max(h, 0)}
                rx={4}
              >
                <title>{`${formatMonth(m.month, locale, 'long')}: ${formatAmount(m.total.amount, currency, locale)}`}</title>
              </rect>
              <text className="axis" x={x + bw * 0.32} y={H - 8} textAnchor="middle">
                {compact ? formatMonth(m.month, locale).slice(0, 1) : formatMonth(m.month, locale)}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="data-table">
        <summary>{t('chart.showTable')}</summary>
        <table className="simple">
          <caption className="sr-only">{t('chart.monthly')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('chart.month')}</th>
              <th scope="col" className="num">
                {t('chart.total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td>{formatMonth(m.month, locale, 'long')}</td>
                <td className="num">{formatAmount(m.total.amount, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function CategoryBars({ items }: { items: readonly CategoryTotal[] }) {
  const { locale } = useSettings();
  const top = items[0]?.amount.amount ?? 1;
  return (
    <ul className="hbar list">
      {items.slice(0, 7).map((c) => (
        <li key={c.category} className="hbar-row">
          <span className="row-title">{CATEGORY_LABELS[locale][c.category as CategoryId]}</span>
          <span className="num">
            {formatAmount(c.amount.amount, c.amount.currency, locale)}{' '}
            <span className="hint">({formatPercent(c.share, locale)})</span>
          </span>
          <span className="hbar-track" aria-hidden="true">
            <span className="hbar-fill" style={{ width: `${(c.amount.amount / top) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

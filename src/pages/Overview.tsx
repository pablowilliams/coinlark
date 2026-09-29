import { useMemo } from 'react';
import { CategoryBars, MonthlyBars } from '../components/charts';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { addDays } from '../lib/data/dates';
import { formatAmount, formatDate, formatMonth, formatPercent, formatNumber } from '../lib/i18n/format';
import { CATEGORY_LABELS } from '../lib/i18n/messages';
import {
  balancesInBase,
  budgetProgress,
  categoryTotals,
  DEFAULT_BUDGETS,
  kpis,
  spendByMonth,
  toBase,
  type Kpi,
} from '../lib/insights/insights';
import { getPersonal } from '../state/data';
import { useSettings } from '../state/settings';

function KpiTile({ kpi, previousLabel }: { kpi: Kpi; previousLabel: string }) {
  const { locale, t } = useSettings();
  const value =
    kpi.currency === null
      ? formatPercent(kpi.current, locale, { digits: 1 })
      : formatAmount(Math.round(kpi.current), kpi.currency, locale, { whole: true });
  // Spending going down is good; for the others, up is good.
  const goodWhenUp = kpi.id !== 'spent';
  let delta = null;
  if (kpi.change === 0) {
    delta = (
      <>
        <span className="delta">±0%</span>
        <span className="delta-note">{t('kpi.vsPrev', { previous: previousLabel })}</span>
      </>
    );
  } else if (kpi.change === null) {
    delta = <span className="delta-note">{t('kpi.noPrev')}</span>;
  } else {
    const up = kpi.change > 0;
    const good = up === goodWhenUp;
    const text =
      kpi.id === 'savingsRate'
        ? t('kpi.points', { value: formatNumber(kpi.change * 100, locale, 1) })
        : formatPercent(kpi.change, locale, { signed: true, digits: 1 });
    delta = (
      <>
        <span className={`delta ${good ? 'good' : 'bad'}`}>
          <Icon name={up ? 'up' : 'down'} size={14} />
          {text}
        </span>
        <span className="delta-note">{t('kpi.vsPrev', { previous: previousLabel })}</span>
      </>
    );
  }
  return (
    <section className="card" aria-label={t(`kpi.${kpi.id}`)} data-testid={`kpi-${kpi.id}`}>
      <h2 className="kpi-label">{t(`kpi.${kpi.id}`)}</h2>
      <p className="kpi-value">{value}</p>
      <div>{delta}</div>
    </section>
  );
}

export function Overview() {
  const { locale, base, rates, t } = useSettings();
  const data = getPersonal();
  const model = useMemo(() => {
    // 12 complete months: the current month is still in progress, so it is left out.
    const months = spendByMonth(data.enriched, base, rates, data.end, 13).slice(0, -1);
    const k = kpis(data.enriched, base, rates, data.end);
    const reportMonth = months[months.length - 1]!;
    return {
      months,
      k,
      categories: categoryTotals(reportMonth),
      budgets: budgetProgress(reportMonth, DEFAULT_BUDGETS, rates),
      balances: balancesInBase(data.accounts, base, rates),
    };
  }, [data, base, rates]);

  const monthLabel = formatMonth(model.k.month, locale, 'long');
  const prevLabel = formatMonth(model.k.previousMonth, locale, 'long');
  const soon = data.recurring.filter((r) => r.active && r.nextDue <= addDays(data.end, 14));

  return (
    <>
      <PageHead
        title={t('overview.title')}
        subtitle={t('overview.subtitle', { month: monthLabel, previous: prevLabel, base })}
      />
      <div className="grid grid-kpi">
        {model.k.tiles.map((kpi) => (
          <KpiTile key={kpi.id} kpi={kpi} previousLabel={formatMonth(model.k.previousMonth, locale)} />
        ))}
      </div>

      <div className="grid grid-2 mt">
        <section className="card" aria-labelledby="monthly-h">
          <div className="card-head">
            <h2 id="monthly-h">{t('chart.monthly')}</h2>
            <p>{t('chart.monthlyDesc', { base })}</p>
          </div>
          <MonthlyBars months={model.months} />
        </section>
        <section className="card" aria-labelledby="bal-h" data-testid="balances">
          <div className="card-head">
            <h2 id="bal-h">{t('balances.title')}</h2>
          </div>
          <ul className="list">
            {model.balances.lines.map(({ account, inBase }) => (
              <li key={account.id}>
                <span className="row-main">
                  <span className="avatar" aria-hidden="true">
                    {account.currency}
                  </span>
                  <span className="stack">
                    <span className="row-title">{account.name}</span>
                    <span className="row-sub">
                      {formatAmount(account.balance.amount, account.currency, locale)}
                    </span>
                  </span>
                </span>
                <span className="num">{formatAmount(inBase.amount, base, locale)}</span>
              </li>
            ))}
          </ul>
          <div className="total-line">
            <span>{t('balances.total', { base })}</span>
            <span className="num" data-testid="balance-total">
              {formatAmount(model.balances.total.amount, base, locale)}
            </span>
          </div>
          <p className="fine">
            {t('balances.rates', { source: rates.source, date: formatDate(rates.date, locale) })}
            {rates.synthetic?.length
              ? ` · ${t('balances.synthetic', { codes: rates.synthetic.join(', ') })}`
              : ''}
          </p>
        </section>
      </div>

      <div className="grid grid-2-even mt">
        <section className="card" aria-labelledby="cat-h">
          <div className="card-head">
            <h2 id="cat-h">{t('chart.categories', { month: monthLabel })}</h2>
          </div>
          <CategoryBars items={model.categories} />
        </section>
        <section className="card" aria-labelledby="bud-h" data-testid="budgets">
          <div className="card-head">
            <h2 id="bud-h">{t('budgets.title', { month: monthLabel })}</h2>
          </div>
          <ul className="hbar list">
            {model.budgets.map((b) => {
              const pct = Math.min(b.ratio, 1) * 100;
              const left = b.limit.amount - b.spent.amount;
              return (
                <li key={b.category} className="hbar-row">
                  <span className="row-title">{CATEGORY_LABELS[locale][b.category]}</span>
                  <span className="num">
                    {t('budgets.of', {
                      spent: formatAmount(b.spent.amount, base, locale, { whole: true }),
                      limit: formatAmount(b.limit.amount, base, locale, { whole: true }),
                    })}
                  </span>
                  <span
                    className="hbar-track"
                    role="progressbar"
                    aria-label={CATEGORY_LABELS[locale][b.category]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(b.ratio * 100)}
                    aria-valuetext={formatPercent(b.ratio, locale)}
                  >
                    <span className={`hbar-fill ${b.status}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={`budget-status${b.status === 'over' ? ' over' : ''}`}>
                    {left < 0
                      ? t('budgets.over', { amount: formatAmount(-left, base, locale) })
                      : t('budgets.left', { amount: formatAmount(left, base, locale) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card mt" aria-labelledby="up-h">
        <div className="card-head">
          <h2 id="up-h">{t('upcoming.title')}</h2>
          <a href="#/subscriptions">{t('nav.subscriptions')}</a>
        </div>
        {soon.length === 0 ? (
          <p className="hint">{t('upcoming.none')}</p>
        ) : (
          <ul className="list">
            {soon.map((r) => (
              <li key={`${r.merchantKey}-${r.cadence}`}>
                <span className="row-main">
                  <span className="avatar" aria-hidden="true">
                    <Icon name="calendar" size={16} />
                  </span>
                  <span className="stack">
                    <span className="row-title">{r.merchant}</span>
                    <span className="row-sub">
                      {t(`cadence.${r.cadence}`)} · {formatDate(r.nextDue, locale)}
                    </span>
                  </span>
                </span>
                <span className="num">{formatAmount(toBase(r.amount, base, rates), base, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

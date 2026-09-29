import { PageHead } from '../components/Layout';
import { formatAmount, formatDate, formatNumber, formatPercent } from '../lib/i18n/format';
import { toBase } from '../lib/insights/insights';
import type { RecurringSeries } from '../lib/recurring/detect';
import { getPersonal } from '../state/data';
import { useSettings } from '../state/settings';

function SubscriptionRow({ r }: { r: RecurringSeries }) {
  const { locale, t } = useSettings();
  return (
    <li data-testid="subscription">
      <span className="row-main">
        <span className="avatar" aria-hidden="true">
          {r.merchant.slice(0, 2).toUpperCase()}
        </span>
        <span className="stack">
          <span className="row-title">
            {r.merchant} {r.priceChanged ? <span className="chip warn">{t('subs.priceChanged')}</span> : null}
          </span>
          <span className="row-sub">
            {t(`cadence.${r.cadence}`)} ·{' '}
            {r.active
              ? `${t('subs.next')}: ${formatDate(r.nextDue, locale)}`
              : t('subs.lastCharged', { date: formatDate(r.last, locale) })}
          </span>
          <span className="row-sub">
            {t('subs.charges', { count: formatNumber(r.count, locale), date: formatDate(r.first, locale) })} ·{' '}
            {t('subs.confidence')} {formatPercent(r.confidence, locale)}
          </span>
        </span>
      </span>
      <span className="stack align-end">
        <span className="num row-title">{formatAmount(r.amount.amount, r.amount.currency, locale)}</span>
        <span className={`chip ${r.active ? 'accent' : 'muted'}`}>
          {r.active ? t('subs.active') : t('subs.inactive')}
        </span>
      </span>
    </li>
  );
}

export default function Subscriptions() {
  const { locale, base, rates, t } = useSettings();
  const { recurring } = getPersonal();
  const active = recurring.filter((r) => r.active);
  const stopped = recurring.filter((r) => !r.active);
  const monthlyTotal = active.reduce((a, r) => a + toBase(r.monthly, base, rates), 0);

  return (
    <>
      <PageHead title={t('subs.title')} subtitle={t('subs.subtitle')} />
      <div className="grid grid-2">
        <section className="card" aria-labelledby="subs-active">
          <div className="card-head">
            <h2 id="subs-active">
              {t('subs.active')} ({active.length})
            </h2>
          </div>
          {active.length === 0 ? (
            <p className="hint">{t('subs.empty')}</p>
          ) : (
            <ul className="list">
              {active.map((r) => (
                <SubscriptionRow key={`${r.merchantKey}-${r.cadence}`} r={r} />
              ))}
            </ul>
          )}
        </section>
        <div className="grid align-start">
          <section className="card" aria-labelledby="subs-total">
            <h2 id="subs-total" className="kpi-label">
              {t('subs.monthlyTotal')}
            </h2>
            <p className="kpi-value" data-testid="subs-total">
              {formatAmount(monthlyTotal, base, locale)}
            </p>
            <p className="hint">
              {t('subs.totalNote', { count: formatNumber(active.length, locale), base })}
            </p>
          </section>
          <section className="card" aria-labelledby="subs-stopped">
            <div className="card-head">
              <h2 id="subs-stopped">
                {t('subs.inactive')} ({stopped.length})
              </h2>
            </div>
            {stopped.length === 0 ? (
              <p className="hint">{t('subs.empty')}</p>
            ) : (
              <ul className="list">
                {stopped.map((r) => (
                  <SubscriptionRow key={`${r.merchantKey}-${r.cadence}`} r={r} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

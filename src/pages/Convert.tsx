import { useId, useMemo, useState } from 'react';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { formatAmount, formatDate, formatMoney, parseLocalisedAmount } from '../lib/i18n/format';
import { CURRENCY_CODES, exponentOf, type CurrencyCode } from '../lib/money/currency';
import { toFixedString } from '../lib/money/decimal';
import { convert } from '../lib/money/fx';
import { allocate, fromMajor, money, type Money } from '../lib/money/money';
import { naiveAllocate } from '../lib/money/naive';
import { fetchLiveRates } from '../lib/money/rates';
import { useSettings } from '../state/settings';

const SPREADS = [0, 50, 100, 200] as const;

export default function Convert() {
  const { locale, rates, setRates, t } = useSettings();
  const [input, setInput] = useState('1000');
  const [from, setFrom] = useState<CurrencyCode>('GBP');
  const [to, setTo] = useState<CurrencyCode>('EUR');
  const [spread, setSpread] = useState<number>(50);
  const [live, setLive] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [people, setPeople] = useState(3);
  const ids = { amount: useId(), err: useId() };

  const parsed = parseLocalisedAmount(input, locale);
  let amount: Money | null = null;
  try {
    amount = parsed ? fromMajor(parsed, from) : null;
  } catch {
    amount = null;
  }
  const result = useMemo(
    () => (amount ? convert(amount, to, rates, { spreadBps: spread }) : null),
    [amount, to, rates, spread],
  );
  const example = formatMoney(money(123456 * 10 ** Math.max(0, exponentOf(from) - 2), from), locale)
    .replace(/[^\d.,\s\u00a0\u202f]/g, '')
    .trim();

  const splitDemo = useMemo(() => {
    const total = amount && amount.amount > 0 ? amount : money(10000, from);
    const weights = Array.from({ length: people }, () => 1);
    const exact = allocate(total, weights);
    const exp = exponentOf(total.currency);
    const floats = naiveAllocate(total.amount / 10 ** exp, weights, exp).map((x) =>
      Math.round(x * 10 ** exp),
    );
    const floatSum = floats.reduce((a, b) => a + b, 0);
    return { total, exact, floats, floatSum };
  }, [amount, from, people]);

  const refresh = async () => {
    setLive('loading');
    const r = await fetchLiveRates();
    if (r.live) setRates(r.table);
    setLive(r.live ? 'ok' : 'fail');
  };

  return (
    <>
      <PageHead title={t('convert.title')} subtitle={t('convert.subtitle')} />
      <div className="grid grid-2">
        <section className="card" aria-labelledby="conv-h">
          <h2 id="conv-h" className="sr-only">
            {t('convert.title')}
          </h2>
          <div className="convert-grid">
            <div className="field field-amount">
              <label htmlFor={ids.amount} className="field-label">
                {t('convert.amount')} ({from})
              </label>
              <input
                id={ids.amount}
                className="input"
                inputMode="decimal"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-invalid={!amount}
                aria-describedby={!amount ? ids.err : undefined}
                autoComplete="off"
                data-testid="convert-amount"
              />
            </div>
            <label className="field">
              <span>{t('convert.from')}</span>
              <select
                className="select"
                value={from}
                onChange={(e) => setFrom(e.target.value as CurrencyCode)}
                data-testid="convert-from"
              >
                {CURRENCY_CODES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label={t('convert.swap')}
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
            >
              <Icon name="swap" />
            </button>
            <label className="field">
              <span>{t('convert.to')}</span>
              <select
                className="select"
                value={to}
                onChange={(e) => setTo(e.target.value as CurrencyCode)}
                data-testid="convert-to"
              >
                {CURRENCY_CODES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <div className="field field-spread">
              <span className="field-label" id="spread-label">
                {t('convert.spread')}
              </span>
              <div className="segmented" role="group" aria-labelledby="spread-label">
                {SPREADS.map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    aria-pressed={spread === bps}
                    onClick={() => setSpread(bps)}
                  >
                    {(bps / 100).toLocaleString(locale)}%
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!amount ? (
            <p id={ids.err} className="error-text mt" role="alert">
              {t('convert.invalid', { example })}
            </p>
          ) : null}
          {result ? (
            <div className="mt" aria-live="polite">
              <p className="kpi-label">{t('convert.youGet')}</p>
              <p className="big-result" data-testid="convert-result">
                {formatMoney(result.to, locale)}
              </p>
              <dl className="kv">
                <dt>{t('convert.midRate')}</dt>
                <dd className="mono">
                  1 {from} = {toFixedString(result.midRate, 6)} {to}
                </dd>
                <dt>{t('convert.yourRate')}</dt>
                <dd className="mono">
                  1 {from} = {toFixedString(result.customerRate, 6)} {to}
                </dd>
                <dt>{t('convert.fee')}</dt>
                <dd data-testid="convert-fee">{formatMoney(result.fee, locale)}</dd>
              </dl>
            </div>
          ) : null}
          <div className="mt inline-form">
            <button type="button" className="btn btn-ghost" onClick={refresh} disabled={live === 'loading'}>
              <Icon name="refresh" size={16} />
              {t('convert.live')}
            </button>
          </div>
          <p className="fine" role="status">
            {live === 'ok'
              ? t('convert.liveOk', { date: formatDate(rates.date, locale) })
              : live === 'fail'
                ? t('convert.liveFail')
                : `${t('balances.rates', { source: rates.source, date: formatDate(rates.date, locale) })}${
                    rates.synthetic?.length
                      ? ` · ${t('balances.synthetic', { codes: rates.synthetic.join(', ') })}`
                      : ''
                  }`}
          </p>
        </section>

        <section className="card" aria-labelledby="split-h" data-testid="split-demo">
          <div className="card-head">
            <h2 id="split-h">{t('convert.split')}</h2>
          </div>
          <p className="hint">
            {t('convert.splitDesc', { amount: formatMoney(splitDemo.total, locale), n: people })}
          </p>
          <label className="field mt">
            <span>{t('convert.people')}</span>
            <select className="select" value={people} onChange={(e) => setPeople(Number(e.target.value))}>
              {[2, 3, 6, 7, 9].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="table-wrap mt">
            <table className="simple">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" className="num">
                    {t('convert.engine')}
                  </th>
                  <th scope="col" className="num">
                    {t('convert.float')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {splitDemo.exact.map((m, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="num">{formatMoney(m, locale)}</td>
                    <td className="num">{formatAmount(splitDemo.floats[i]!, m.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t('convert.sum')}</th>
                  <td className="num" data-testid="engine-sum">
                    <strong>{formatMoney(splitDemo.total, locale)}</strong>{' '}
                    <span className="chip accent sum-chip">{t('convert.exact')}</span>
                  </td>
                  <td className="num" data-testid="float-sum">
                    <strong>{formatAmount(splitDemo.floatSum, splitDemo.total.currency, locale)}</strong>{' '}
                    {splitDemo.floatSum !== splitDemo.total.amount ? (
                      <span className="chip warn sum-chip">
                        {t('convert.lost', {
                          amount: formatAmount(
                            Math.abs(splitDemo.total.amount - splitDemo.floatSum),
                            splitDemo.total.currency,
                            locale,
                          ),
                        })}
                      </span>
                    ) : (
                      <span className="chip accent sum-chip">{t('convert.exact')}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

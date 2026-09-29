import { useId, useMemo, useState } from 'react';
import { PageHead } from '../components/Layout';
import { Categoriser, naiveCategorise } from '../lib/categorise/categorise';
import { formatPercent } from '../lib/i18n/format';
import { CATEGORY_LABELS } from '../lib/i18n/messages';
import { useSettings } from '../state/settings';

const EXAMPLES = [
  'SQ *PRET A MANGER 0342 LONDON GB',
  'AMZN Mktp UK*2K4L91',
  'PAYPAL *NETFLX.COM',
  'Sainsburys S/mkt 0221',
  'CRV*TRATTORIA DA ROSSI MILANO',
  'PIZZZERIA MARINO DUBLIN',
  'OCTOPUS ENERGY LTD DD',
  'Da Weber*NETARV',
];

const categoriser = new Categoriser();

export default function Categorise() {
  const { locale, t } = useSettings();
  const [raw, setRaw] = useState(EXAMPLES[0]!);
  const id = useId();
  const result = useMemo(() => categoriser.categorise(raw), [raw]);
  const naive = useMemo(() => naiveCategorise(raw), [raw]);
  const label = (c: keyof (typeof CATEGORY_LABELS)['en-GB']) => CATEGORY_LABELS[locale][c];

  return (
    <>
      <PageHead title={t('cat.title')} subtitle={t('cat.subtitle')} />
      <div className="grid grid-2">
        <section className="card" aria-labelledby="cat-in">
          <h2 id="cat-in" className="sr-only">
            {t('cat.input')}
          </h2>
          <div className="field">
            <label htmlFor={id} className="field-label">
              {t('cat.input')}
            </label>
            <input
              id={id}
              className="input mono"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              data-testid="cat-input"
            />
          </div>
          <p className="field-label mt" id="examples-label">
            {t('cat.try')}
          </p>
          <div className="examples" role="group" aria-labelledby="examples-label">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => setRaw(e)}>
                {e}
              </button>
            ))}
          </div>
        </section>
        <section className="card" aria-labelledby="cat-out" aria-live="polite">
          <h2 id="cat-out" className="card-head">
            {t('cat.result')}
          </h2>
          <ol className="pipeline" data-testid="cat-pipeline">
            <li>
              <span className="k">{t('cat.normalised')}</span>
              <span className="mono" data-testid="cat-normalised">
                {result.normalised || '—'}
              </span>
            </li>
            <li>
              <span className="k">{t('cat.merchant')}</span>
              <span>{result.merchant ?? t('cat.unknown')}</span>
            </li>
            <li>
              <span className="k">{t('cat.method')}</span>
              <span>{t(`tx.method.${result.method === 'exact' ? 'exact' : result.method}`)}</span>
            </li>
            <li>
              <span className="k">{t('cat.confidence')}</span>
              <span>{formatPercent(result.confidence, locale, { digits: 1 })}</span>
            </li>
            <li>
              <span className="k">{t('cat.result')}</span>
              <strong data-testid="cat-category">{label(result.category)}</strong>
            </li>
          </ol>
          <p className="fine">
            {t('cat.baseline')}: <strong data-testid="cat-naive">{label(naive)}</strong>
          </p>
        </section>
      </div>
    </>
  );
}

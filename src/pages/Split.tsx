import { useId, useMemo, useState, type FormEvent } from 'react';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { formatAmount, formatNumber, parseLocalisedAmount } from '../lib/i18n/format';
import { fromMajor, money } from '../lib/money/money';
import { balances, optimalTransfers, pairwiseTransfers, type Expense } from '../lib/settle/settle';
import { useSettings } from '../state/settings';

const CURRENCY = 'EUR' as const;

export const EXAMPLE_MEMBERS = ['Ana', 'Ben', 'Chiara', 'Dieter', 'Elif'];
export const EXAMPLE_EXPENSES: Expense[] = [
  {
    id: 'x1',
    description: 'Apartment, 3 nights',
    paidBy: 'Ana',
    amount: money(64250, CURRENCY),
    splitBetween: EXAMPLE_MEMBERS,
  },
  {
    id: 'x2',
    description: 'Dinner in Alfama',
    paidBy: 'Ben',
    amount: money(18740, CURRENCY),
    splitBetween: EXAMPLE_MEMBERS,
  },
  {
    id: 'x3',
    description: 'Train to Sintra',
    paidBy: 'Chiara',
    amount: money(4800, CURRENCY),
    splitBetween: ['Ana', 'Ben', 'Chiara', 'Dieter'],
  },
  {
    id: 'x4',
    description: 'Pastéis de nata',
    paidBy: 'Dieter',
    amount: money(1310, CURRENCY),
    splitBetween: EXAMPLE_MEMBERS,
  },
  {
    id: 'x5',
    description: 'Tuk-tuk tour',
    paidBy: 'Elif',
    amount: money(9000, CURRENCY),
    splitBetween: ['Chiara', 'Dieter', 'Elif'],
  },
  {
    id: 'x6',
    description: 'Groceries',
    paidBy: 'Ben',
    amount: money(5633, CURRENCY),
    splitBetween: EXAMPLE_MEMBERS,
  },
  {
    id: 'x7',
    description: 'Museum tickets',
    paidBy: 'Ana',
    amount: money(7500, CURRENCY),
    splitBetween: ['Ana', 'Ben', 'Elif'],
  },
];

export default function Split() {
  const { locale, t } = useSettings();
  const [members, setMembers] = useState<string[]>(EXAMPLE_MEMBERS);
  const [expenses, setExpenses] = useState<Expense[]>(EXAMPLE_EXPENSES);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(EXAMPLE_MEMBERS[0]!);
  const [between, setBetween] = useState<string[]>(EXAMPLE_MEMBERS);
  const [errors, setErrors] = useState<{ amount?: boolean; between?: boolean }>({});
  const ids = { name: useId(), amount: useId(), between: useId(), desc: useId() };

  const net = useMemo(() => balances(members, expenses, CURRENCY), [members, expenses]);
  const plan = useMemo(() => optimalTransfers(net, CURRENCY), [net]);
  const naive = useMemo(() => pairwiseTransfers(expenses, CURRENCY), [expenses]);
  const check = [...net.values()].reduce((a, b) => a + b, 0);
  const fmt = (minor: number) => formatAmount(minor, CURRENCY, locale);

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || members.includes(n)) {
      setNameError(true);
      return;
    }
    setMembers([...members, n]);
    setBetween([...between, n]);
    setName('');
    setNameError(false);
  };

  const removeMember = (m: string) => {
    // Removing someone drops the expenses they paid and takes them out of every split.
    setMembers(members.filter((x) => x !== m));
    setExpenses(
      expenses
        .filter((e) => e.paidBy !== m)
        .map((e) => ({ ...e, splitBetween: e.splitBetween.filter((x) => x !== m) }))
        .filter((e) => e.splitBetween.length > 0),
    );
    setBetween(between.filter((x) => x !== m));
    if (paidBy === m) setPaidBy(members.find((x) => x !== m) ?? '');
  };

  const addExpense = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseLocalisedAmount(amount, locale);
    let value = 0;
    try {
      value = parsed ? fromMajor(parsed, CURRENCY).amount : 0;
    } catch {
      value = 0;
    }
    const errs = { amount: value <= 0, between: between.length === 0 };
    setErrors(errs);
    if (errs.amount || errs.between || !paidBy) return;
    setExpenses([
      ...expenses,
      {
        id: `u${Date.now()}`,
        description: desc.trim() || t('split.expenses'),
        paidBy,
        amount: money(value, CURRENCY),
        splitBetween: members.filter((m) => between.includes(m)),
      },
    ]);
    setDesc('');
    setAmount('');
  };

  const reset = () => {
    setMembers(EXAMPLE_MEMBERS);
    setExpenses(EXAMPLE_EXPENSES);
    setBetween(EXAMPLE_MEMBERS);
    setPaidBy(EXAMPLE_MEMBERS[0]!);
    setErrors({});
  };

  return (
    <>
      <PageHead title={t('split.title')} subtitle={t('split.subtitle')}>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          <Icon name="refresh" size={16} />
          {t('split.reset')}
        </button>
      </PageHead>
      <div className="grid grid-2">
        <div className="grid align-start">
          <section className="card" aria-labelledby="members-h">
            <h2 id="members-h" className="card-head">
              {t('split.members')}
            </h2>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m} className="member-pill">
                  {m}
                  <button
                    type="button"
                    onClick={() => removeMember(m)}
                    aria-label={t('split.remove', { name: m })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <form className="inline-form" onSubmit={addMember} noValidate>
              <div className="field">
                <label htmlFor={ids.name} className="field-label">
                  {t('split.memberName')}
                </label>
                <input
                  id={ids.name}
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={nameError}
                  aria-describedby={nameError ? `${ids.name}-err` : undefined}
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn btn-ghost">
                {t('split.addMember')}
              </button>
              {nameError ? (
                <p id={`${ids.name}-err`} className="error-text" role="alert">
                  {t('split.invalidName')}
                </p>
              ) : null}
            </form>
          </section>

          <section className="card" aria-labelledby="exp-h">
            <h2 id="exp-h" className="card-head">
              {t('split.expenses')}
            </h2>
            <ul className="list" data-testid="expenses">
              {expenses.map((e) => (
                <li key={e.id}>
                  <span className="stack">
                    <span className="row-title">{e.description}</span>
                    <span className="row-sub">
                      {t('split.paidBy')} {e.paidBy} · {e.splitBetween.join(', ')}
                    </span>
                  </span>
                  <span className="num">{fmt(e.amount.amount)}</span>
                </li>
              ))}
            </ul>
            <form onSubmit={addExpense} noValidate className="mt" data-testid="expense-form">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={ids.desc} className="field-label">
                    {t('split.description')}
                  </label>
                  <input
                    id={ids.desc}
                    className="input"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label htmlFor={ids.amount} className="field-label">
                    {t('split.amount')} (EUR)
                  </label>
                  <input
                    id={ids.amount}
                    className="input"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-invalid={errors.amount ?? false}
                    aria-describedby={errors.amount ? `${ids.amount}-err` : undefined}
                    autoComplete="off"
                  />
                </div>
                <label className="field">
                  <span>{t('split.paidBy')}</span>
                  <select className="select" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                    {members.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
              {errors.amount ? (
                <p id={`${ids.amount}-err`} className="error-text" role="alert">
                  {t('split.invalidAmount')}
                </p>
              ) : null}
              <fieldset aria-describedby={errors.between ? `${ids.between}-err` : undefined}>
                <legend>{t('split.between')}</legend>
                <div className="checks">
                  {members.map((m) => (
                    <label key={m}>
                      <input
                        type="checkbox"
                        checked={between.includes(m)}
                        onChange={(e) =>
                          setBetween(e.target.checked ? [...between, m] : between.filter((x) => x !== m))
                        }
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </fieldset>
              {errors.between ? (
                <p id={`${ids.between}-err`} className="error-text" role="alert">
                  {t('split.pickSomeone')}
                </p>
              ) : null}
              <button type="submit" className="btn">
                {t('split.addExpense')}
              </button>
            </form>
          </section>
        </div>

        <div className="grid align-start">
          <section className="card" aria-labelledby="bal2-h" data-testid="split-balances">
            <h2 id="bal2-h" className="card-head">
              {t('split.balances')}
            </h2>
            <ul className="list">
              {members.map((m) => {
                const v = net.get(m) ?? 0;
                return (
                  <li key={m}>
                    <span className="row-main">
                      <span className="avatar" aria-hidden="true">
                        {m.slice(0, 2)}
                      </span>
                      <span className="row-title">{m}</span>
                    </span>
                    <span className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>
                      {v > 0
                        ? t('split.owed', { amount: fmt(v) })
                        : v < 0
                          ? t('split.owes', { amount: fmt(-v) })
                          : t('split.settled')}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="fine" data-testid="split-check">
              {t('split.check', { amount: fmt(check) })}
            </p>
          </section>

          <section className="card" aria-labelledby="plan-h" data-testid="settle-plan">
            <div className="card-head">
              <h2 id="plan-h">{t('split.plan')}</h2>
              <span className="chip accent" data-testid="plan-count">
                {t('split.transfers', { count: formatNumber(plan.length, locale) })}
              </span>
            </div>
            {plan.length === 0 ? (
              <p className="hint">{t('split.allSettled')}</p>
            ) : (
              <ol className="list">
                {plan.map((p) => (
                  <li key={`${p.from}-${p.to}`}>
                    <span className="transfer">
                      <strong>{p.from}</strong>
                      <span className="arrow">
                        <span className="sr-only">{t('split.pays')}</span>
                        <Icon name="arrow" size={16} />
                      </span>
                      <strong>{p.to}</strong>
                    </span>
                    <span className="num">{fmt(p.amount.amount)}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="compare">
              <div className="stat">
                <p className="kpi-label">{t('split.optimalLabel')}</p>
                <p className="stat-value">{formatNumber(plan.length, locale)}</p>
              </div>
              <div className="stat">
                <p className="kpi-label">{t('split.pairwiseLabel')}</p>
                <p className="stat-value" data-testid="naive-count">
                  {formatNumber(naive.length, locale)}
                </p>
              </div>
            </div>
            <p className="fine">{t('split.naive', { count: formatNumber(naive.length, locale) })}</p>
          </section>
        </div>
      </div>
    </>
  );
}

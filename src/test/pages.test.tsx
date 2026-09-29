import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { App } from '../App';
import { Overview } from '../pages/Overview';
import Split from '../pages/Split';
import Convert from '../pages/Convert';
import Categorise from '../pages/Categorise';
import Subscriptions from '../pages/Subscriptions';
import Transactions from '../pages/Transactions';
import { SettingsProvider } from '../state/settings';

const wrap = (ui: ReactNode) => render(<SettingsProvider>{ui}</SettingsProvider>);

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});

describe('Overview', () => {
  it('shows KPI tiles, balances and budgets without NaN', () => {
    wrap(<Overview />);
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    for (const id of ['spent', 'income', 'net', 'savingsRate'])
      expect(screen.getByTestId(`kpi-${id}`)).toBeInTheDocument();
    expect(screen.getByTestId('balance-total').textContent).toMatch(/^£[\d,]+\.\d\d$/);
    expect(screen.getAllByRole('progressbar').length).toBe(5);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('re-renders in another language and base currency', async () => {
    const user = userEvent.setup();
    wrap(<App />);
    await user.selectOptions(screen.getByTestId('locale-select'), 'de-DE');
    await user.selectOptions(screen.getByTestId('base-select'), 'EUR');
    expect(screen.getByRole('heading', { level: 1, name: 'Übersicht' })).toBeInTheDocument();
    expect(screen.getByTestId('balance-total').textContent).toMatch(/€$/);
    expect(document.documentElement.lang).toBe('de-DE');
    expect(window.localStorage.getItem('coinlark.locale')).toBe('de-DE');
  });

  it('switches theme', async () => {
    const user = userEvent.setup();
    wrap(<App />);
    await user.selectOptions(screen.getByTestId('theme-select'), 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.selectOptions(screen.getByTestId('theme-select'), 'light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('Split', () => {
  it('settles the example trip with fewer transfers than pairwise and balances to zero', () => {
    wrap(<Split />);
    const plan = Number(screen.getByTestId('plan-count').textContent!.match(/\d+/)![0]);
    const naive = Number(screen.getByTestId('naive-count').textContent);
    expect(plan).toBeLessThan(naive);
    expect(screen.getByTestId('split-check').textContent).toContain('€0.00');
  });

  it('validates and adds an expense and a person', async () => {
    const user = userEvent.setup();
    wrap(<Split />);
    const form = screen.getByTestId('expense-form');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText('Enter an amount greater than zero.')).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Description'), 'Taxi');
    await user.type(within(form).getByLabelText('Amount (EUR)'), '33.33');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText('Taxi')).toBeInTheDocument();
    expect(screen.getByTestId('split-check').textContent).toContain('€0.00');

    await user.type(screen.getByLabelText('Name'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(screen.getByRole('alert')).toHaveTextContent('not already in the group');
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Femi');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(screen.getByRole('button', { name: 'Remove Femi' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Ana' }));
    expect(screen.queryByRole('button', { name: 'Remove Ana' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reset example/ }));
    expect(screen.getByRole('button', { name: 'Remove Ana' })).toBeInTheDocument();
  });
});

describe('Convert', () => {
  it('converts with a spread and shows the lost penny for floats', async () => {
    const user = userEvent.setup();
    wrap(<Convert />);
    expect(screen.getByTestId('convert-result').textContent).toBe('€1,159.88');
    expect(screen.getByTestId('convert-fee').textContent).toBe('€5.82');
    expect(screen.getByTestId('float-sum').textContent).toContain('lost');
    await user.click(screen.getByRole('button', { name: '0%' }));
    expect(screen.getByTestId('convert-result').textContent).toBe('€1,165.70');
    await user.selectOptions(screen.getByTestId('convert-to'), 'JPY');
    expect(screen.getByTestId('convert-result').textContent).toMatch(/^JP¥[\d,]+$/);
    await user.click(screen.getByRole('button', { name: 'Swap currencies' }));
    expect(screen.getByTestId('convert-from')).toHaveValue('JPY');
    await user.clear(screen.getByTestId('convert-amount'));
    await user.type(screen.getByTestId('convert-amount'), 'abc');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount like');
  });

  it('falls back to the fixture when live rates are unreachable', async () => {
    const user = userEvent.setup();
    const orig = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    wrap(<Convert />);
    await user.click(screen.getByRole('button', { name: /Fetch live ECB rates/ }));
    expect(await screen.findByText(/still using the offline fixture/)).toBeInTheDocument();
    globalThis.fetch = orig;
  });
});

describe('Categorise', () => {
  it('shows the pipeline for an example and the naive answer', async () => {
    const user = userEvent.setup();
    wrap(<Categorise />);
    expect(screen.getByTestId('cat-normalised').textContent).toBe('pret a manger');
    expect(screen.getByTestId('cat-category').textContent).toBe('Eating out');
    await user.click(screen.getByRole('button', { name: 'PIZZZERIA MARINO DUBLIN' }));
    expect(screen.getByTestId('cat-category').textContent).toBe('Eating out');
    expect(screen.getByTestId('cat-naive').textContent).toBe('General');
  });
});

describe('Subscriptions', () => {
  it('lists detected recurring payments with a monthly total', () => {
    wrap(<Subscriptions />);
    expect(screen.getAllByTestId('subscription').length).toBeGreaterThan(5);
    expect(screen.getByTestId('subs-total').textContent).toMatch(/^£[\d,]+\.\d\d$/);
  });
});

describe('Transactions', () => {
  it('loads a feed, renders only a window of rows and filters', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap(<Transactions params={new URLSearchParams('n=5000')} />);
    await act(async () => {
      vi.runAllTimers();
    });
    const status = await screen.findByTestId('result-count');
    expect(status).toHaveAttribute('data-ready', 'true');
    expect(status.textContent).toBe('5,000 results');
    expect(screen.getAllByRole('row').length).toBeLessThan(60);
    await user.selectOptions(screen.getByTestId('category-filter'), 'transport');
    expect(Number(status.dataset.count)).toBeLessThan(5000);
    await user.type(screen.getByTestId('search'), 'zzzz-nothing');
    expect(await screen.findByTestId('feed-empty')).toBeInTheDocument();
    await user.click(within(screen.getByTestId('feed-empty')).getByRole('button', { name: 'Clear filters' }));
    expect(status.textContent).toBe('5,000 results');
    vi.useRealTimers();
  });

  it('renders every row in the non-virtualised baseline mode', async () => {
    wrap(<Transactions params={new URLSearchParams('n=1000&virtual=0')} />);
    await screen.findByText('1,000 results', {}, { timeout: 5000 });
    expect(screen.getAllByRole('row')).toHaveLength(1001);
  });
});

describe('App routing', () => {
  it('routes by hash and marks the current nav item', async () => {
    window.location.hash = '#/categorise';
    wrap(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Merchant categoriser' }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /Categoriser/ })).toHaveAttribute('aria-current', 'page');
    await act(async () => {
      window.location.hash = '#/split';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Split the bill' })).toBeInTheDocument();
  });
});

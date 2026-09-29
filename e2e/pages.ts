export const PAGES = [
  { name: 'overview', path: '/', heading: 'Overview', nav: 'Overview' },
  { name: 'transactions', path: '/transactions?n=10000', heading: 'Transactions', nav: 'Transactions' },
  { name: 'subscriptions', path: '/subscriptions', heading: 'Subscriptions & bills', nav: 'Subscriptions' },
  { name: 'split', path: '/split', heading: 'Split the bill', nav: 'Split bill' },
  { name: 'convert', path: '/convert', heading: 'Convert', nav: 'Convert' },
  { name: 'categorise', path: '/categorise', heading: 'Merchant categoriser', nav: 'Categoriser' },
] as const;

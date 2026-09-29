import type { CategoryId } from './categories';

export interface MerchantDef {
  /** Canonical display name. */
  readonly name: string;
  readonly category: CategoryId;
  /** Extra curated aliases, written as they appear AFTER normalisation (lower case, no punctuation). */
  readonly aliases?: readonly string[];
  /** Typical spend in major units [min, max]. */
  readonly range: readonly [number, number];
  /** Relative frequency for random (non-recurring) spending. 0 = never drawn at random. */
  readonly weight: number;
}

/**
 * Knowledge base of known merchants across the UK, Italy, Spain and Germany.
 * Synthetic transactions use these names; the brands are just realistic strings, with no affiliation implied.
 */
export const MERCHANTS: readonly MerchantDef[] = [
  // groceries
  {
    name: 'Tesco',
    category: 'groceries',
    aliases: ['tesco stores', 'tesco express'],
    range: [4, 95],
    weight: 9,
  },
  {
    name: "Sainsbury's",
    category: 'groceries',
    aliases: ['sainsburys', 'js sainsbury', 'sainsburys s mkt'],
    range: [5, 90],
    weight: 7,
  },
  { name: 'Waitrose', category: 'groceries', range: [6, 80], weight: 3 },
  { name: 'Lidl', category: 'groceries', aliases: ['lidl gb', 'lidl italia'], range: [5, 70], weight: 6 },
  { name: 'Aldi', category: 'groceries', aliases: ['aldi stores', 'aldi sud'], range: [5, 70], weight: 5 },
  { name: 'Esselunga', category: 'groceries', range: [6, 90], weight: 4 },
  { name: 'Mercadona', category: 'groceries', range: [6, 90], weight: 4 },
  {
    name: 'Carrefour',
    category: 'groceries',
    aliases: ['carrefour express', 'carrefour market'],
    range: [5, 85],
    weight: 4,
  },
  { name: 'Rewe', category: 'groceries', aliases: ['rewe markt'], range: [5, 80], weight: 3 },
  { name: 'Edeka', category: 'groceries', range: [5, 75], weight: 3 },
  { name: 'Ocado', category: 'groceries', aliases: ['ocado retail'], range: [40, 140], weight: 2 },
  { name: 'Riverford', category: 'groceries', aliases: ['riverford organic'], range: [18, 32], weight: 0 },
  // eating out
  { name: 'Pret A Manger', category: 'eating-out', aliases: ['pret'], range: [3, 12], weight: 8 },
  { name: 'Starbucks', category: 'eating-out', range: [3, 9], weight: 5 },
  { name: 'Costa Coffee', category: 'eating-out', aliases: ['costa'], range: [3, 9], weight: 5 },
  { name: "McDonald's", category: 'eating-out', aliases: ['mcdonalds'], range: [4, 18], weight: 4 },
  { name: 'Deliveroo', category: 'eating-out', range: [14, 45], weight: 4 },
  {
    name: 'Just Eat',
    category: 'eating-out',
    aliases: ['justeat', 'just eat uk'],
    range: [14, 40],
    weight: 3,
  },
  { name: 'Glovo', category: 'eating-out', range: [12, 35], weight: 2 },
  { name: 'Nando’s', category: 'eating-out', aliases: ['nandos'], range: [12, 45], weight: 2 },
  { name: 'Wagamama', category: 'eating-out', range: [15, 55], weight: 2 },
  { name: 'Itsu', category: 'eating-out', range: [6, 16], weight: 2 },
  // transport
  { name: 'Uber', category: 'transport', aliases: ['uber trip', 'uber bv'], range: [7, 35], weight: 5 },
  {
    name: 'TfL',
    category: 'transport',
    aliases: ['tfl travel charge', 'transport for london', 'tfl gov uk'],
    range: [2, 9],
    weight: 8,
  },
  {
    name: 'Trainline',
    category: 'transport',
    aliases: ['thetrainline', 'trainline com'],
    range: [12, 120],
    weight: 2,
  },
  { name: 'Trenitalia', category: 'transport', range: [9, 90], weight: 2 },
  { name: 'Renfe', category: 'transport', aliases: ['renfe viajeros'], range: [9, 80], weight: 2 },
  {
    name: 'Deutsche Bahn',
    category: 'transport',
    aliases: ['db vertrieb', 'db bahn'],
    range: [9, 110],
    weight: 2,
  },
  { name: 'Shell', category: 'transport', aliases: ['shell uk', 'shell oil'], range: [30, 90], weight: 2 },
  { name: 'BP', category: 'transport', aliases: ['bp express', 'bp oil'], range: [30, 90], weight: 1 },
  { name: 'Lime', category: 'transport', aliases: ['lime ride', 'li me'], range: [2, 8], weight: 2 },
  // shopping
  {
    name: 'Amazon',
    category: 'shopping',
    aliases: ['amzn mktp', 'amazon co uk', 'amzn', 'amazon mktplace'],
    range: [6, 120],
    weight: 7,
  },
  { name: 'Zara', category: 'shopping', range: [20, 110], weight: 2 },
  { name: 'H&M', category: 'shopping', aliases: ['h m', 'hm', 'h and m'], range: [10, 70], weight: 2 },
  { name: 'IKEA', category: 'shopping', range: [15, 240], weight: 1 },
  { name: 'MediaMarkt', category: 'shopping', aliases: ['media markt'], range: [20, 400], weight: 1 },
  { name: 'Decathlon', category: 'shopping', range: [12, 150], weight: 1 },
  { name: 'Uniqlo', category: 'shopping', range: [15, 90], weight: 1 },
  { name: 'Argos', category: 'shopping', range: [10, 150], weight: 1 },
  { name: 'eBay', category: 'shopping', aliases: ['ebay marketplace', 'ebay o'], range: [5, 90], weight: 1 },
  // bills
  { name: 'Octopus Energy', category: 'bills', aliases: ['octopus'], range: [60, 140], weight: 0 },
  { name: 'Thames Water', category: 'bills', range: [30, 55], weight: 0 },
  { name: 'Vodafone', category: 'bills', range: [15, 40], weight: 0 },
  { name: 'EE', category: 'bills', aliases: ['ee limited', 'ee ltd'], range: [15, 45], weight: 0 },
  {
    name: 'Council Tax',
    category: 'bills',
    aliases: ['lb hackney council tax', 'council tax dd', 'ctax'],
    range: [120, 180],
    weight: 0,
  },
  { name: 'Enel Energia', category: 'bills', aliases: ['enel'], range: [40, 110], weight: 0 },
  { name: 'Iberdrola', category: 'bills', range: [40, 110], weight: 0 },
  { name: 'Hyperoptic', category: 'bills', range: [25, 45], weight: 0 },
  { name: 'Aviva', category: 'bills', aliases: ['aviva insurance'], range: [150, 420], weight: 0 },
  {
    name: 'Landlord Rent',
    category: 'bills',
    aliases: ['rent', 'rent payment'],
    range: [900, 1500],
    weight: 0,
  },
  // entertainment
  { name: 'Netflix', category: 'entertainment', aliases: ['netflix com'], range: [5, 18], weight: 0 },
  {
    name: 'Spotify',
    category: 'entertainment',
    aliases: ['spotify ab', 'spotify p'],
    range: [10, 18],
    weight: 0,
  },
  {
    name: 'Disney Plus',
    category: 'entertainment',
    aliases: ['disney', 'disneyplus'],
    range: [5, 12],
    weight: 0,
  },
  {
    name: 'Apple',
    category: 'entertainment',
    aliases: ['apple com bill', 'itunes com', 'apple services'],
    range: [1, 15],
    weight: 1,
  },
  {
    name: 'YouTube Premium',
    category: 'entertainment',
    aliases: ['google youtube', 'youtube', 'google youtubepremium'],
    range: [9, 13],
    weight: 0,
  },
  { name: 'Odeon', category: 'entertainment', aliases: ['odeon cinemas'], range: [9, 30], weight: 2 },
  { name: 'Vue Cinemas', category: 'entertainment', aliases: ['vue'], range: [9, 28], weight: 1 },
  {
    name: 'Steam',
    category: 'entertainment',
    aliases: ['steamgames', 'steam purchase', 'valve'],
    range: [4, 60],
    weight: 1,
  },
  {
    name: 'The Guardian',
    category: 'entertainment',
    aliases: ['guardian news', 'guardian'],
    range: [5, 12],
    weight: 0,
  },
  { name: 'Ticketmaster', category: 'entertainment', range: [25, 120], weight: 1 },
  // travel
  { name: 'Ryanair', category: 'travel', range: [25, 180], weight: 1 },
  {
    name: 'easyJet',
    category: 'travel',
    aliases: ['easyjet', 'easyjet airline'],
    range: [30, 200],
    weight: 1,
  },
  { name: 'British Airways', category: 'travel', aliases: ['ba', 'british a'], range: [80, 600], weight: 1 },
  {
    name: 'Booking.com',
    category: 'travel',
    aliases: ['booking com', 'booking'],
    range: [60, 450],
    weight: 1,
  },
  { name: 'Airbnb', category: 'travel', range: [80, 600], weight: 1 },
  { name: 'Premier Inn', category: 'travel', range: [60, 140], weight: 1 },
  // health
  {
    name: 'Boots',
    category: 'health',
    aliases: ['boots the chemist', 'boots uk'],
    range: [3, 40],
    weight: 3,
  },
  { name: 'Superdrug', category: 'health', range: [3, 30], weight: 1 },
  { name: 'PureGym', category: 'health', aliases: ['puregym ltd', 'pure gym'], range: [20, 35], weight: 0 },
  { name: 'Bupa', category: 'health', aliases: ['bupa uk'], range: [30, 90], weight: 0 },
  { name: 'Specsavers', category: 'health', range: [20, 150], weight: 1 },
  // income
  {
    name: 'Payroll',
    category: 'income',
    aliases: ['salary', 'payroll bacs', 'wages'],
    range: [2200, 3200],
    weight: 0,
  },
  { name: 'HMRC', category: 'income', aliases: ['hmrc tax refund'], range: [50, 600], weight: 0 },
  // transfers
  {
    name: 'Savings Pot',
    category: 'transfers',
    aliases: ['to savings pot', 'savings'],
    range: [50, 400],
    weight: 0,
  },
  {
    name: 'Bank Transfer',
    category: 'transfers',
    aliases: ['faster payment', 'fps', 'transfer'],
    range: [10, 300],
    weight: 1,
  },
  {
    name: 'ATM',
    category: 'transfers',
    aliases: ['cash withdrawal', 'atm withdrawal', 'cashpoint'],
    range: [20, 100],
    weight: 1,
  },
];

/** Subscriptions and bills that recur. Used to plant ground truth for the recurring detector. */
export interface RecurringDef {
  readonly merchant: string;
  readonly cadence: Cadence;
  readonly amount: number; // major units
}

export type Cadence = 'weekly' | 'monthly' | 'yearly';

export const RECURRING_POOL: readonly RecurringDef[] = [
  { merchant: 'Netflix', cadence: 'monthly', amount: 10.99 },
  { merchant: 'Spotify', cadence: 'monthly', amount: 11.99 },
  { merchant: 'Disney Plus', cadence: 'monthly', amount: 7.99 },
  { merchant: 'YouTube Premium', cadence: 'monthly', amount: 12.99 },
  { merchant: 'Apple', cadence: 'monthly', amount: 2.99 },
  { merchant: 'PureGym', cadence: 'monthly', amount: 24.99 },
  { merchant: 'Vodafone', cadence: 'monthly', amount: 22.0 },
  { merchant: 'EE', cadence: 'monthly', amount: 28.5 },
  { merchant: 'Hyperoptic', cadence: 'monthly', amount: 35.0 },
  { merchant: 'Octopus Energy', cadence: 'monthly', amount: 96.0 },
  { merchant: 'Thames Water', cadence: 'monthly', amount: 41.2 },
  { merchant: 'Council Tax', cadence: 'monthly', amount: 148.0 },
  { merchant: 'Bupa', cadence: 'monthly', amount: 54.3 },
  { merchant: 'Amazon', cadence: 'monthly', amount: 8.99 },
  { merchant: 'Aviva', cadence: 'yearly', amount: 312.4 },
  { merchant: 'Riverford', cadence: 'weekly', amount: 24.5 },
  { merchant: 'The Guardian', cadence: 'yearly', amount: 119.0 },
];

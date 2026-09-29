import type { CurrencyCode } from '../money/currency';
import type { Money } from '../money/money';
import type { Method } from '../categorise/categorise';
import type { CategoryId } from './categories';
import type { Cadence } from './merchants';

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly currency: CurrencyCode;
  readonly balance: Money;
}

/** A transaction as the bank feed delivers it: a signed amount and a messy descriptor. */
export interface RawTransaction {
  readonly id: string;
  readonly date: string;
  readonly accountId: string;
  /** Negative for money out, positive for money in. Integer minor units. */
  readonly amount: Money;
  readonly raw: string;
  /** Ground truth, known only because the data is synthetic. Never shown to the categoriser. */
  readonly truth: { readonly category: CategoryId; readonly merchant: string | null };
}

/** A transaction after enrichment by the categoriser. */
export interface Transaction extends RawTransaction {
  readonly category: CategoryId;
  readonly merchant: string;
  readonly merchantKey: string;
  readonly method: Method;
}

/** A planted recurring series: the ground truth the recurring detector is scored against. */
export interface TruthSeries {
  readonly merchant: string;
  readonly cadence: Cadence;
  readonly dates: readonly string[];
  readonly active: boolean;
  /** First scheduled charge after the data ends, when the series is still active. */
  readonly nextDue: string | null;
}

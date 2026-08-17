import type {
  Match,
  Subscription,
  SubscriptionRedemption,
  Transaction,
} from "@/types/dashboard";

type RawMatch = Omit<Match, "date"> & { date: string };
type RawTransaction = Omit<Transaction, "date"> & { date: string };
type RawSubscription = Omit<
  Subscription,
  "purchasedAt" | "validTo" | "customerId"
> & {
  purchasedAt: string;
  validTo: string;
  customerId?: string;
};

function customerIdForSubscription(id: string): string {
  const n = Number.parseInt(String(id).replace(/\D/g, ""), 10);
  const index = Number.isFinite(n) && n > 0 ? n : 1;
  return `cust-${Math.max(1, Math.floor((index - 1) * 4 / 5) + 1)}`;
}

type RawSubscriptionRedemption = Omit<SubscriptionRedemption, "redeemedAt"> & {
  redeemedAt: string;
};

export type RawMockData = {
  matches: RawMatch[];
  transactions: RawTransaction[];
  subscriptions: RawSubscription[];
  subscriptionRedemptions?: RawSubscriptionRedemption[];
};

export type RevivedMockData = {
  matches: Match[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  subscriptionRedemptions: SubscriptionRedemption[];
};

const TRANSACTION_REVIVE_CHUNK = 4000;

function reviveMatch(match: RawMatch): void {
  (match as unknown as Match).date = new Date(match.date);
}

function reviveTransaction(tx: RawTransaction): void {
  (tx as unknown as Transaction).date = new Date(tx.date);
}

function reviveSubscription(sub: RawSubscription): void {
  const revived = sub as unknown as Subscription;
  revived.customerId = sub.customerId ?? customerIdForSubscription(sub.id);
  revived.purchasedAt = new Date(sub.purchasedAt);
  revived.validTo = new Date(sub.validTo);
}

function reviveRedemption(redemption: RawSubscriptionRedemption): void {
  (redemption as unknown as SubscriptionRedemption).redeemedAt = new Date(
    redemption.redeemedAt,
  );
}

function asRevived(raw: RawMockData): RevivedMockData {
  return {
    matches: raw.matches as unknown as Match[],
    transactions: raw.transactions as unknown as Transaction[],
    subscriptions: raw.subscriptions as unknown as Subscription[],
    subscriptionRedemptions: (raw.subscriptionRedemptions ??
      []) as unknown as SubscriptionRedemption[],
  };
}

/** Mutates parsed mock JSON in place so we don't clone ~150k transaction objects. */
export function reviveMockData(raw: RawMockData): RevivedMockData {
  for (const match of raw.matches) reviveMatch(match);
  for (const tx of raw.transactions) reviveTransaction(tx);
  for (const sub of raw.subscriptions) reviveSubscription(sub);
  for (const redemption of raw.subscriptionRedemptions ?? []) {
    reviveRedemption(redemption);
  }
  return asRevived(raw);
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Same as reviveMockData, but yields so the loading UI can keep painting. */
export async function reviveMockDataAsync(
  raw: RawMockData,
): Promise<RevivedMockData> {
  for (const match of raw.matches) reviveMatch(match);
  for (const sub of raw.subscriptions) reviveSubscription(sub);
  for (const redemption of raw.subscriptionRedemptions ?? []) {
    reviveRedemption(redemption);
  }

  const transactions = raw.transactions;
  for (let index = 0; index < transactions.length; index += 1) {
    reviveTransaction(transactions[index]!);
    if (index > 0 && index % TRANSACTION_REVIVE_CHUNK === 0) {
      await yieldToMain();
    }
  }

  return asRevived(raw);
}

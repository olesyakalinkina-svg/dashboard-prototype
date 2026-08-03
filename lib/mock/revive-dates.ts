import type { Match, Subscription, Transaction } from "@/types/dashboard";

type RawMatch = Omit<Match, "date"> & { date: string };
type RawTransaction = Omit<Transaction, "date"> & { date: string };
type RawSubscription = Omit<Subscription, "purchasedAt" | "validTo"> & {
  purchasedAt: string;
  validTo: string;
};

export type RawMockData = {
  matches: RawMatch[];
  transactions: RawTransaction[];
  subscriptions: RawSubscription[];
};

export function reviveMockData(raw: RawMockData): {
  matches: Match[];
  transactions: Transaction[];
  subscriptions: Subscription[];
} {
  return {
    matches: raw.matches.map((match) => ({
      ...match,
      date: new Date(match.date),
    })),
    transactions: raw.transactions.map((tx) => ({
      ...tx,
      date: new Date(tx.date),
    })),
    subscriptions: raw.subscriptions.map((sub) => ({
      ...sub,
      purchasedAt: new Date(sub.purchasedAt),
      validTo: new Date(sub.validTo),
    })),
  };
}

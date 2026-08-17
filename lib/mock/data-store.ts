import type {
  Match,
  Subscription,
  SubscriptionRedemption,
  Transaction,
} from "@/types/dashboard";
import {
  reviveMockData,
  reviveMockDataAsync,
  type RawMockData,
} from "@/lib/mock/revive-dates";
import { mergeActiveCampaignPaceSubscriptions } from "@/lib/mock/campaign-extra-subscriptions";

type MockData = {
  matches: Match[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  subscriptionRedemptions: SubscriptionRedemption[];
};

let cached: MockData | null = null;
let matchByIdCache: Map<string, Match> | null = null;
let ticketTransactionsByMatchId: Map<string, Transaction[]> | null = null;
let merchTransactionsCache: Transaction[] | null = null;
let loadPromise: Promise<void> | null = null;

function indexTransactions(transactions: Transaction[]) {
  ticketTransactionsByMatchId = new Map();
  merchTransactionsCache = [];
  for (const tx of transactions) {
    if (tx.stream === "merch") {
      merchTransactionsCache.push(tx);
      continue;
    }
    if (tx.stream !== "tickets" || !tx.matchId) continue;
    const list = ticketTransactionsByMatchId.get(tx.matchId);
    if (list) {
      list.push(tx);
    } else {
      ticketTransactionsByMatchId.set(tx.matchId, [tx]);
    }
  }
}

function applyData(data: MockData) {
  cached = {
    ...data,
    subscriptions: mergeActiveCampaignPaceSubscriptions(data.subscriptions),
  };
  matchByIdCache = new Map(data.matches.map((match) => [match.id, match]));
  indexTransactions(data.transactions);
}

export function isMockDataReady(): boolean {
  return cached !== null;
}

export function getMatches(): Match[] {
  if (!cached) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return cached.matches;
}

export function getTransactions(): Transaction[] {
  if (!cached) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return cached.transactions;
}

export function getTicketTransactionsByMatchId(): Map<string, Transaction[]> {
  if (!ticketTransactionsByMatchId) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return ticketTransactionsByMatchId;
}

export function getMerchTransactions(): Transaction[] {
  if (!merchTransactionsCache) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return merchTransactionsCache;
}

export function getSubscriptions(): Subscription[] {
  if (!cached) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return cached.subscriptions;
}

export function getSubscriptionRedemptions(): SubscriptionRedemption[] {
  if (!cached) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return cached.subscriptionRedemptions;
}

export function getMatchById(): Map<string, Match> {
  if (!matchByIdCache) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return matchByIdCache;
}

export function initMockDataSync(raw: RawMockData): void {
  applyData(reviveMockData(raw));
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function fetchRawMockData(): Promise<RawMockData> {
  if (typeof window === "undefined") {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const filePath = join(process.cwd(), "lib/mock/data/hockey-mock.json");
    return JSON.parse(readFileSync(filePath, "utf-8")) as RawMockData;
  }

  // Fetch JSON instead of `import()` so webpack does not parse a ~40MB JS module
  // on the main thread (that is what freezes Chrome after first paint).
  const response = await fetch("/api/mock-data");
  if (!response.ok) {
    throw new Error(`Failed to load dashboard data (${response.status})`);
  }
  const text = await response.text();
  await yieldToMain();
  const raw = JSON.parse(text) as RawMockData;
  await yieldToMain();
  return raw;
}

export function loadMockData(): Promise<void> {
  if (cached) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = fetchRawMockData()
      .then(async (raw) => {
        const revived =
          typeof window === "undefined"
            ? reviveMockData(raw)
            : await reviveMockDataAsync(raw);
        applyData(revived);
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }

  return loadPromise;
}

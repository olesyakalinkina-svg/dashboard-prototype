import type { Match, Subscription, Transaction } from "@/types/dashboard";
import { reviveMockData, type RawMockData } from "@/lib/mock/revive-dates";

type MockData = {
  matches: Match[];
  transactions: Transaction[];
  subscriptions: Subscription[];
};

let cached: MockData | null = null;
let matchByIdCache: Map<string, Match> | null = null;
let loadPromise: Promise<void> | null = null;

function applyData(data: MockData) {
  cached = data;
  matchByIdCache = new Map(data.matches.map((match) => [match.id, match]));
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

export function getSubscriptions(): Subscription[] {
  if (!cached) {
    throw new Error("Mock data not loaded. Call loadMockData() first.");
  }
  return cached.subscriptions;
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

async function fetchRawMockData(): Promise<RawMockData> {
  if (typeof window === "undefined") {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const filePath = join(process.cwd(), "lib/mock/data/hockey-mock.json");
    return JSON.parse(readFileSync(filePath, "utf-8")) as RawMockData;
  }

  const { default: mockData } = await import("@/lib/mock/data/hockey-mock.json");
  return mockData as RawMockData;
}

export function loadMockData(): Promise<void> {
  if (cached) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = fetchRawMockData()
      .then((raw) => {
        applyData(reviveMockData(raw));
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }

  return loadPromise;
}

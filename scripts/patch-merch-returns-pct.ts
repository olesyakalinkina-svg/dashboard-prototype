/**
 * Lowers merch return rate in hockey-mock.json and aligns 2024/25 so
 * default KPI «Возвраты (%)» is ~0.8–1.5% with a calm YoY delta.
 *
 * Usage: npx tsx scripts/patch-merch-returns-pct.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DASHBOARD_FILTERS } from "../lib/filter-coverage";
import { computeMerchKpis } from "../lib/filters";
import { DEFAULT_MERCH_FILTERS } from "../lib/merch-filter-options";
import { initMockDataSync } from "../lib/mock/data-store";
import { reviveMockData, type RawMockData } from "../lib/mock/revive-dates";
import type { Match, Transaction } from "../types/dashboard";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

const TARGET_RETURNS_PCT = 1.2;
const YOY_ABS_MAX = 10;

function summarizeReturnsPct(txs: Transaction[]): number {
  let returnsValue = 0;
  let grossSales = 0;
  for (const tx of txs) {
    if (tx.stream !== "merch") continue;
    if (tx.isReturn) returnsValue += tx.amount;
    else grossSales += tx.amount;
  }
  return grossSales > 0 ? (returnsValue / grossSales) * 100 : 0;
}

function khlMerchSlice(
  txs: Transaction[],
  matchById: Map<string, Match>,
  season: string,
): Transaction[] {
  return txs.filter((tx) => {
    if (tx.stream !== "merch") return false;
    if (!tx.matchId) return false;
    const match = matchById.get(tx.matchId);
    return match?.season === season && match.league === "KHL";
  });
}

/** Drop evenly spaced returns until returnsPct <= target. */
function trimReturnsToTarget(
  txs: Transaction[],
  returnIds: string[],
  matchById: Map<string, Match>,
  season: string,
  targetPct: number,
): Set<string> {
  const drop = new Set<string>();
  if (returnIds.length === 0) return drop;

  let slice = khlMerchSlice(txs, matchById, season);
  let pct = summarizeReturnsPct(slice);
  if (pct <= targetPct) return drop;

  const step = Math.max(
    1,
    Math.floor(returnIds.length / Math.max(1, Math.ceil(pct / targetPct))),
  );
  let idx = 0;
  let guard = 0;
  while (pct > targetPct && drop.size < returnIds.length && guard < returnIds.length * 2) {
    guard += 1;
    const id = returnIds[idx % returnIds.length];
    idx += step;
    if (drop.has(id)) {
      const next = returnIds.find((candidate) => !drop.has(candidate));
      if (!next) break;
      drop.add(next);
    } else {
      drop.add(id);
    }
    const remaining = txs.filter((tx) => !drop.has(tx.id));
    slice = khlMerchSlice(remaining, matchById, season);
    pct = summarizeReturnsPct(slice);
  }
  return drop;
}

function addPrevSeasonReturns(
  txs: Transaction[],
  matchById: Map<string, Match>,
  targetPct: number,
): void {
  const prevSales = khlMerchSlice(txs, matchById, "2024/25").filter(
    (tx) => !tx.isReturn,
  );
  const linked = new Set(
    txs
      .filter((tx) => tx.isReturn && tx.stream === "merch")
      .map((tx) => `${tx.matchId}::${tx.description}`),
  );

  let nextId =
    Math.max(
      0,
      ...txs.map((tx) => {
        const n = Number.parseInt(String(tx.id).replace(/\D/g, ""), 10);
        return Number.isFinite(n) ? n : 0;
      }),
    ) + 1;

  let slice = khlMerchSlice(txs, matchById, "2024/25");
  let pct = summarizeReturnsPct(slice);
  let i = 0;
  while (pct < targetPct && i < prevSales.length) {
    const sale = prevSales[i++];
    const key = `${sale.matchId}::Возврат: ${sale.description}`;
    if (linked.has(key)) continue;
    linked.add(key);
    const returnQty = Math.max(1, Math.min(sale.quantity, 1));
    const returnAmount = Math.round((sale.amount / sale.quantity) * returnQty);
    const ret: Transaction = {
      id: `tx-${nextId++}`,
      date: sale.date,
      stream: "merch",
      description: `Возврат: ${sale.description}`,
      matchId: sale.matchId,
      channel: sale.channel,
      amount: returnAmount,
      quantity: returnQty,
      listUnitPrice: sale.listUnitPrice,
      merchSalesPoint: sale.merchSalesPoint,
      productCategory: sale.productCategory,
      isReturn: true,
    };
    txs.push(ret);
    slice = khlMerchSlice(txs, matchById, "2024/25");
    pct = summarizeReturnsPct(slice);
  }
}

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
const revived = reviveMockData(raw);
const matchById = new Map(revived.matches.map((m) => [m.id, m]));
const transactions = revived.transactions;

initMockDataSync(raw);
const before = computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, DEFAULT_MERCH_FILTERS);
console.log("before", {
  returnsPct: before.returnsPct,
  yoy: before.seasonComparison?.returnsPctChange,
});

const curReturns = khlMerchSlice(transactions, matchById, "2025/26")
  .filter((tx) => tx.isReturn)
  .map((tx) => tx.id);
const prevReturns = khlMerchSlice(transactions, matchById, "2024/25")
  .filter((tx) => tx.isReturn)
  .map((tx) => tx.id);

console.log("KHL returns", { current: curReturns.length, prev: prevReturns.length });

const dropCur = trimReturnsToTarget(
  transactions,
  curReturns,
  matchById,
  "2025/26",
  TARGET_RETURNS_PCT,
);
const dropPrev = trimReturnsToTarget(
  transactions,
  prevReturns,
  matchById,
  "2024/25",
  TARGET_RETURNS_PCT,
);

const drop = new Set([...dropCur, ...dropPrev]);
let nextTxs = transactions.filter((tx) => !drop.has(tx.id));

initMockDataSync({
  ...raw,
  transactions: nextTxs as unknown as RawMockData["transactions"],
});
const mid = computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, DEFAULT_MERCH_FILTERS);
const curPct = mid.returnsPct;
const prevTargetLow = curPct / (1 + YOY_ABS_MAX / 100);
const prevTargetHigh = curPct / (1 - YOY_ABS_MAX / 100);
let prevPct = summarizeReturnsPct(khlMerchSlice(nextTxs, matchById, "2024/25"));

if (prevPct < prevTargetLow) {
  addPrevSeasonReturns(nextTxs, matchById, prevTargetLow);
} else if (prevPct > prevTargetHigh) {
  const stillPrev = khlMerchSlice(nextTxs, matchById, "2024/25")
    .filter((tx) => tx.isReturn)
    .map((tx) => tx.id);
  const moreDrop = trimReturnsToTarget(
    nextTxs,
    stillPrev,
    matchById,
    "2024/25",
    Math.min(prevTargetHigh, TARGET_RETURNS_PCT),
  );
  nextTxs = nextTxs.filter((tx) => !moreDrop.has(tx.id));
}

const serialized = {
  ...raw,
  matches: revived.matches.map((match) => ({
    ...match,
    date:
      match.date instanceof Date
        ? match.date.toISOString().replace(/T.*/, "T12:00:00")
        : match.date,
  })),
  transactions: nextTxs.map((tx) => ({
    ...tx,
    date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
  })),
  subscriptions: revived.subscriptions.map((sub) => ({
    ...sub,
    purchasedAt:
      sub.purchasedAt instanceof Date
        ? sub.purchasedAt.toISOString()
        : sub.purchasedAt,
    validTo:
      sub.validTo instanceof Date ? sub.validTo.toISOString() : sub.validTo,
  })),
  subscriptionRedemptions: revived.subscriptionRedemptions.map((redemption) => ({
    ...redemption,
    redeemedAt:
      redemption.redeemedAt instanceof Date
        ? redemption.redeemedAt.toISOString().replace(/T.*/, "T12:00:00")
        : redemption.redeemedAt,
  })),
};

writeFileSync(mockPath, JSON.stringify(serialized));

initMockDataSync(serialized as RawMockData);
const after = computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, DEFAULT_MERCH_FILTERS);
console.log("after", {
  returnsPct: after.returnsPct,
  yoy: after.seasonComparison?.returnsPctChange,
  dropped: drop.size,
});
console.log(`Wrote ${mockPath}`);

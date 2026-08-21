/**
 * Aligns 2024/25 match calendar days in hockey-mock.json to the 2025/26
 * analogs (same month/day, year shifted back) without regenerating tickets.
 * Only matches whose calendar day actually moves are rewritten, along with
 * their ticket/merch txs and redemptions. 2024/25 playoff subscription
 * purchases shift with the first playoff match so the analog sales window
 * stays populated. 2025/26 dates stay put. Non-return txs stay on or before
 * match day.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import {
  analogPreviousSeasonDate,
  applyPreviousSeasonAnalogCalendar,
  getFirstPlayoffMatchDate,
  pairPreviousSeasonMatchesByLeagueOrder,
} from "../lib/mock/hockey-generator";
import type { RawMockData } from "../lib/mock/revive-dates";
import type {
  Match,
  SubscriptionRedemption,
  Transaction,
} from "../types/dashboard";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

function toLocalCalendarIso(date: Date): string {
  return format(date, "yyyy-MM-dd'T'12:00:00");
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function shiftLinkedDates(
  matchId: string,
  oldDate: Date,
  newDate: Date,
  transactions: Transaction[],
  redemptions: SubscriptionRedemption[],
  shiftedTxIds: Set<string>,
  shiftedRedemptionIds: Set<string>,
): { txs: number; redemptions: number } {
  const delta = differenceInCalendarDays(
    startOfDay(newDate),
    startOfDay(oldDate),
  );
  if (delta === 0) return { txs: 0, redemptions: 0 };

  const matchDay = startOfDay(newDate);
  let txCount = 0;
  for (const tx of transactions) {
    if (tx.matchId !== matchId) continue;
    tx.date = addDays(tx.date, delta);
    if (!tx.isReturn && startOfDay(tx.date) > matchDay) {
      const timeOfDay = tx.date.getTime() - startOfDay(tx.date).getTime();
      tx.date = new Date(matchDay.getTime() + timeOfDay);
    }
    shiftedTxIds.add(tx.id);
    txCount += 1;
  }

  let redemptionCount = 0;
  for (const redemption of redemptions) {
    if (redemption.matchId !== matchId) continue;
    redemption.redeemedAt = newDate;
    shiftedRedemptionIds.add(redemption.id);
    redemptionCount += 1;
  }

  return { txs: txCount, redemptions: redemptionCount };
}

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
const originalMatches = new Map(raw.matches.map((match) => [match.id, match]));
const originalTxDates = new Map(
  raw.transactions.map((tx) => [tx.id, tx.date] as const),
);
const originalRedemptionDates = new Map(
  (raw.subscriptionRedemptions ?? []).map(
    (redemption) => [redemption.id, redemption.redeemedAt] as const,
  ),
);
const originalSubscriptions = raw.subscriptions.map((sub) => ({ ...sub }));

for (const match of raw.matches) {
  (match as unknown as Match).date = new Date(match.date);
}
for (const tx of raw.transactions) {
  (tx as unknown as Transaction).date = new Date(tx.date);
}
for (const redemption of raw.subscriptionRedemptions ?? []) {
  (redemption as unknown as SubscriptionRedemption).redeemedAt = new Date(
    redemption.redeemedAt,
  );
}

const revivedMatches = raw.matches as unknown as Match[];
const revivedTxs = raw.transactions as unknown as Transaction[];
const revivedRedemptions = (raw.subscriptionRedemptions ??
  []) as unknown as SubscriptionRedemption[];

const planned = pairPreviousSeasonMatchesByLeagueOrder(revivedMatches).map(
  ({ prev, current }) => ({
    matchId: prev.id,
    opponent: prev.opponent,
    league: prev.league,
    oldDate: new Date(prev.date.getTime()),
    newDate: analogPreviousSeasonDate(current.date),
  }),
);

const shiftedMatchIds = new Set<string>();
const shiftedTxIds = new Set<string>();
const shiftedRedemptionIds = new Set<string>();
let shiftedTxs = 0;
let shiftedRedemptions = 0;

for (const change of planned) {
  if (sameCalendarDay(change.oldDate, change.newDate)) continue;
  shiftedMatchIds.add(change.matchId);
  const moved = shiftLinkedDates(
    change.matchId,
    change.oldDate,
    change.newDate,
    revivedTxs,
    revivedRedemptions,
    shiftedTxIds,
    shiftedRedemptionIds,
  );
  shiftedTxs += moved.txs;
  shiftedRedemptions += moved.redemptions;
}

const oldFirstPlayoff = getFirstPlayoffMatchDate(revivedMatches, "2024/25");
applyPreviousSeasonAnalogCalendar(revivedMatches);
const newFirstPlayoff = getFirstPlayoffMatchDate(revivedMatches, "2024/25");

const shiftedSubIndexes = new Set<number>();
if (oldFirstPlayoff && newFirstPlayoff) {
  const playoffDelta = differenceInCalendarDays(
    startOfDay(newFirstPlayoff),
    startOfDay(oldFirstPlayoff),
  );
  if (playoffDelta !== 0) {
    raw.subscriptions.forEach((sub, index) => {
      if (sub.season !== "2024/25" || sub.tournamentStage !== "playoff") {
        return;
      }
      const purchasedAt = addDays(new Date(sub.purchasedAt), playoffDelta);
      const validTo = addDays(new Date(sub.validTo), playoffDelta);
      sub.purchasedAt = purchasedAt.toISOString();
      sub.validTo = validTo.toISOString();
      shiftedSubIndexes.add(index);
    });
    console.log(
      `  playoff subs shifted=${shiftedSubIndexes.size} deltaDays=${playoffDelta}`,
    );
  }
}

const serialized: RawMockData = {
  ...raw,
  matches: revivedMatches.map((match) => {
    if (!shiftedMatchIds.has(match.id)) {
      return originalMatches.get(match.id)!;
    }
    return {
      ...match,
      date: toLocalCalendarIso(match.date),
    };
  }),
  transactions: revivedTxs.map((tx) => {
    if (!shiftedTxIds.has(tx.id)) {
      return {
        ...tx,
        date: originalTxDates.get(tx.id)!,
      };
    }
    return {
      ...tx,
      date: tx.date.toISOString(),
    };
  }),
  subscriptions: raw.subscriptions.map((sub, index) => {
    if (!shiftedSubIndexes.has(index)) {
      return originalSubscriptions[index]!;
    }
    return sub as unknown as (typeof originalSubscriptions)[number];
  }),
  subscriptionRedemptions: revivedRedemptions.map((redemption) => {
    if (!shiftedRedemptionIds.has(redemption.id)) {
      return {
        ...redemption,
        redeemedAt: originalRedemptionDates.get(redemption.id)!,
      };
    }
    return {
      ...redemption,
      redeemedAt: toLocalCalendarIso(redemption.redeemedAt),
    };
  }),
};

writeFileSync(mockPath, JSON.stringify(serialized));
console.log(`Patched 2024/25 analog match dates in ${mockPath}`);
console.log(
  `  matches shifted=${shiftedMatchIds.size} txs=${shiftedTxs} redemptions=${shiftedRedemptions}`,
);
for (const change of planned) {
  if (sameCalendarDay(change.oldDate, change.newDate)) continue;
  console.log(
    `  ${change.matchId} ${change.league} ${change.opponent}: ${format(change.oldDate, "yyyy-MM-dd")} → ${format(change.newDate, "yyyy-MM-dd")}`,
  );
}

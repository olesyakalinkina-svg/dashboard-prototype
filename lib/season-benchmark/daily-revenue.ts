import { endOfDay, startOfDay } from "date-fns";
import type { Transaction } from "@/types/dashboard";
import { getDayOfSeasonForDate } from "@/lib/season-benchmark/day-of-season";
import { parseLocalDate } from "@/lib/season-benchmark/parse-local-date";

export function sumTransactionRevenue(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

export function aggregateDailyRevenueBySeasonDay(
  transactions: Transaction[],
  seasonStartDate: string,
  comparisonDate: Date,
): Map<number, number> {
  const start = parseLocalDate(seasonStartDate);
  const end = endOfDay(comparisonDate);
  const daily = new Map<number, number>();

  for (const tx of transactions) {
    const txDay = startOfDay(tx.date);
    if (txDay < start || txDay > end) continue;

    const dayOfSeason = getDayOfSeasonForDate(seasonStartDate, txDay);
    daily.set(dayOfSeason, (daily.get(dayOfSeason) ?? 0) + tx.amount);
  }

  return daily;
}

export function getRevenueToDate(
  transactions: Transaction[],
  seasonStartDate: string,
  comparisonDate: Date,
): number {
  const start = parseLocalDate(seasonStartDate);
  const end = endOfDay(comparisonDate);

  return transactions.reduce((sum, tx) => {
    const txDay = startOfDay(tx.date);
    if (txDay < start || txDay > end) return sum;
    return sum + tx.amount;
  }, 0);
}

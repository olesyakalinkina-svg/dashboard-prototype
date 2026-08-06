import { differenceInCalendarDays, isAfter, isBefore, startOfDay } from "date-fns";
import { getSeasonDateBounds } from "@/lib/season-dates";
import { getDataAsOfDate } from "@/lib/season-benchmark/data-as-of";
import { parseLocalDate, toLocalIsoDate } from "@/lib/season-benchmark/parse-local-date";
import type { SeasonPeriod } from "@/types/dashboard";

export const BENCHMARK_SEASON_IDS = ["2024/25", "2025/26"] as const;

export const ACTIVE_SEASON_ID = "2025/26";

export function resolveCurrentSeasonId(filterSeason: string): string {
  if (filterSeason !== "all") return filterSeason;
  return ACTIVE_SEASON_ID;
}

export function getSeasonPeriod(seasonId: string): SeasonPeriod | null {
  if (seasonId === "all") return null;

  const bounds = getSeasonDateBounds(seasonId);
  const start = startOfDay(bounds.min);
  const end = startOfDay(bounds.max);
  const asOf = getDataAsOfDate();

  let status: SeasonPeriod["status"];
  if (isBefore(asOf, start)) {
    status = "upcoming";
  } else if (isAfter(asOf, end)) {
    status = "completed";
  } else {
    status = "active";
  }

  return {
    seasonId,
    seasonName: seasonId,
    startDate: toLocalIsoDate(start),
    endDate: toLocalIsoDate(end),
    status,
  };
}

export function getBenchmarkSeasonOptions(currentSeasonId: string): string[] {
  return BENCHMARK_SEASON_IDS.filter((id) => id !== currentSeasonId);
}

export function getDefaultBenchmarkSeasonId(currentSeasonId: string): string | null {
  const options = getBenchmarkSeasonOptions(currentSeasonId);
  if (options.length === 0) return null;

  const index = BENCHMARK_SEASON_IDS.indexOf(
    currentSeasonId as (typeof BENCHMARK_SEASON_IDS)[number],
  );
  if (index > 0) {
    return BENCHMARK_SEASON_IDS[index - 1];
  }

  return options[0] ?? null;
}

export function getSeasonLengthDays(season: SeasonPeriod): number {
  const startDate = parseLocalDate(season.startDate);
  const endDate = parseLocalDate(season.endDate);
  return differenceInCalendarDays(endDate, startDate) + 1;
}

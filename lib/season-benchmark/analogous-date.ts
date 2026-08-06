import { addDays, isAfter, min, startOfDay } from "date-fns";
import { getDataAsOfDate } from "@/lib/season-benchmark/data-as-of";
import { getElapsedSeasonDays } from "@/lib/season-benchmark/day-of-season";
import { parseLocalDate, toLocalIsoDate } from "@/lib/season-benchmark/parse-local-date";
import { getSeasonLengthDays } from "@/lib/season-benchmark/season-periods";
import type { SeasonBenchmarkMode, SeasonPeriod } from "@/types/dashboard";

export type ComparisonWindow = {
  currentComparisonDate: Date;
  benchmarkComparisonDate: Date;
  elapsedDays: number;
  benchmarkCapped: boolean;
};

export function getBenchmarkComparisonDate(
  benchmarkSeasonStart: string,
  elapsedDays: number,
  benchmarkSeasonEnd: string,
): { date: Date; capped: boolean } {
  const start = parseLocalDate(benchmarkSeasonStart);
  const end = parseLocalDate(benchmarkSeasonEnd);
  const raw = addDays(start, elapsedDays - 1);

  if (isAfter(startOfDay(raw), end)) {
    return { date: end, capped: true };
  }

  return { date: startOfDay(raw), capped: false };
}

export function resolveComparisonWindow(
  currentSeason: SeasonPeriod,
  benchmarkSeason: SeasonPeriod,
  mode: SeasonBenchmarkMode,
): ComparisonWindow {
  const dataAsOf = getDataAsOfDate();
  const currentEnd = parseLocalDate(currentSeason.endDate);
  const currentStart = parseLocalDate(currentSeason.startDate);

  if (mode === "full_season") {
    const elapsedDays = getSeasonLengthDays(currentSeason);
    const benchmark = getBenchmarkComparisonDate(
      benchmarkSeason.startDate,
      elapsedDays,
      benchmarkSeason.endDate,
    );

    return {
      currentComparisonDate: currentEnd,
      benchmarkComparisonDate: benchmark.date,
      elapsedDays,
      benchmarkCapped: benchmark.capped,
    };
  }

  const currentComparisonDate = min([dataAsOf, currentEnd]);
  const elapsedDays = getElapsedSeasonDays(
    currentSeason.startDate,
    currentComparisonDate,
  );

  if (elapsedDays < 1) {
    return {
      currentComparisonDate: currentStart,
      benchmarkComparisonDate: parseLocalDate(benchmarkSeason.startDate),
      elapsedDays: 0,
      benchmarkCapped: false,
    };
  }

  const benchmark = getBenchmarkComparisonDate(
    benchmarkSeason.startDate,
    elapsedDays,
    benchmarkSeason.endDate,
  );

  return {
    currentComparisonDate,
    benchmarkComparisonDate: benchmark.date,
    elapsedDays,
    benchmarkCapped: benchmark.capped,
  };
}

export function getCalendarDateForSeasonDay(
  seasonStartDate: string,
  dayOfSeason: number,
): string {
  const start = parseLocalDate(seasonStartDate);
  return toLocalIsoDate(addDays(start, dayOfSeason - 1));
}

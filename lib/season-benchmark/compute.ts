import { resolveComparisonWindow } from "@/lib/season-benchmark/analogous-date";
import { buildCumulativeBenchmarkSeries } from "@/lib/season-benchmark/cumulative-series";
import { getDataAsOfDate } from "@/lib/season-benchmark/data-as-of";
import { getDayOfSeasonForDate } from "@/lib/season-benchmark/day-of-season";
import {
  aggregateDailyRevenueBySeasonDay,
  getRevenueToDate,
} from "@/lib/season-benchmark/daily-revenue";
import { calculateDeviation } from "@/lib/season-benchmark/deviation";
import { toLocalIsoDate } from "@/lib/season-benchmark/parse-local-date";
import {
  getDefaultBenchmarkSeasonId,
  getSeasonPeriod,
  resolveCurrentSeasonId,
} from "@/lib/season-benchmark/season-periods";
import {
  filterMatchesByTicketFilters,
  filterTicketTransactionsForSeasonBenchmark,
} from "@/lib/filters";
import { hasTransactionDateRangeFilter } from "@/lib/ticket-filter-options";
import type {
  DashboardFilters,
  SeasonBenchmark,
  SeasonBenchmarkMode,
  SeasonBenchmarkResult,
  TicketFilters,
} from "@/types/dashboard";

function emptyBenchmark(
  seasonId: string,
  seasonName: string,
): SeasonBenchmark {
  return {
    seasonId,
    seasonName,
    seasonStartDate: "",
    seasonEndDate: "",
    status: "upcoming",
    comparisonDate: "",
    elapsedDays: 0,
    revenueToDate: 0,
  };
}

function buildSeasonBenchmark(
  season: NonNullable<ReturnType<typeof getSeasonPeriod>>,
  comparisonDate: Date,
  elapsedDays: number,
  revenueToDate: number,
): SeasonBenchmark {
  return {
    seasonId: season.seasonId,
    seasonName: season.seasonName,
    seasonStartDate: season.startDate,
    seasonEndDate: season.endDate,
    status: season.status,
    comparisonDate: toLocalIsoDate(comparisonDate),
    elapsedDays,
    revenueToDate,
  };
}

export function computeSeasonBenchmark(
  _filters: DashboardFilters,
  ticketFilters: TicketFilters,
  benchmarkSeasonId: string,
  mode: SeasonBenchmarkMode,
): SeasonBenchmarkResult {
  const dateRangeFilterExcluded = hasTransactionDateRangeFilter(
    ticketFilters.transactionDateRange,
  );
  const warnings: string[] = [];

  if (dateRangeFilterExcluded) {
    warnings.push(
      "Фильтр «Дата покупки» не применяется к бенчмарку: сравнение идёт по стадии сезона, а не по календарным датам покупки.",
    );
  }

  const currentSeasonId = resolveCurrentSeasonId(ticketFilters.season);
  const currentSeason = getSeasonPeriod(currentSeasonId);
  const benchmarkSeason = getSeasonPeriod(benchmarkSeasonId);

  if (!currentSeason) {
    return {
      current: emptyBenchmark(currentSeasonId, currentSeasonId),
      benchmark: emptyBenchmark(benchmarkSeasonId, benchmarkSeasonId),
      commonComparisonDays: 0,
      absoluteDeviation: 0,
      percentageDeviation: null,
      chartData: [],
      warnings,
      dateRangeFilterExcluded,
      emptyReason: "Выберите конкретный сезон для сравнения.",
      canUseFullSeasonMode: false,
    };
  }

  if (!benchmarkSeason) {
    return {
      current: buildSeasonBenchmark(currentSeason, getDataAsOfDate(), 0, 0),
      benchmark: emptyBenchmark(benchmarkSeasonId, benchmarkSeasonId),
      commonComparisonDays: 0,
      absoluteDeviation: 0,
      percentageDeviation: null,
      chartData: [],
      warnings,
      dateRangeFilterExcluded,
      emptyReason: "Сезон для сравнения не найден.",
      canUseFullSeasonMode: false,
    };
  }

  if (benchmarkSeasonId === currentSeasonId) {
    return {
      current: buildSeasonBenchmark(currentSeason, getDataAsOfDate(), 0, 0),
      benchmark: buildSeasonBenchmark(benchmarkSeason, getDataAsOfDate(), 0, 0),
      commonComparisonDays: 0,
      absoluteDeviation: 0,
      percentageDeviation: null,
      chartData: [],
      warnings,
      dateRangeFilterExcluded,
      emptyReason: "Выберите другой сезон для сравнения.",
      canUseFullSeasonMode: false,
    };
  }

  // Full-season comparison requires a completed current season (no forecast substitution).
  const canUseFullSeasonMode = currentSeason.status === "completed";

  const comparison = resolveComparisonWindow(currentSeason, benchmarkSeason, mode);

  if (comparison.elapsedDays < 1 || currentSeason.status === "upcoming") {
    return {
      current: buildSeasonBenchmark(
        currentSeason,
        comparison.currentComparisonDate,
        0,
        0,
      ),
      benchmark: buildSeasonBenchmark(
        benchmarkSeason,
        comparison.benchmarkComparisonDate,
        0,
        0,
      ),
      commonComparisonDays: 0,
      absoluteDeviation: 0,
      percentageDeviation: null,
      chartData: [],
      warnings,
      dateRangeFilterExcluded,
      emptyReason: "Сезон ещё не начался — нет данных для сравнения.",
      canUseFullSeasonMode,
    };
  }

  if (comparison.benchmarkCapped) {
    warnings.push(
      `Сезон ${benchmarkSeason.seasonName} короче: сравнение ограничено ${benchmarkSeason.endDate}.`,
    );
  }

  const allowedCurrentMatches = filterMatchesByTicketFilters({
    ...ticketFilters,
    season: currentSeasonId,
    transactionDateRange: { from: null, to: null },
  });
  const allowedBenchmarkMatches = filterMatchesByTicketFilters({
    ...ticketFilters,
    season: benchmarkSeasonId,
    transactionDateRange: { from: null, to: null },
  });

  if (allowedCurrentMatches.length === 0 || allowedBenchmarkMatches.length === 0) {
    return {
      current: buildSeasonBenchmark(
        currentSeason,
        comparison.currentComparisonDate,
        comparison.elapsedDays,
        0,
      ),
      benchmark: buildSeasonBenchmark(
        benchmarkSeason,
        comparison.benchmarkComparisonDate,
        comparison.elapsedDays,
        0,
      ),
      commonComparisonDays: 0,
      absoluteDeviation: 0,
      percentageDeviation: null,
      chartData: [],
      warnings,
      dateRangeFilterExcluded,
      emptyReason: "Нет матчей по выбранным фильтрам.",
      canUseFullSeasonMode,
    };
  }

  const currentTransactions = filterTicketTransactionsForSeasonBenchmark(
    ticketFilters,
    currentSeasonId,
  );
  const benchmarkTransactions = filterTicketTransactionsForSeasonBenchmark(
    ticketFilters,
    benchmarkSeasonId,
  );

  const currentRevenue = getRevenueToDate(
    currentTransactions,
    currentSeason.startDate,
    comparison.currentComparisonDate,
  );
  const benchmarkRevenue = getRevenueToDate(
    benchmarkTransactions,
    benchmarkSeason.startDate,
    comparison.benchmarkComparisonDate,
  );

  const chartDays = comparison.benchmarkCapped
    ? getDayOfSeasonForDate(
        benchmarkSeason.startDate,
        comparison.benchmarkComparisonDate,
      )
    : comparison.elapsedDays;

  const currentDaily = aggregateDailyRevenueBySeasonDay(
    currentTransactions,
    currentSeason.startDate,
    comparison.currentComparisonDate,
  );
  const benchmarkDaily = aggregateDailyRevenueBySeasonDay(
    benchmarkTransactions,
    benchmarkSeason.startDate,
    comparison.benchmarkComparisonDate,
  );

  const chartData = buildCumulativeBenchmarkSeries(
    currentDaily,
    benchmarkDaily,
    currentSeason.startDate,
    benchmarkSeason.startDate,
    Math.max(1, chartDays),
  );

  const { absoluteDeviation, percentageDeviation } = calculateDeviation(
    currentRevenue,
    benchmarkRevenue,
  );

  if (benchmarkRevenue === 0 && currentRevenue !== 0) {
    warnings.push("Нет базы для сравнения: в сезоне-сравнении нулевая выручка.");
  }

  return {
    current: buildSeasonBenchmark(
      currentSeason,
      comparison.currentComparisonDate,
      comparison.elapsedDays,
      currentRevenue,
    ),
    benchmark: buildSeasonBenchmark(
      benchmarkSeason,
      comparison.benchmarkComparisonDate,
      comparison.elapsedDays,
      benchmarkRevenue,
    ),
    commonComparisonDays: chartDays,
    absoluteDeviation,
    percentageDeviation,
    chartData,
    warnings,
    dateRangeFilterExcluded,
    canUseFullSeasonMode,
  };
}

export function getInitialSeasonBenchmarkParams(ticketFilters: TicketFilters): {
  benchmarkSeasonId: string;
  mode: SeasonBenchmarkMode;
} {
  const currentSeasonId = resolveCurrentSeasonId(ticketFilters.season);
  const benchmarkSeasonId =
    getDefaultBenchmarkSeasonId(currentSeasonId) ?? "2024/25";
  const currentSeason = getSeasonPeriod(currentSeasonId);
  const mode: SeasonBenchmarkMode =
    currentSeason?.status === "completed" ? "full_season" : "current_stage";

  return { benchmarkSeasonId, mode };
}

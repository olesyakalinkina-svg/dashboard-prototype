export { getDataAsOfDate } from "@/lib/season-benchmark/data-as-of";
export {
  getElapsedSeasonDays,
  getDayOfSeasonForDate,
} from "@/lib/season-benchmark/day-of-season";
export {
  getBenchmarkComparisonDate,
  resolveComparisonWindow,
  getCalendarDateForSeasonDay,
} from "@/lib/season-benchmark/analogous-date";
export {
  aggregateDailyRevenueBySeasonDay,
  getRevenueToDate,
  sumTransactionRevenue,
} from "@/lib/season-benchmark/daily-revenue";
export {
  buildCumulativeBenchmarkSeries,
  getSeasonDayAxisTicks,
} from "@/lib/season-benchmark/cumulative-series";
export { calculateDeviation } from "@/lib/season-benchmark/deviation";
export {
  formatBenchmarkYAxisTick,
  formatDeviationAbsolute,
  formatDeviationPercent,
} from "@/lib/season-benchmark/format";
export { parseLocalDate, toLocalIsoDate } from "@/lib/season-benchmark/parse-local-date";
export {
  BENCHMARK_SEASON_IDS,
  ACTIVE_SEASON_ID,
  resolveCurrentSeasonId,
  getSeasonPeriod,
  getBenchmarkSeasonOptions,
  getDefaultBenchmarkSeasonId,
  getSeasonLengthDays,
} from "@/lib/season-benchmark/season-periods";
export {
  computeSeasonBenchmark,
  getInitialSeasonBenchmarkParams,
} from "@/lib/season-benchmark/compute";

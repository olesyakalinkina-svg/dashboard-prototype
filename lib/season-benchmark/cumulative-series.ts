import type { SeasonBenchmarkPoint } from "@/types/dashboard";
import { getCalendarDateForSeasonDay } from "@/lib/season-benchmark/analogous-date";

export function buildCumulativeBenchmarkSeries(
  currentDaily: Map<number, number>,
  benchmarkDaily: Map<number, number>,
  currentSeasonStart: string,
  benchmarkSeasonStart: string,
  maxDays: number,
): SeasonBenchmarkPoint[] {
  const points: SeasonBenchmarkPoint[] = [];
  let currentCumulative = 0;
  let benchmarkCumulative = 0;

  for (let day = 1; day <= maxDays; day += 1) {
    currentCumulative += currentDaily.get(day) ?? 0;
    benchmarkCumulative += benchmarkDaily.get(day) ?? 0;

    points.push({
      dayOfSeason: day,
      currentSeasonRevenue: currentCumulative,
      benchmarkSeasonRevenue: benchmarkCumulative,
      currentSeasonDate: getCalendarDateForSeasonDay(currentSeasonStart, day),
      benchmarkSeasonDate: getCalendarDateForSeasonDay(benchmarkSeasonStart, day),
    });
  }

  return points;
}

/** X-axis tick days: 1, 7, 14, ... up to maxDay. */
export function getSeasonDayAxisTicks(maxDay: number): number[] {
  if (maxDay <= 0) return [];

  const ticks: number[] = [1];
  for (let day = 7; day < maxDay; day += 7) {
    ticks.push(day);
  }
  if (ticks[ticks.length - 1] !== maxDay) {
    ticks.push(maxDay);
  }
  return ticks;
}

export function downsampleChartData(
  chartData: SeasonBenchmarkPoint[],
): SeasonBenchmarkPoint[] {
  if (chartData.length === 0) return [];

  const maxDay = chartData[chartData.length - 1].dayOfSeason;
  const tickDays = new Set(getSeasonDayAxisTicks(maxDay));
  tickDays.add(1);
  tickDays.add(maxDay);

  return chartData.filter((point) => tickDays.has(point.dayOfSeason));
}

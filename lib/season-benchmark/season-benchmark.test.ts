import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types/dashboard";
import {
  getBenchmarkComparisonDate,
  getCalendarDateForSeasonDay,
  resolveComparisonWindow,
} from "@/lib/season-benchmark/analogous-date";
import {
  buildCumulativeBenchmarkSeries,
  downsampleChartData,
  getSeasonDayAxisTicks,
} from "@/lib/season-benchmark/cumulative-series";
import { getDataAsOfDate } from "@/lib/season-benchmark/data-as-of";
import {
  getDayOfSeasonForDate,
  getElapsedSeasonDays,
} from "@/lib/season-benchmark/day-of-season";
import {
  aggregateDailyRevenueBySeasonDay,
  getRevenueToDate,
  sumTransactionRevenue,
} from "@/lib/season-benchmark/daily-revenue";
import { calculateDeviation } from "@/lib/season-benchmark/deviation";
import {
  formatBenchmarkYAxisTick,
  formatDeviationAbsolute,
  formatDeviationPercent,
} from "@/lib/season-benchmark/format";
import { parseLocalDate } from "@/lib/season-benchmark/parse-local-date";
import {
  computeSeasonBenchmark,
  getInitialSeasonBenchmarkParams,
} from "@/lib/season-benchmark/compute";
import {
  getSeasonLengthDays,
  getSeasonPeriod,
} from "@/lib/season-benchmark/season-periods";
import { DEFAULT_TICKET_FILTERS } from "@/lib/ticket-filter-options";

function tx(date: string, amount: number): Transaction {
  return {
    id: `tx-${date}-${amount}`,
    date: parseLocalDate(date),
    stream: "tickets",
    description: "test",
    matchId: "match-1",
    channel: "online",
    amount,
    quantity: 1,
  };
}

describe("day-of-season", () => {
  const seasonStart = "2025-09-01";

  it("treats season start as day 1", () => {
    expect(getDayOfSeasonForDate(seasonStart, parseLocalDate("2025-09-01"))).toBe(
      1,
    );
    expect(getElapsedSeasonDays(seasonStart, parseLocalDate("2025-09-01"))).toBe(
      1,
    );
  });

  it("maps day 47 to the correct calendar date", () => {
    const day47 = parseLocalDate("2025-10-17");
    expect(getDayOfSeasonForDate(seasonStart, day47)).toBe(47);
    expect(getCalendarDateForSeasonDay(seasonStart, 47)).toBe("2025-10-17");
  });

  it("handles seasons with different start dates", () => {
    const altStart = "2024-08-15";
    expect(getDayOfSeasonForDate(altStart, parseLocalDate("2024-08-15"))).toBe(
      1,
    );
    expect(getDayOfSeasonForDate(altStart, parseLocalDate("2024-09-01"))).toBe(
      18,
    );
    expect(getCalendarDateForSeasonDay(altStart, 18)).toBe("2024-09-01");
  });
});

describe("analogous-date", () => {
  it("maps elapsed days onto the benchmark season calendar", () => {
    const result = getBenchmarkComparisonDate(
      "2024-09-01",
      47,
      "2025-05-31",
    );
    expect(result.capped).toBe(false);
    expect(result.date).toEqual(parseLocalDate("2024-10-17"));
  });

  it("caps benchmark comparison at season end when seasons differ in length", () => {
    const result = getBenchmarkComparisonDate(
      "2024-09-01",
      300,
      "2025-05-31",
    );
    expect(result.capped).toBe(true);
    expect(result.date).toEqual(parseLocalDate("2025-05-31"));
  });

  it("steps across Feb 29 in a leap-year benchmark season", () => {
    const leapStart = "2024-01-01";
    const feb29Day = getDayOfSeasonForDate(leapStart, parseLocalDate("2024-02-29"));
    expect(feb29Day).toBe(60);
    expect(getCalendarDateForSeasonDay(leapStart, feb29Day)).toBe("2024-02-29");
  });

  it("resolves current-stage comparison using mock data-as-of date", () => {
    const current = getSeasonPeriod("2025/26")!;
    const benchmark = getSeasonPeriod("2024/25")!;
    const window = resolveComparisonWindow(current, benchmark, "current_stage");

    expect(window.elapsedDays).toBe(
      getElapsedSeasonDays(current.startDate, getDataAsOfDate()),
    );
    expect(window.currentComparisonDate).toEqual(getDataAsOfDate());
    expect(window.benchmarkComparisonDate).toEqual(
      getBenchmarkComparisonDate(
        benchmark.startDate,
        window.elapsedDays,
        benchmark.endDate,
      ).date,
    );
  });
});

describe("daily-revenue", () => {
  const seasonStart = "2025-09-01";
  const transactions = [
    tx("2025-08-31", 100),
    tx("2025-09-01", 1_000),
    tx("2025-09-15", 500),
    tx("2025-10-17", 700),
    tx("2025-11-01", 300),
  ];

  it("sums transaction revenue", () => {
    expect(sumTransactionRevenue(transactions)).toBe(2_600);
  });

  it("aggregates revenue by season day and ignores out-of-window dates", () => {
    const daily = aggregateDailyRevenueBySeasonDay(
      transactions,
      seasonStart,
      parseLocalDate("2025-10-17"),
    );

    expect(daily.get(1)).toBe(1_000);
    expect(daily.get(15)).toBe(500);
    expect(daily.get(47)).toBe(700);
    expect(daily.has(0)).toBe(false);
    expect(daily.get(62)).toBeUndefined();
  });

  it("returns revenue only through the comparison date", () => {
    expect(
      getRevenueToDate(
        transactions,
        seasonStart,
        parseLocalDate("2025-10-17"),
      ),
    ).toBe(2_200);
  });

  it("returns zero when no transactions fall in the comparison window", () => {
    expect(
      getRevenueToDate(transactions, seasonStart, parseLocalDate("2025-08-31")),
    ).toBe(0);
  });
});

describe("cumulative-series", () => {
  it("builds a running cumulative benchmark series", () => {
    const currentDaily = new Map([
      [1, 100],
      [2, 50],
    ]);
    const benchmarkDaily = new Map([
      [1, 80],
      [2, 20],
      [3, 10],
    ]);

    const series = buildCumulativeBenchmarkSeries(
      currentDaily,
      benchmarkDaily,
      "2025-09-01",
      "2024-09-01",
      3,
    );

    expect(series).toHaveLength(3);
    expect(series[0]).toMatchObject({
      dayOfSeason: 1,
      currentSeasonRevenue: 100,
      benchmarkSeasonRevenue: 80,
      currentSeasonDate: "2025-09-01",
      benchmarkSeasonDate: "2024-09-01",
    });
    expect(series[2]).toMatchObject({
      dayOfSeason: 3,
      currentSeasonRevenue: 150,
      benchmarkSeasonRevenue: 110,
      currentSeasonDate: "2025-09-03",
      benchmarkSeasonDate: "2024-09-03",
    });
  });

  it("generates axis ticks at 1, weekly steps, and the final day", () => {
    expect(getSeasonDayAxisTicks(1)).toEqual([1]);
    expect(getSeasonDayAxisTicks(20)).toEqual([1, 7, 14, 20]);
    expect(getSeasonDayAxisTicks(21)).toEqual([1, 7, 14, 21]);
  });

  it("downsamples chart data to axis tick days", () => {
    const chartData = buildCumulativeBenchmarkSeries(
      new Map([[1, 10]]),
      new Map([[1, 5]]),
      "2025-09-01",
      "2024-09-01",
      15,
    );

    const sampled = downsampleChartData(chartData);
    expect(sampled.map((point) => point.dayOfSeason)).toEqual([1, 7, 14, 15]);
  });
});

describe("deviation", () => {
  it("calculates absolute and percentage deviation", () => {
    expect(calculateDeviation(120, 100)).toEqual({
      absoluteDeviation: 20,
      percentageDeviation: 20,
    });
    expect(calculateDeviation(80, 100)).toEqual({
      absoluteDeviation: -20,
      percentageDeviation: -20,
    });
  });

  it("returns null percentage when benchmark revenue is zero", () => {
    expect(calculateDeviation(50_000, 0)).toEqual({
      absoluteDeviation: 50_000,
      percentageDeviation: null,
    });
    expect(calculateDeviation(0, 0)).toEqual({
      absoluteDeviation: 0,
      percentageDeviation: null,
    });
  });
});

describe("format helpers", () => {
  it("formats axis ticks and deviation values", () => {
    expect(formatBenchmarkYAxisTick(1_500_000)).toBe("1,5 млн");
    expect(formatDeviationAbsolute(1_250_000)).toBe("+1,3 млн ₽");
    expect(formatDeviationPercent(12.34)).toBe("+12,3%");
    expect(formatDeviationPercent(null)).toBe("Нет базы для сравнения");
  });
});

describe("season-periods", () => {
  it("reports season length in calendar days", () => {
    const season = getSeasonPeriod("2025/26")!;
    expect(getSeasonLengthDays(season)).toBeGreaterThan(200);
    expect(season.status).toBe("active");
  });
});

describe("computeSeasonBenchmark", () => {
  const emptyDashboardFilters = {} as Parameters<typeof computeSeasonBenchmark>[0];

  it("disables full-season mode while the current season is active", () => {
    const ticketFilters = { ...DEFAULT_TICKET_FILTERS, season: "2025/26" };
    const result = computeSeasonBenchmark(
      emptyDashboardFilters,
      ticketFilters,
      "2024/25",
      "current_stage",
    );

    expect(result.canUseFullSeasonMode).toBe(false);
    expect(result.current.status).toBe("active");
  });

  it("enables full-season mode for a completed current season", () => {
    const ticketFilters = { ...DEFAULT_TICKET_FILTERS, season: "2024/25" };
    const result = computeSeasonBenchmark(
      emptyDashboardFilters,
      ticketFilters,
      "2025/26",
      "full_season",
    );

    expect(result.canUseFullSeasonMode).toBe(true);
    expect(result.current.status).toBe("completed");
    expect(getInitialSeasonBenchmarkParams(ticketFilters).mode).toBe("full_season");
  });
});

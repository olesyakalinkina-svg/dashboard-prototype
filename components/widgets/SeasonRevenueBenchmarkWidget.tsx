"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFilterState } from "@/context/FilterContext";
import { ChartScrollContainer } from "@/components/charts/ChartScrollContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  computeSeasonBenchmark,
  formatBenchmarkYAxisTick,
  formatDeviationAbsolute,
  formatDeviationPercent,
  getBenchmarkSeasonOptions,
  getInitialSeasonBenchmarkParams,
  getSeasonDayAxisTicks,
  getSeasonPeriod,
  resolveCurrentSeasonId,
} from "@/lib/season-benchmark";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
} from "@/lib/format";
import { parseLocalDate } from "@/lib/season-benchmark/parse-local-date";
import type {
  SeasonBenchmarkMode,
  SeasonBenchmarkPoint,
  SeasonBenchmarkResult,
} from "@/types/dashboard";

const COLORS = {
  current: "#377EB8",
  benchmark: "#9CA3AF",
};

function BenchmarkTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: SeasonBenchmarkPoint & { dayLabel: string };
  }[];
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const deviation = point.currentSeasonRevenue - point.benchmarkSeasonRevenue;
  const pct =
    point.benchmarkSeasonRevenue === 0
      ? null
      : (deviation / point.benchmarkSeasonRevenue) * 100;

  return (
    <div className="max-w-[280px] rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">
        День сезона {point.dayOfSeason}
      </p>
      <p className="text-[var(--foreground)]">
        {point.currentSeasonDate}: {formatCurrency(point.currentSeasonRevenue)}
      </p>
      <p className="text-[var(--muted)]">
        {point.benchmarkSeasonDate}: {formatCurrency(point.benchmarkSeasonRevenue)}
      </p>
      <p
        className={clsx(
          "mt-1 font-medium",
          deviation > 0
            ? "text-emerald-600"
            : deviation < 0
              ? "text-red-500"
              : "text-[var(--muted)]",
        )}
      >
        {formatDeviationAbsolute(deviation)} ({formatDeviationPercent(pct)})
      </p>
    </div>
  );
}

function DeviationBadge({ result }: { result: SeasonBenchmarkResult }) {
  const { absoluteDeviation, percentageDeviation } = result;

  if (
    result.benchmark.revenueToDate === 0 &&
    result.current.revenueToDate !== 0
  ) {
    return (
      <p className="text-sm font-medium text-[var(--muted)]">
        Нет базы для сравнения
      </p>
    );
  }

  const isPositive = absoluteDeviation > 0;
  const isNeutral = absoluteDeviation === 0;

  return (
    <div className="flex flex-col gap-0.5">
      <p
        className={clsx(
          "text-lg font-semibold sm:text-xl",
          isNeutral
            ? "text-[var(--muted)]"
            : isPositive
              ? "text-emerald-600"
              : "text-red-500",
        )}
      >
        {formatDeviationAbsolute(absoluteDeviation)}
      </p>
      <p
        className={clsx(
          "text-xs font-medium",
          isNeutral
            ? "text-[var(--muted)]"
            : isPositive
              ? "text-emerald-600"
              : "text-red-500",
        )}
      >
        {formatDeviationPercent(percentageDeviation)}
      </p>
    </div>
  );
}

function KpiColumn({
  label,
  seasonName,
  revenue,
  comparisonDate,
  elapsedDays,
  accent,
}: {
  label: string;
  seasonName: string;
  revenue: number;
  comparisonDate: string;
  elapsedDays: number;
  accent?: boolean;
}) {
  const isMobile = useMediaQuery("(max-width: 639px)");

  return (
    <div
      className={clsx(
        "min-w-0 flex-1 rounded-md border border-[var(--border)] p-3",
        accent && "bg-[var(--background)]",
      )}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
        {seasonName}
      </p>
      <p
        className="mt-1 text-lg font-semibold text-[var(--foreground)] sm:text-xl"
        title={formatCurrency(revenue)}
      >
        {isMobile ? formatCurrencyCompact(revenue) : formatCurrency(revenue)}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {comparisonDate
          ? `до ${formatDate(parseLocalDate(comparisonDate))}`
          : "—"}
      </p>
      <p className="text-xs text-[var(--muted)]">день {elapsedDays || "—"}</p>
    </div>
  );
}

export function SeasonRevenueBenchmarkWidget() {
  const { filters, ticketFilters } = useFilterState();
  const isMobile = useMediaQuery("(max-width: 639px)");
  const currentSeasonId = resolveCurrentSeasonId(ticketFilters.season);
  const benchmarkOptions = getBenchmarkSeasonOptions(currentSeasonId);

  const [benchmarkSeasonId, setBenchmarkSeasonId] = useState(() =>
    getInitialSeasonBenchmarkParams(ticketFilters).benchmarkSeasonId,
  );
  const [mode, setMode] = useState<SeasonBenchmarkMode>(
    () => getInitialSeasonBenchmarkParams(ticketFilters).mode,
  );

  // Reset comparison target only when the selected season changes.
  useEffect(() => {
    const { benchmarkSeasonId: nextId, mode: nextMode } =
      getInitialSeasonBenchmarkParams(ticketFilters);
    setBenchmarkSeasonId(nextId);
    setMode(nextMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- season only; other filters must not reset benchmark
  }, [ticketFilters.season]);

  const result = useMemo(() => {
    const effectiveMode =
      getSeasonPeriod(resolveCurrentSeasonId(ticketFilters.season))?.status ===
      "active"
        ? "current_stage"
        : mode;

    return computeSeasonBenchmark(
      filters,
      ticketFilters,
      benchmarkSeasonId,
      effectiveMode,
    );
  }, [filters, ticketFilters, benchmarkSeasonId, mode]);

  const chartData = useMemo(
    () =>
      result.chartData.map((point) => ({
        ...point,
        dayLabel: String(point.dayOfSeason),
        current: point.currentSeasonRevenue,
        benchmark: point.benchmarkSeasonRevenue,
      })),
    [result.chartData],
  );

  const xTicks = useMemo(
    () => getSeasonDayAxisTicks(result.commonComparisonDays),
    [result.commonComparisonDays],
  );

  const chartHeight = isMobile ? 300 : 360;
  const isActiveSeason = result.current.status === "active";

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0 flex-1">
          <CardTitle>Бенчмарк выручки сезона</CardTitle>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {isActiveSeason
              ? "Сравнение на текущую стадию — полный сезон доступен после его завершения"
              : "Сравнение выручки на одинаковой стадии сезонов"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          {result.canUseFullSeasonMode && (
            <div className="time-grouping-toggle flex w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5 sm:w-auto">
              <button
                type="button"
                onClick={() => setMode("current_stage")}
                className={clsx(
                  "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                  mode === "current_stage"
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                На текущую стадию
              </button>
              <button
                type="button"
                onClick={() => setMode("full_season")}
                className={clsx(
                  "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                  mode === "full_season"
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                Весь сезон
              </button>
            </div>
          )}
          <Select
            label="Сравнить с"
            value={benchmarkSeasonId}
            onChange={(event) => setBenchmarkSeasonId(event.target.value)}
            className="min-w-[120px]"
          >
            {benchmarkOptions.map((seasonId) => (
              <option key={seasonId} value={seasonId}>
                {seasonId}
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {result.dateRangeFilterExcluded && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {result.warnings.find((w) => w.includes("Дата покупки"))}
          </p>
        )}

        {result.warnings
          .filter((w) => !w.includes("Дата покупки"))
          .map((warning) => (
            <p
              key={warning}
              className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              {warning}
            </p>
          ))}

        {result.emptyReason ? (
          <div className="flex min-h-[200px] items-center justify-center rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            {result.emptyReason}
          </div>
        ) : (
          <>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiColumn
                label="Текущий сезон"
                seasonName={result.current.seasonName}
                revenue={result.current.revenueToDate}
                comparisonDate={result.current.comparisonDate}
                elapsedDays={result.current.elapsedDays}
                accent
              />
              <KpiColumn
                label="Сезон сравнения"
                seasonName={result.benchmark.seasonName}
                revenue={result.benchmark.revenueToDate}
                comparisonDate={result.benchmark.comparisonDate}
                elapsedDays={result.benchmark.elapsedDays}
              />
              <div className="min-w-0 rounded-md border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--muted)]">Отклонение</p>
                <div className="mt-2">
                  <DeviationBadge result={result} />
                </div>
              </div>
            </div>

            <ChartScrollContainer>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart
                  data={chartData}
                  margin={{
                    top: 8,
                    right: isMobile ? 8 : 16,
                    left: isMobile ? 0 : 4,
                    bottom: isMobile ? 8 : 36,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="dayOfSeason"
                    type="number"
                    domain={[1, result.commonComparisonDays || 1]}
                    ticks={xTicks}
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    tickFormatter={(value) => String(value)}
                    label={
                      isMobile
                        ? undefined
                        : {
                            value: "День сезона",
                            position: "insideBottom",
                            offset: -10,
                            fontSize: 11,
                          }
                    }
                  />
                  <YAxis
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    width={isMobile ? 48 : 56}
                    tickFormatter={formatBenchmarkYAxisTick}
                  />
                  <Tooltip content={<BenchmarkTooltip />} />
                  <Legend
                    iconSize={10}
                    wrapperStyle={{
                      fontSize: isMobile ? 11 : 12,
                      paddingTop: isMobile ? 0 : 12,
                    }}
                    formatter={(value) =>
                      value === "current"
                        ? result.current.seasonName
                        : result.benchmark.seasonName
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    name="current"
                    stroke={COLORS.current}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    name="benchmark"
                    stroke={COLORS.benchmark}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartScrollContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

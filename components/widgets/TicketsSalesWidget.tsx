"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartZoomHint,
  ChartZoomReferenceArea,
  ChartZoomResetButton,
  CHART_ZOOM_SURFACE_CLASS,
} from "@/components/charts/ChartZoom";
import {
  getMerchTrendPeriodLabel,
  getMerchTrendXAxisProps,
} from "@/components/widgets/Charts";
import { useChartAreaZoom } from "@/hooks/useChartAreaZoom";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { periodKeyAndSort } from "@/lib/filters";
import {
  isNoMatchesFilterValue,
  SEASON_OPTIONS,
} from "@/lib/ticket-filter-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  League,
  TicketFilters,
  TicketMatchCumulativeSeries,
  TimeGrouping,
} from "@/types/dashboard";

type SalesTab = "revenue" | "tickets";
type SeasonScope = (typeof SEASON_OPTIONS)[number]["value"];

const SALES_TABS: { id: SalesTab; label: string }[] = [
  { id: "revenue", label: "Выручка" },
  { id: "tickets", label: "Билеты" },
];

const TIME_GROUPING_OPTIONS: { value: TimeGrouping; label: string }[] = [
  { value: "day", label: "Дни" },
  { value: "week", label: "Недели" },
  { value: "month", label: "Месяцы" },
];

const CURRENT_SEASON = "2025/26";
const TOOLTIP_LIMIT = 6;
const SEASON_PLAN_KEY = "seasonPlan";
const SEASON_PLAN_COLOR = "#64748B";
const PLAN_LINE_DASH = "6 4";
const CHART_SCROLL_POINT_WIDTH = 48;
const CHART_MIN_WIDTH = 320;
const CONTRAST_LINE_COLORS = [
  "#E41A1C",
  "#377EB8",
  "#4DAF4A",
  "#984EA3",
  "#FF7F00",
  "#00BFC5",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
  "#6366F1",
  "#EF4444",
  "#22C55E",
  "#A855F7",
  "#0EA5E9",
  "#D95F02",
  "#7570B3",
  "#E7298A",
  "#66A61E",
  "#E6AB02",
];

const LEAGUE_LABELS: Record<League, string> = {
  KHL: "КХЛ",
  VHL: "ВХЛ",
  MHL: "МХЛ",
};

function getContrastingLineColor(index: number): string {
  return CONTRAST_LINE_COLORS[index % CONTRAST_LINE_COLORS.length];
}

function isSingleSeasonSelected(
  ticketFilters: TicketFilters,
  showSeasonScope: boolean,
  seasonScope: SeasonScope,
  series: TicketMatchCumulativeSeries[],
): boolean {
  if (ticketFilters.season !== "all") return true;
  if (showSeasonScope && seasonScope !== "all") return true;
  return new Set(series.map((item) => item.season)).size <= 1;
}

function isSingleLeagueSelected(
  ticketFilters: TicketFilters,
  series: TicketMatchCumulativeSeries[],
): boolean {
  if (ticketFilters.league !== "all") return true;
  return new Set(series.map((item) => item.league)).size <= 1;
}

function applyContrastColors(
  items: TicketMatchCumulativeSeries[],
): TicketMatchCumulativeSeries[] {
  return items.map((item, index) => ({
    ...item,
    color: getContrastingLineColor(index),
  }));
}

function factKey(matchId: string): string {
  return `${matchId}_fact`;
}

function planKey(matchId: string): string {
  return `${matchId}_plan`;
}

function planPointKey(matchId: string): string {
  return `${matchId}_planPoint`;
}

function isPlanOnlyMatch(item: TicketMatchCumulativeSeries): boolean {
  return !item.eventCompleted && !item.hasFactSales;
}

function getYDomainValueKeys(series: TicketMatchCumulativeSeries[]): string[] {
  const factKeys = series
    .filter((item) => !isPlanOnlyMatch(item))
    .map((item) => factKey(item.matchId));

  if (factKeys.length > 0) {
    return factKeys;
  }

  return series
    .filter((item) => isPlanOnlyMatch(item))
    .map((item) => planPointKey(item.matchId));
}

function getSingleMatchYDomainKeys(
  match: TicketMatchCumulativeSeries,
): string[] {
  if (match.eventCompleted || match.hasFactSales) {
    return ["fact", "plan"];
  }

  return ["plan", "planPoint"];
}

type DateChartRow = {
  dateKey: number;
  sortKey: number;
  periodLabel: string;
  [key: string]: string | number | null;
};

function formatSaleDateLabel(dateKey: number): string {
  return format(new Date(dateKey), "dd.MM.yy");
}

function getPeriodLabelFromSortKey(
  sortKey: number,
  timeGrouping: TimeGrouping,
): string {
  if (timeGrouping === "day") {
    return formatSaleDateLabel(sortKey);
  }

  const { period } = periodKeyAndSort(new Date(sortKey), timeGrouping);
  return getMerchTrendPeriodLabel({ period, sortKey }, timeGrouping);
}

function getSalesPointPeriod(
  dateKey: number,
  timeGrouping: TimeGrouping,
): { sortKey: number; periodLabel: string } {
  if (timeGrouping === "day") {
    return {
      sortKey: dateKey,
      periodLabel: formatSaleDateLabel(dateKey),
    };
  }

  const { period, sortKey } = periodKeyAndSort(new Date(dateKey), timeGrouping);
  return {
    sortKey,
    periodLabel: getMerchTrendPeriodLabel({ period, sortKey }, timeGrouping),
  };
}

function buildDailyMultiMatchChartData(
  series: TicketMatchCumulativeSeries[],
  mode: SalesTab,
): DateChartRow[] {
  const dateKeys = new Set<number>();

  for (const item of series) {
    for (const point of item.points) {
      dateKeys.add(point.dateKey);
    }
  }

  return [...dateKeys]
    .sort((left, right) => left - right)
    .map((dateKey) => {
      const periodLabel = formatSaleDateLabel(dateKey);
      const row: DateChartRow = {
        dateKey,
        sortKey: dateKey,
        periodLabel,
      };

      for (const item of series) {
        const point = item.points.find((entry) => entry.dateKey === dateKey);
        if (!point) {
          row[factKey(item.matchId)] = null;
          row[planKey(item.matchId)] = null;
          row[planPointKey(item.matchId)] = null;
          continue;
        }

        row[factKey(item.matchId)] =
          mode === "revenue" ? point.revenue : point.tickets;
        row[planKey(item.matchId)] =
          mode === "revenue" ? point.planRevenue : point.planTickets;
        row[planPointKey(item.matchId)] =
          point.daysBeforeMatch === 0
            ? mode === "revenue"
              ? item.planRevenue
              : item.planTickets
            : null;
      }

      return row;
    });
}

function aggregateSingleMatchRowsByTimeGrouping(
  rows: DateChartRow[],
  timeGrouping: TimeGrouping,
): DateChartRow[] {
  if (timeGrouping === "day") {
    return rows;
  }

  const periodGroups = new Map<number, DateChartRow[]>();

  for (const row of rows) {
    const { sortKey } = getSalesPointPeriod(row.dateKey, timeGrouping);
    const group = periodGroups.get(sortKey) ?? [];
    group.push(row);
    periodGroups.set(sortKey, group);
  }

  return [...periodGroups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([sortKey, groupRows]) => {
      const latestRow = groupRows.reduce((latest, row) =>
        row.dateKey > latest.dateKey ? row : latest,
      );
      const periodLabel = getPeriodLabelFromSortKey(sortKey, timeGrouping);

      return {
        ...latestRow,
        sortKey,
        periodLabel,
      };
    });
}

function aggregateMultiMatchRowsByTimeGrouping(
  rows: DateChartRow[],
  series: TicketMatchCumulativeSeries[],
  timeGrouping: TimeGrouping,
): DateChartRow[] {
  if (timeGrouping === "day") {
    return rows;
  }

  const periodSortKeys = new Set<number>();
  for (const row of rows) {
    periodSortKeys.add(getSalesPointPeriod(row.dateKey, timeGrouping).sortKey);
  }

  const valueKeys: string[] = [SEASON_PLAN_KEY];
  for (const item of series) {
    valueKeys.push(factKey(item.matchId));
    valueKeys.push(planKey(item.matchId));
    valueKeys.push(planPointKey(item.matchId));
  }

  return [...periodSortKeys]
    .sort((left, right) => left - right)
    .map((sortKey) => {
      const periodLabel = getPeriodLabelFromSortKey(sortKey, timeGrouping);
      const rowsInPeriod = rows.filter(
        (row) =>
          getSalesPointPeriod(row.dateKey, timeGrouping).sortKey === sortKey,
      );
      const maxDateKey = Math.max(...rowsInPeriod.map((row) => row.dateKey));
      const aggregated: DateChartRow = {
        dateKey: maxDateKey,
        sortKey,
        periodLabel,
      };

      for (const key of valueKeys) {
        let bestValue: string | number | null = null;
        let bestDateKey = -1;

        for (const row of rowsInPeriod) {
          const value = row[key];
          if (value != null && row.dateKey >= bestDateKey) {
            bestValue = value;
            bestDateKey = row.dateKey;
          }
        }

        aggregated[key] = bestValue;
      }

      return aggregated;
    });
}

function aggregateChartRowsByTimeGrouping(
  rows: DateChartRow[],
  timeGrouping: TimeGrouping,
): DateChartRow[] {
  return aggregateSingleMatchRowsByTimeGrouping(rows, timeGrouping);
}

function buildMultiMatchChartData(
  series: TicketMatchCumulativeSeries[],
  mode: SalesTab,
  timeGrouping: TimeGrouping,
): DateChartRow[] {
  const dailyRows = buildDailyMultiMatchChartData(series, mode);
  return aggregateMultiMatchRowsByTimeGrouping(dailyRows, series, timeGrouping);
}

function computeSeasonDailyPlanTotals(
  series: TicketMatchCumulativeSeries[],
  mode: SalesTab,
): Map<number, number> {
  const dailyTotals = new Map<number, number>();

  for (const item of series) {
    const sorted = [...item.points].sort((left, right) => left.dateKey - right.dateKey);
    let prevPlan = 0;

    for (const point of sorted) {
      const plan = mode === "revenue" ? point.planRevenue : point.planTickets;
      const daily = plan - prevPlan;

      if (daily > 0) {
        dailyTotals.set(
          point.dateKey,
          (dailyTotals.get(point.dateKey) ?? 0) + daily,
        );
      }

      prevPlan = plan;
    }
  }

  return dailyTotals;
}

function mergeSeasonPlanIntoChartData(
  chartData: DateChartRow[],
  series: TicketMatchCumulativeSeries[],
  mode: SalesTab,
): DateChartRow[] {
  const dailyTotals = computeSeasonDailyPlanTotals(series, mode);
  const sortedDailyKeys = [...dailyTotals.keys()].sort((left, right) => left - right);

  let running = 0;
  let dailyIdx = 0;

  return chartData.map((row) => {
    while (
      dailyIdx < sortedDailyKeys.length &&
      sortedDailyKeys[dailyIdx] <= row.dateKey
    ) {
      running += dailyTotals.get(sortedDailyKeys[dailyIdx]) ?? 0;
      dailyIdx += 1;
    }

    return {
      ...row,
      [SEASON_PLAN_KEY]: running > 0 ? Math.round(running) : null,
    };
  });
}

function buildDailySingleMatchChartData(
  match: TicketMatchCumulativeSeries,
  mode: SalesTab,
): DateChartRow[] {
  const planTotal = mode === "revenue" ? match.planRevenue : match.planTickets;

  return [...match.points]
    .sort((left, right) => left.dateKey - right.dateKey)
    .map((point) => ({
      dateKey: point.dateKey,
      sortKey: point.dateKey,
      periodLabel: formatSaleDateLabel(point.dateKey),
      fact:
        mode === "revenue"
          ? point.revenue
          : point.tickets,
      plan: mode === "revenue" ? point.planRevenue : point.planTickets,
      planPoint: point.daysBeforeMatch === 0 ? planTotal : null,
    }));
}

function buildSingleMatchChartData(
  match: TicketMatchCumulativeSeries,
  mode: SalesTab,
  timeGrouping: TimeGrouping,
): DateChartRow[] {
  const dailyRows = buildDailySingleMatchChartData(match, mode);
  return aggregateChartRowsByTimeGrouping(dailyRows, timeGrouping);
}

function SingleMatchFactDot({
  cx,
  cy,
  payload,
  color,
}: {
  cx?: number;
  cy?: number;
  payload?: { fact?: number | null };
  color: string;
}) {
  if (cx == null || cy == null || payload?.fact == null) return null;

  return <circle cx={cx} cy={cy} r={3} fill={color} />;
}

function MatchPlanDot({
  cx,
  cy,
  payload,
  color,
  dataKey,
}: {
  cx?: number;
  cy?: number;
  payload?: Record<string, number | null | undefined>;
  color: string;
  dataKey: string;
}) {
  if (cx == null || cy == null || payload?.[dataKey] == null) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={10}
      fill="#fff"
      stroke={color}
      strokeWidth={3}
    />
  );
}

function getDateChartMargin(compact: boolean) {
  return {
    top: 12,
    right: 16,
    left: 0,
    bottom: 8,
  };
}

function getSalesChartXAxisProps(
  timeGrouping: TimeGrouping,
  compact: boolean,
) {
  if (timeGrouping === "day") {
    return {
      dataKey: "periodLabel" as const,
      tick: { fontSize: 10, fill: "#8B8B8E" },
      tickMargin: 6,
      interval: compact ? ("preserveStartEnd" as const) : (0 as const),
      angle: compact ? -35 : 0,
      textAnchor: compact ? ("end" as const) : ("middle" as const),
      height: compact ? 52 : 32,
      minTickGap: compact ? 8 : 16,
      label: {
        value: "Дата",
        position: "insideBottom" as const,
        offset: compact ? 2 : 0,
        style: { fontSize: 11, fill: "#8B8B8E", fontWeight: 500 },
      },
    };
  }

  return {
    ...getMerchTrendXAxisProps(timeGrouping),
    dataKey: "periodLabel" as const,
  };
}

function getCurrentPoint(
  item: TicketMatchCumulativeSeries,
  mode: SalesTab,
): { fact: number; plan: number } | null {
  if (item.currentDaysBeforeMatch == null) return null;
  const point = item.points.find(
    (p) => p.daysBeforeMatch === item.currentDaysBeforeMatch,
  );
  if (!point) return null;

  const fact = mode === "revenue" ? point.revenue : point.tickets;
  const plan = mode === "revenue" ? point.planRevenue : point.planTickets;
  if (fact == null) return null;

  return { fact, plan };
}

function findNextUpcomingMatch(
  series: TicketMatchCumulativeSeries[],
): TicketMatchCumulativeSeries | null {
  const upcoming = series
    .filter((s) => !s.eventCompleted && s.currentDaysBeforeMatch != null)
    .sort((a, b) => a.matchDateKey - b.matchDateKey);

  return upcoming[0] ?? null;
}

function getSingleSelectedMatchId(matchIds: string[]): string | null {
  if (matchIds.length !== 1 || isNoMatchesFilterValue(matchIds)) {
    return null;
  }
  return matchIds[0];
}

function getMatchProgress(
  item: TicketMatchCumulativeSeries,
  mode: SalesTab,
): {
  fact: number;
  planAtNow: number;
  planTotal: number;
  isUpcoming: boolean;
} {
  const planTotal = mode === "revenue" ? item.planRevenue : item.planTickets;

  if (item.currentDaysBeforeMatch != null) {
    const current = getCurrentPoint(item, mode);
    return {
      fact: current?.fact ?? 0,
      planAtNow: current?.plan ?? 0,
      planTotal,
      isUpcoming: true,
    };
  }

  const endPoint = item.points.find((point) => point.daysBeforeMatch === 0);
  const fact =
    mode === "revenue" ? endPoint?.revenue : endPoint?.tickets;

  return {
    fact: fact ?? 0,
    planAtNow: planTotal,
    planTotal,
    isUpcoming: false,
  };
}

function SelectedMatchSummary({
  match,
  mode,
}: {
  match: TicketMatchCumulativeSeries;
  mode: SalesTab;
}) {
  const progress = getMatchProgress(match, mode);
  const isRevenue = mode === "revenue";
  const factLabel = isRevenue
    ? formatCurrency(progress.fact)
    : `${formatNumber(progress.fact)} шт`;
  const planLabel = isRevenue
    ? formatCurrency(progress.planTotal)
    : `${formatNumber(progress.planTotal)} шт`;
  const pct =
    progress.planTotal > 0
      ? (progress.fact / progress.planTotal) * 100
      : 0;
  const statusLabel = progress.isUpcoming
    ? match.currentDaysBeforeMatch === 0
      ? "сегодня матч"
      : `осталось ${match.currentDaysBeforeMatch} дн.`
    : "матч завершён";

  return (
    <div className="mb-3 rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--foreground)]">
        {LEAGUE_LABELS[match.league]} · {match.label}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
        {statusLabel} · факт {factLabel} / план {planLabel} ({formatPercent(pct)})
      </p>
      <p className="mt-1 text-[10px] text-[var(--muted)]">
        Сплошная линия — факт, пунктир — план. Кольцо в дату матча — плановая
        цель продаж.
      </p>
    </div>
  );
}

function SingleMatchFocusTooltip({
  active,
  payload,
  label,
  match,
  mode,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color?: string }[];
  label?: string;
  match: TicketMatchCumulativeSeries;
  mode: SalesTab;
}) {
  if (!active || label == null) return null;

  const formatter =
    mode === "revenue"
      ? formatCurrency
      : (value: number) => `${formatNumber(value)} шт`;
  const planTotal =
    mode === "revenue" ? match.planRevenue : match.planTickets;
  const factEntry = payload?.find((entry) => entry.name === "Факт");
  const planLineEntry = payload?.find((entry) => entry.name === "План");
  const planPointEntry = payload?.find((entry) => entry.name === "План (цель)");
  const fact = factEntry?.value;
  const planAtDate = planLineEntry?.value;
  const pct =
    fact != null && planAtDate != null && planAtDate > 0
      ? (fact / planAtDate) * 100
      : planTotal > 0 && fact != null
        ? (fact / planTotal) * 100
        : 0;

  if (planPointEntry?.value != null) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
        {fact != null && (
          <p style={{ color: factEntry?.color }}>
            Факт: {formatter(fact)} ({formatPercent(pct)} от плана)
          </p>
        )}
        <p style={{ color: SEASON_PLAN_COLOR }}>
          План матча: {formatter(planTotal)}
        </p>
      </div>
    );
  }

  if (planAtDate != null && fact != null) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
        <p style={{ color: factEntry?.color }}>
          Факт: {formatter(fact)} ({formatPercent(pct)} от плана)
        </p>
        <p style={{ color: SEASON_PLAN_COLOR }}>
          План: {formatter(planAtDate)}
        </p>
      </div>
    );
  }

  if (planAtDate != null) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
        <p style={{ color: SEASON_PLAN_COLOR }}>
          План: {formatter(planAtDate)}
        </p>
      </div>
    );
  }

  if (!payload?.length) return null;

  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
      {fact != null && (
        <p style={{ color: factEntry?.color }}>
          Факт: {formatter(fact)}
          {planTotal > 0 ? ` (${formatPercent(pct)} от плана матча)` : ""}
        </p>
      )}
    </div>
  );
}

function SingleMatchFocusChart({
  match,
  mode,
  timeGrouping,
  chartHeight,
  onZoomStateChange,
}: {
  match: TicketMatchCumulativeSeries;
  mode: SalesTab;
  timeGrouping: TimeGrouping;
  chartHeight: number;
  onZoomStateChange?: (control: ChartZoomControl | null) => void;
}) {
  const chartData = useMemo(
    () => buildSingleMatchChartData(match, mode, timeGrouping),
    [match, mode, timeGrouping],
  );
  const yDomainKeys = useMemo(
    () => getSingleMatchYDomainKeys(match),
    [match],
  );
  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(chartData, yDomainKeys, [match, mode, timeGrouping], {
    xKey: "periodLabel",
  });

  useEffect(() => {
    onZoomStateChange?.({ isZoomed, resetZoom });
    return () => onZoomStateChange?.(null);
  }, [isZoomed, resetZoom, onZoomStateChange]);
  const isRevenue = mode === "revenue";
  const compactAxis = displayData.length > 8;
  const todayPoint =
    match.currentDaysBeforeMatch != null
      ? match.points.find(
          (point) => point.daysBeforeMatch === match.currentDaysBeforeMatch,
        )
      : null;

  const chartWidth = getScrollableChartWidth(displayData.length);

  return (
    <div className={clsx("relative h-full", CHART_ZOOM_SURFACE_CLASS)}>
      <ResponsiveContainer width={chartWidth} height={chartHeight}>
        <LineChart
          data={displayData}
          margin={getDateChartMargin(compactAxis)}
          {...chartHandlers}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
          <XAxis {...getSalesChartXAxisProps(timeGrouping, compactAxis)} />
          <YAxis {...getYAxisProps(yDomain, isRevenue, 52)} />
          <Tooltip
            content={<SingleMatchFocusTooltip match={match} mode={mode} />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
          />
          <ChartZoomReferenceArea selectionArea={selectionArea} />
          {todayPoint && todayPoint.daysBeforeMatch > 0 && (
            <ReferenceLine
              x={
                getSalesPointPeriod(todayPoint.dateKey, timeGrouping).periodLabel
              }
              stroke="#8B8B8E"
              strokeDasharray="4 4"
              label={{
                value: "Сегодня",
                position: "insideTopRight",
                fill: "#8B8B8E",
                fontSize: 10,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="plan"
            name="План"
            stroke={SEASON_PLAN_COLOR}
            strokeWidth={2}
            strokeDasharray={PLAN_LINE_DASH}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {(match.eventCompleted || match.hasFactSales) && (
            <Line
              type="monotone"
              dataKey="fact"
              name="Факт"
              stroke={match.color}
              strokeWidth={2.5}
              dot={({ key, ...props }) => (
                <SingleMatchFactDot key={key} {...props} color={match.color} />
              )}
              activeDot={{ r: 5, fill: match.color, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="planPoint"
            name="План (цель)"
            stroke="none"
            legendType="none"
            dot={({ key, ...props }) => (
              <MatchPlanDot
                key={key}
                {...props}
                color={match.color}
                dataKey="planPoint"
              />
            )}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function getYAxisTickFormatter(isRevenue: boolean) {
  return (value: number) =>
    isRevenue
      ? value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M`
        : value >= 1_000
          ? `${Math.round(value / 1_000)}K`
          : String(value)
      : formatNumber(value);
}

function getYAxisProps(
  domain: [number, number],
  isRevenue: boolean,
  width: number,
) {
  return {
    domain,
    allowDecimals: false,
    tick: { fontSize: 11, fill: "#8B8B8E" },
    width,
    tickFormatter: getYAxisTickFormatter(isRevenue),
  };
}

function getScrollableChartWidth(pointCount: number): number {
  return Math.max(pointCount * CHART_SCROLL_POINT_WIDTH, CHART_MIN_WIDTH);
}

function shouldShowFactDots(timeGrouping: TimeGrouping): boolean {
  // Sparse calendar timelines can collapse to isolated points when dots are off.
  return true;
}

function UpcomingMatchSummary({
  match,
  mode,
}: {
  match: TicketMatchCumulativeSeries;
  mode: SalesTab;
}) {
  const current = getCurrentPoint(match, mode);
  if (!current) return null;

  const isRevenue = mode === "revenue";
  const factLabel = isRevenue
    ? formatCurrency(current.fact)
    : `${formatNumber(current.fact)} шт`;
  const planLabel = isRevenue
    ? formatCurrency(current.plan)
    : `${formatNumber(current.plan)} шт`;
  const pct =
    current.plan > 0 ? (current.fact / current.plan) * 100 : 0;
  const daysLabel =
    match.currentDaysBeforeMatch === 0
      ? "сегодня матч"
      : `осталось ${match.currentDaysBeforeMatch} дн.`;

  return (
    <div className="mb-3 rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--foreground)]">
        Ближайший матч · {LEAGUE_LABELS[match.league]} · {match.label}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
        {daysLabel} · факт {factLabel} / план {planLabel} ({formatPercent(pct)})
      </p>
    </div>
  );
}

type ChartZoomControl = {
  isZoomed: boolean;
  resetZoom: () => void;
};

type TooltipEntry = {
  matchId: string;
  label: string;
  color: string;
  fact: number | null;
  plan: number;
  date: string;
  planOnly: boolean;
};

function findPointForPeriodLabel(
  item: TicketMatchCumulativeSeries,
  periodLabel: string,
  timeGrouping: TimeGrouping,
) {
  const matchingPoints = item.points.filter(
    (entry) =>
      getSalesPointPeriod(entry.dateKey, timeGrouping).periodLabel ===
      periodLabel,
  );

  if (matchingPoints.length === 0) {
    return undefined;
  }

  return matchingPoints.reduce((latest, point) =>
    point.dateKey > latest.dateKey ? point : latest,
  );
}

function MatchSeriesTooltip({
  active,
  payload,
  label,
  series,
  mode,
  timeGrouping,
  showSeasonPlan,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number | null; color?: string }[];
  label?: string;
  series: TicketMatchCumulativeSeries[];
  mode: SalesTab;
  timeGrouping: TimeGrouping;
  showSeasonPlan?: boolean;
}) {
  if (!active || !payload?.length || label == null) return null;

  const periodLabel = String(label);
  const formatter =
    mode === "revenue"
      ? formatCurrency
      : (v: number) => `${formatNumber(v)} шт`;

  const seasonPlanValue =
    showSeasonPlan
      ? payload.find((entry) => entry.dataKey === SEASON_PLAN_KEY)?.value
      : null;

  const entries: TooltipEntry[] = [];

  for (const item of series) {
    const point = findPointForPeriodLabel(item, periodLabel, timeGrouping);
    if (!point) continue;

    const fact = mode === "revenue" ? point.revenue : point.tickets;
    const plan = mode === "revenue" ? point.planRevenue : point.planTickets;
    const planOnly = isPlanOnlyMatch(item);

    if (!planOnly && fact == null) continue;
    if (planOnly && point.daysBeforeMatch !== 0) continue;

    entries.push({
      matchId: item.matchId,
      label: `${LEAGUE_LABELS[item.league]} · ${item.label}`,
      color: item.color,
      fact,
      plan: planOnly
        ? mode === "revenue"
          ? item.planRevenue
          : item.planTickets
        : plan,
      date: point.date,
      planOnly,
    });
  }

  entries.sort((a, b) => (b.fact ?? 0) - (a.fact ?? 0));
  if (entries.length === 0 && seasonPlanValue == null) return null;

  const visibleEntries = entries.slice(0, TOOLTIP_LIMIT);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{periodLabel}</p>
      {visibleEntries.map((entry) => {
        if (entry.planOnly) {
          return (
            <p key={entry.matchId} style={{ color: entry.color }}>
              {entry.label}: план {formatter(entry.plan)}
            </p>
          );
        }

        const pct = entry.plan > 0 ? ((entry.fact ?? 0) / entry.plan) * 100 : 0;
        return (
          <p key={entry.matchId} style={{ color: entry.color }}>
            {entry.label}: {formatter(entry.fact ?? 0)} / {formatter(entry.plan)} (
            {formatPercent(pct)})
          </p>
        );
      })}
      {hiddenCount > 0 && (
        <p className="mt-1 text-[var(--muted)]">и ещё {hiddenCount}</p>
      )}
      {seasonPlanValue != null && (
        <p
          className={clsx(
            entries.length > 0 && "mt-1 border-t border-[var(--border)] pt-1",
            "text-[var(--muted)]",
          )}
        >
          <span
            className="mr-1 inline-block h-0 w-3 border-t-2 border-dashed align-middle"
            style={{ borderColor: SEASON_PLAN_COLOR }}
          />
          План сезона: {formatter(seasonPlanValue)}
        </p>
      )}
    </div>
  );
}

function ChartScopeControls({
  seasonScope,
  showSeasonScope,
  onSeasonScopeChange,
}: {
  seasonScope: SeasonScope;
  showSeasonScope: boolean;
  onSeasonScopeChange: (scope: SeasonScope) => void;
}) {
  if (!showSeasonScope) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5">
        {SEASON_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSeasonScopeChange(option.value)}
            className={clsx(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              seasonScope === option.value
                ? "bg-white text-[var(--accent)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChartLegend({
  series,
  hiddenSeries,
  hoveredSeries,
  onToggleSeries,
  onHoverSeries,
  showSeasonPlan,
}: {
  series: TicketMatchCumulativeSeries[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  onToggleSeries: (matchId: string) => void;
  onHoverSeries: (matchId: string | null) => void;
  showSeasonPlan?: boolean;
}) {
  if (series.length === 0) return null;

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="mb-2 text-[11px] text-[var(--muted)]">
        Каждая линия — отдельный матч. Сплошная линия — факт
        {showSeasonPlan ? ", серый пунктир — план сезона" : ", пунктир — план"}.
        Кольцо — план (продажи ещё не начались).{" "}
        Нажмите на матч, чтобы скрыть. Наведите для подсветки.
      </p>
      {showSeasonPlan && (
        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
          <span
            className="h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: SEASON_PLAN_COLOR }}
          />
          <span>План</span>
        </div>
      )}
      <div className="max-h-28 overflow-y-auto">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {series.map((item) => {
            const isHidden = hiddenSeries.has(item.matchId);
            const isHovered = hoveredSeries === item.matchId;
            const isPreviousSeason = item.season !== CURRENT_SEASON;
            const isUpcoming = !item.eventCompleted;
            const planOnly = isPlanOnlyMatch(item);

            return (
              <button
                key={item.matchId}
                type="button"
                onClick={() => onToggleSeries(item.matchId)}
                onMouseEnter={() => onHoverSeries(item.matchId)}
                onMouseLeave={() => onHoverSeries(null)}
                className={clsx(
                  "inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[10px] transition-opacity",
                  isHidden && "opacity-40",
                  isHovered && "bg-[var(--background)]",
                  isUpcoming && !isHidden && "font-medium",
                )}
              >
                <span className="flex shrink-0 items-center gap-0.5">
                  {planOnly ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border-2 bg-white"
                      style={{
                        borderColor: item.color,
                        opacity: isPreviousSeason ? 0.7 : 1,
                      }}
                    />
                  ) : (
                    <span
                      className="h-0.5 w-3 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        opacity: isPreviousSeason ? 0.7 : 1,
                      }}
                    />
                  )}
                </span>
                <span
                  className={clsx(
                    "truncate",
                    isHidden && "line-through",
                    isPreviousSeason && "text-[var(--muted)]",
                    isUpcoming && "text-[var(--foreground)]",
                  )}
                >
                  {item.label}
                  {isPreviousSeason ? ` · ${item.season}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchCumulativeChart({
  series,
  mode,
  timeGrouping,
  hiddenSeries,
  hoveredSeries,
  showSeasonPlan,
  chartHeight,
  onZoomStateChange,
}: {
  series: TicketMatchCumulativeSeries[];
  mode: SalesTab;
  timeGrouping: TimeGrouping;
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  showSeasonPlan?: boolean;
  chartHeight: number;
  onZoomStateChange?: (control: ChartZoomControl | null) => void;
}) {
  const visibleSeries = useMemo(
    () => series.filter((item) => !hiddenSeries.has(item.matchId)),
    [series, hiddenSeries],
  );

  const chartData = useMemo(() => {
    const rows = buildMultiMatchChartData(visibleSeries, mode, timeGrouping);
    return showSeasonPlan
      ? mergeSeasonPlanIntoChartData(rows, visibleSeries, mode)
      : rows;
  }, [visibleSeries, mode, timeGrouping, showSeasonPlan]);

  const yDomainKeys = useMemo(
    () => getYDomainValueKeys(visibleSeries),
    [visibleSeries],
  );

  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(chartData, yDomainKeys, [
    visibleSeries,
    mode,
    timeGrouping,
    showSeasonPlan,
  ], {
    xKey: "periodLabel",
  });

  useEffect(() => {
    onZoomStateChange?.({ isZoomed, resetZoom });
    return () => onZoomStateChange?.(null);
  }, [isZoomed, resetZoom, onZoomStateChange]);

  const chartWidth = getScrollableChartWidth(displayData.length);
  const isRevenue = mode === "revenue";

  if (series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Нет матчей по выбранным фильтрам
      </div>
    );
  }

  if (visibleSeries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Все линии скрыты. Выберите матч в легенде ниже.
      </div>
    );
  }

  return (
    <div className="h-full min-w-0 overflow-x-auto overflow-y-hidden">
      <div
        className={clsx("relative", CHART_ZOOM_SURFACE_CLASS)}
        style={{ width: chartWidth, minWidth: chartWidth, height: chartHeight }}
      >
        <ResponsiveContainer width={chartWidth} height={chartHeight}>
          <LineChart
            data={displayData}
            margin={getDateChartMargin(false)}
            {...chartHandlers}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
            <XAxis
              {...getSalesChartXAxisProps(timeGrouping, false)}
              interval={timeGrouping === "day" ? 0 : undefined}
              minTickGap={
                timeGrouping === "day" ? CHART_SCROLL_POINT_WIDTH - 8 : undefined
              }
            />
            <YAxis {...getYAxisProps(yDomain, isRevenue, 48)} />
            <Tooltip
              content={
                <MatchSeriesTooltip
                  series={visibleSeries}
                  mode={mode}
                  timeGrouping={timeGrouping}
                  showSeasonPlan={showSeasonPlan}
                />
              }
            />
            <ChartZoomReferenceArea selectionArea={selectionArea} />
            {showSeasonPlan && (
              <Line
                type="monotone"
                dataKey={SEASON_PLAN_KEY}
                name="План"
                stroke={SEASON_PLAN_COLOR}
                strokeWidth={2}
                strokeDasharray={PLAN_LINE_DASH}
                dot={false}
                connectNulls
                isAnimationActive={false}
                opacity={hoveredSeries != null ? 0.35 : 1}
              />
            )}
            {visibleSeries.flatMap((item) => {
              const isPreviousSeason = item.season !== CURRENT_SEASON;
              const isUpcoming = !item.eventCompleted;
              const isHovered = hoveredSeries === item.matchId;
              const isDimmed = hoveredSeries != null && !isHovered;
              const planOnly = isPlanOnlyMatch(item);
              const fKey = factKey(item.matchId);
              const pKey = planKey(item.matchId);
              const pPointKey = planPointKey(item.matchId);
              const lineOpacity = isDimmed ? 0.12 : isPreviousSeason ? 0.55 : 1;
              const dotRadius = timeGrouping === "day" ? 2 : 4;

              if (planOnly) {
                return [
                  <Line
                    key={`${item.matchId}-plan-point`}
                    type="monotone"
                    dataKey={pPointKey}
                    name={item.label}
                    stroke="none"
                    dot={({ key, ...props }) => (
                      <MatchPlanDot
                        key={key}
                        {...props}
                        color={item.color}
                        dataKey={pPointKey}
                      />
                    )}
                    activeDot={{
                      r: 12,
                      fill: "#fff",
                      stroke: item.color,
                      strokeWidth: 3,
                    }}
                    connectNulls={false}
                    isAnimationActive={false}
                    opacity={lineOpacity}
                  />,
                ];
              }

              const lines = [
                <Line
                  key={`${item.matchId}-fact`}
                  type="monotone"
                  dataKey={fKey}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={isHovered ? 2.5 : isUpcoming ? 2 : 1.5}
                  strokeOpacity={
                    isDimmed ? 0.12 : isPreviousSeason ? 0.55 : isUpcoming ? 1 : 0.9
                  }
                  dot={
                    shouldShowFactDots(timeGrouping)
                      ? { r: dotRadius, fill: item.color, strokeWidth: 0 }
                      : false
                  }
                  connectNulls
                  isAnimationActive={false}
                />,
              ];

              if (!showSeasonPlan) {
                lines.unshift(
                  <Line
                    key={`${item.matchId}-plan`}
                    type="monotone"
                    dataKey={pKey}
                    name={item.label}
                    stroke={item.color}
                    strokeWidth={isHovered ? 2 : 1.5}
                    strokeDasharray={PLAN_LINE_DASH}
                    strokeOpacity={
                      isDimmed ? 0.12 : isPreviousSeason ? 0.45 : 0.75
                    }
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                    legendType="none"
                  />,
                );
              }

              return lines;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TicketsSalesWidget({
  series,
  ticketFilters,
}: {
  series: TicketMatchCumulativeSeries[];
  ticketFilters: TicketFilters;
}) {
  // Calendar-date multi-match curves need day granularity; month/week collapse
  // short sales windows to a single point and lines won't render without dots.
  const [chartTimeGrouping, setChartTimeGrouping] =
    useState<TimeGrouping>("day");
  const timeGrouping = chartTimeGrouping;
  const [activeTab, setActiveTab] = useState<SalesTab>("revenue");
  const [seasonScope, setSeasonScope] = useState<SeasonScope>(CURRENT_SEASON);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  const [chartZoomControl, setChartZoomControl] = useState<ChartZoomControl | null>(
    null,
  );

  const hasMultipleSeasons = useMemo(
    () => new Set(series.map((item) => item.season)).size > 1,
    [series],
  );

  const showSeasonScope =
    ticketFilters.season === "all" && hasMultipleSeasons;

  const filteredSeries = useMemo(() => {
    return series.filter((item) => {
      if (showSeasonScope && seasonScope !== "all" && item.season !== seasonScope) {
        return false;
      }
      return true;
    });
  }, [series, showSeasonScope, seasonScope]);

  const displaySeries = useMemo(() => {
    const useContrastColors =
      isSingleSeasonSelected(
        ticketFilters,
        showSeasonScope,
        seasonScope,
        filteredSeries,
      ) &&
      isSingleLeagueSelected(ticketFilters, filteredSeries);

    if (!useContrastColors) {
      return filteredSeries;
    }

    return applyContrastColors(filteredSeries);
  }, [filteredSeries, ticketFilters, showSeasonScope, seasonScope]);

  const selectedMatchId = getSingleSelectedMatchId(ticketFilters.matchId);
  const focusedMatch = useMemo(() => {
    if (!selectedMatchId) return null;
    const match = series.find((item) => item.matchId === selectedMatchId);
    if (!match) return null;
    return applyContrastColors([match])[0];
  }, [series, selectedMatchId]);
  const isSingleMatchFocus = selectedMatchId != null;
  const showSeasonPlan =
    ticketFilters.season !== "all" && !isSingleMatchFocus;

  const nextUpcoming = useMemo(
    () => (isSingleMatchFocus ? null : findNextUpcomingMatch(displaySeries)),
    [displaySeries, isSingleMatchFocus],
  );

  useEffect(() => {
    setHiddenSeries(new Set());
    setHoveredSeries(null);
    setChartZoomControl(null);
  }, [series, seasonScope, selectedMatchId, timeGrouping]);

  const toggleSeries = (matchId: string) => {
    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const chartHeight = isSingleMatchFocus ? 420 : displaySeries.length > 18 ? 360 : 340;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>График продаж к матчу</CardTitle>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            {isSingleMatchFocus
              ? "Накопительные продажи по датам и плановая цель в день матча"
              : "Каждая линия — отдельный матч, накопительный факт по датам продаж · прокрутите график горизонтально"}
          </p>
          <ChartZoomHint visible={!chartZoomControl?.isZoomed} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chartZoomControl?.isZoomed && (
            <ChartZoomResetButton onClick={chartZoomControl.resetZoom} />
          )}
          <div className="flex w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5 sm:w-auto">
            {TIME_GROUPING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setChartTimeGrouping(option.value)}
                className={clsx(
                  "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                  timeGrouping === option.value
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5 sm:w-auto">
            {SALES_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                  activeTab === tab.id
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isSingleMatchFocus && (
          <ChartScopeControls
            seasonScope={seasonScope}
            showSeasonScope={showSeasonScope}
            onSeasonScopeChange={setSeasonScope}
          />
        )}
        {isSingleMatchFocus && focusedMatch ? (
          <SelectedMatchSummary match={focusedMatch} mode={activeTab} />
        ) : (
          nextUpcoming && (
            <div
              className={clsx(showSeasonScope ? "mt-3" : "")}
            >
              <UpcomingMatchSummary match={nextUpcoming} mode={activeTab} />
            </div>
          )
        )}
        <div
          className={clsx(
            !isSingleMatchFocus &&
              (showSeasonScope || nextUpcoming) &&
              "mt-3",
            isSingleMatchFocus && "mt-3",
          )}
          style={{ height: chartHeight }}
          key={`${activeTab}-${seasonScope}-${selectedMatchId ?? "all"}-${timeGrouping}`}
        >
          {isSingleMatchFocus && focusedMatch ? (
            <SingleMatchFocusChart
              match={focusedMatch}
              mode={activeTab}
              timeGrouping={timeGrouping}
              chartHeight={chartHeight}
              onZoomStateChange={setChartZoomControl}
            />
          ) : selectedMatchId ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
              Нет данных по выбранному матчу
            </div>
          ) : (
            <MatchCumulativeChart
              series={displaySeries}
              mode={activeTab}
              timeGrouping={timeGrouping}
              hiddenSeries={hiddenSeries}
              hoveredSeries={hoveredSeries}
              showSeasonPlan={showSeasonPlan}
              chartHeight={chartHeight}
              onZoomStateChange={setChartZoomControl}
            />
          )}
        </div>
        {!isSingleMatchFocus && (
          <ChartLegend
            series={displaySeries}
            hiddenSeries={hiddenSeries}
            hoveredSeries={hoveredSeries}
            onToggleSeries={toggleSeries}
            onHoverSeries={setHoveredSeries}
            showSeasonPlan={showSeasonPlan}
          />
        )}
        {isSingleMatchFocus && (
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--muted)]">
            Сплошная линия — факт, пунктир — план. Кольцо в дату матча — плановая
            цель. Вертикальная линия — сегодня.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

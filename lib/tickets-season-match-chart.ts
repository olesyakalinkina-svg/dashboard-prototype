import { addDays, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { formatShortMonthYear } from "@/lib/format";
import type {
  TicketMatchCumulativeSeries,
  TicketsSeasonMatchChartRow,
  TicketsSeasonMatchQuickFilter,
  TicketsSeasonMatchSeriesView,
  TicketsSeasonMatchStatus,
  TimeGrouping,
} from "@/types/dashboard";

export const SEASON_MATCH_FACT_KEY_PREFIX = "fact_";
export const SEASON_MATCH_PLAN_KEY_PREFIX = "plan_";

export const SEASON_MATCH_CHART_MIN_WIDTH = 760;
export const SEASON_MATCH_CHART_MOBILE_MAX_WIDTH = 760;
export const SEASON_MATCH_CHART_DAY_WIDTH = 44;
/** Y-axis width (52) + chart left margin (4). */
export const SEASON_MATCH_CHART_LEFT_GUTTER = 56;
export const SEASON_MATCH_CHART_RIGHT_GUTTER = 20;
export const SEASON_MATCH_CHART_TOP_GUTTER = 20;
export const SEASON_MATCH_CHART_BOTTOM_GUTTER = 40;
export const SEASON_MATCH_PLAN_LABEL_WIDTH = 76;
export const SEASON_MATCH_PLAN_LABEL_HEIGHT = 14;
export const SEASON_MATCH_PLAN_LABEL_GAP = 4;
export const SEASON_MATCH_PLAN_LABEL_OFFSET = 18;
export const SEASON_MATCH_MAX_BRIGHT_LINES = 10;
export const SEASON_MATCH_PLAN_LEGEND_LABEL = "План продаж";
export const SEASON_MATCH_COMPARISON_COLOR = "#9CA3AF";
export const SEASON_MATCH_COMPARISON_LEGEND_LABEL =
  "Предыдущие матчи того же класса";

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

export function seasonMatchFactKey(matchId: string): string {
  return `${SEASON_MATCH_FACT_KEY_PREFIX}${matchId}`;
}

export function seasonMatchPlanKey(matchId: string): string {
  return `${SEASON_MATCH_PLAN_KEY_PREFIX}${matchId}`;
}

export function formatSeasonMatchDateLabel(dateKey: number): string {
  return format(new Date(dateKey), "dd.MM.yy");
}

export function formatRevenueThousandsLabel(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(Math.round(value));
}

export function formatSeasonMatchYAxisTick(value: number): string {
  if (value === 0) return "0";
  return `${Math.round(value / 1_000)}K`;
}

export function getSeasonMatchStatusLabel(
  status: TicketsSeasonMatchStatus,
): string {
  switch (status) {
    case "behind":
      return "Отставание";
    case "on_track":
      return "По плану";
    case "ahead":
      return "Выше плана";
  }
}

export function computeSeasonMatchStatus(
  completionPct: number,
): TicketsSeasonMatchStatus {
  if (completionPct > 100) return "ahead";
  if (completionPct >= 95) return "on_track";
  return "behind";
}

function parseOpponentFromLabel(label: string): string {
  const separator = label.indexOf(" · ");
  return separator >= 0 ? label.slice(0, separator) : label;
}

function parseMatchDateFromLabel(label: string): string {
  const separator = label.indexOf(" · ");
  return separator >= 0 ? label.slice(separator + 3) : "";
}

function getCurrentFactRevenue(item: TicketMatchCumulativeSeries): number {
  if (item.currentDaysBeforeMatch != null) {
    const point = item.points.find(
      (entry) => entry.daysBeforeMatch === item.currentDaysBeforeMatch,
    );
    return point?.revenue ?? 0;
  }

  const endPoint = item.points.find((point) => point.daysBeforeMatch === 0);
  return endPoint?.revenue ?? 0;
}

export function isSeasonMatchComparisonMode(
  series: TicketMatchCumulativeSeries[],
): boolean {
  return series.some((item) => item.seriesRole === "selected");
}

export function buildSeasonMatchSeriesViews(
  series: TicketMatchCumulativeSeries[],
  options: { useContrastColors?: boolean } = {},
): TicketsSeasonMatchSeriesView[] {
  const useContrastColors = options.useContrastColors ?? true;
  const comparisonMode = isSeasonMatchComparisonMode(series);
  let colorIndex = 0;

  return series.map((item) => {
    const opponent = parseOpponentFromLabel(item.label);
    const matchDate =
      parseMatchDateFromLabel(item.label) ||
      formatSeasonMatchDateLabel(item.matchDateKey);
    const currentFact = getCurrentFactRevenue(item);
    const completionPct =
      item.planRevenue > 0 ? (currentFact / item.planRevenue) * 100 : 0;
    const deviationPct = completionPct - 100;
    const sortedPoints = [...item.points].sort(
      (left, right) => left.dateKey - right.dateKey,
    );
    const salesStartDateKey = sortedPoints[0]?.dateKey ?? item.matchDateKey;
    const isComparison = item.seriesRole === "comparison";
    const isSelected = item.seriesRole === "selected";

    let color = item.color;
    if (comparisonMode) {
      color = isComparison
        ? SEASON_MATCH_COMPARISON_COLOR
        : isSelected
          ? CONTRAST_LINE_COLORS[0]
          : SEASON_MATCH_COMPARISON_COLOR;
    } else if (useContrastColors) {
      color = CONTRAST_LINE_COLORS[colorIndex % CONTRAST_LINE_COLORS.length];
      colorIndex += 1;
    }

    return {
      matchId: item.matchId,
      opponent,
      matchDate,
      matchDateKey: item.matchDateKey,
      legendLabel: `${opponent} — ${matchDate}`,
      color,
      league: item.league,
      season: item.season,
      matchClass: item.matchClass,
      planRevenue: item.planRevenue,
      eventCompleted: item.eventCompleted,
      hasFactSales: item.hasFactSales,
      isOnSale:
        !item.eventCompleted && item.currentDaysBeforeMatch != null,
      salesStartDateKey,
      currentFact,
      completionPct,
      deviationPct,
      status: computeSeasonMatchStatus(completionPct),
      isSelected,
      isComparison,
    };
  });
}

export function filterSeasonMatchSeriesViews(
  views: TicketsSeasonMatchSeriesView[],
  quickFilter: TicketsSeasonMatchQuickFilter,
  searchQuery: string,
): TicketsSeasonMatchSeriesView[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return views.filter((view) => {
    if (
      normalizedQuery &&
      !view.opponent.toLowerCase().includes(normalizedQuery)
    ) {
      return false;
    }

    switch (quickFilter) {
      case "on_sale":
        return view.isOnSale;
      case "completed":
        return view.eventCompleted;
      case "met_plan":
        return view.completionPct >= 100;
      case "missed_plan":
        return view.completionPct < 95;
      default:
        return true;
    }
  });
}

export function buildSeasonMatchChartRows(
  views: TicketsSeasonMatchSeriesView[],
  series: TicketMatchCumulativeSeries[],
): TicketsSeasonMatchChartRow[] {
  if (views.length === 0) return [];

  const visibleIds = new Set(views.map((view) => view.matchId));
  const visibleSeries = series.filter((item) => visibleIds.has(item.matchId));
  const dateKeys = new Set<number>();

  for (const item of visibleSeries) {
    for (const point of item.points) {
      if (point.revenue != null) {
        dateKeys.add(point.dateKey);
      }
      if (point.daysBeforeMatch === 0) {
        dateKeys.add(point.dateKey);
      }
    }
  }

  return [...dateKeys]
    .sort((left, right) => left - right)
    .map((dateKey) => {
      const row: TicketsSeasonMatchChartRow = {
        dateKey,
        periodLabel: formatSeasonMatchDateLabel(dateKey),
      };

      for (const view of views) {
        const item = visibleSeries.find((entry) => entry.matchId === view.matchId);
        if (!item) continue;

        const point = item.points.find((entry) => entry.dateKey === dateKey);
        const factKey = seasonMatchFactKey(view.matchId);
        const planKey = seasonMatchPlanKey(view.matchId);

        row[factKey] =
          point?.revenue != null && dateKey >= view.salesStartDateKey
            ? point.revenue
            : null;

        row[planKey] =
          point?.daysBeforeMatch === 0 ? view.planRevenue : null;
      }

      return row;
    });
}

function getSeasonMatchPeriodSortKey(
  dateKey: number,
  grouping: TimeGrouping,
): number {
  const date = startOfDay(new Date(dateKey));
  if (grouping === "month") {
    return startOfMonth(date).getTime();
  }
  if (grouping === "week") {
    return startOfWeek(date, { locale: ru }).getTime();
  }
  return date.getTime();
}

function getSeasonMatchPeriodLabel(
  periodSortKey: number,
  grouping: TimeGrouping,
): string {
  const date = new Date(periodSortKey);
  if (grouping === "month") {
    return formatShortMonthYear(date);
  }
  if (grouping === "week") {
    return format(date, "dd MMM", { locale: ru });
  }
  return formatSeasonMatchDateLabel(periodSortKey);
}

/** Buckets daily chart rows by week/month; cumulative values use period-end snapshot. */
export function aggregateSeasonMatchChartRowsByGrouping(
  dailyRows: TicketsSeasonMatchChartRow[],
  views: TicketsSeasonMatchSeriesView[],
  grouping: TimeGrouping,
): TicketsSeasonMatchChartRow[] {
  if (grouping === "day" || dailyRows.length === 0) {
    return dailyRows;
  }

  const seriesKeys = views.flatMap((view) => [
    seasonMatchFactKey(view.matchId),
    seasonMatchPlanKey(view.matchId),
  ]);

  const buckets = new Map<number, TicketsSeasonMatchChartRow[]>();

  for (const row of dailyRows) {
    const sortKey = getSeasonMatchPeriodSortKey(row.dateKey, grouping);
    const bucket = buckets.get(sortKey) ?? [];
    bucket.push(row);
    buckets.set(sortKey, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([periodSortKey, bucketRows]) => {
      const lastRow = bucketRows[bucketRows.length - 1];
      const aggregated: TicketsSeasonMatchChartRow = {
        dateKey: lastRow.dateKey,
        periodLabel: getSeasonMatchPeriodLabel(periodSortKey, grouping),
      };

      for (const key of seriesKeys) {
        let value: number | null = null;
        for (const row of bucketRows) {
          const pointValue = row[key];
          if (pointValue != null) {
            value = pointValue as number;
          }
        }
        aggregated[key] = value;
      }

      return aggregated;
    });
}

export function formatSeasonMatchAxisLabel(
  dateKey: number,
  rows: TicketsSeasonMatchChartRow[],
): string {
  const row = rows.find((entry) => entry.dateKey === dateKey);
  return row?.periodLabel ?? formatSeasonMatchDateLabel(dateKey);
}

export function getSeasonMatchChartWidth(
  rows: TicketsSeasonMatchChartRow[],
  options?: { maxWidth?: number; containerWidth?: number },
): number {
  const dataWidth =
    rows.length <= 1
      ? SEASON_MATCH_CHART_MIN_WIDTH
      : Math.max(
          rows.length * SEASON_MATCH_CHART_DAY_WIDTH,
          SEASON_MATCH_CHART_MIN_WIDTH,
        );

  if (options?.maxWidth != null) {
    const capped = Math.min(dataWidth, options.maxWidth);
    if (options.containerWidth != null && options.containerWidth > 0) {
      return Math.max(options.containerWidth, capped);
    }
    return capped;
  }

  return dataWidth;
}

export function getSeasonMatchDateXPosition(
  dateKey: number,
  rows: TicketsSeasonMatchChartRow[],
  chartWidth: number,
): number {
  if (rows.length === 0) return SEASON_MATCH_CHART_LEFT_GUTTER;

  const minKey = rows[0].dateKey;
  const maxKey = rows[rows.length - 1].dateKey;
  if (maxKey === minKey) return SEASON_MATCH_CHART_LEFT_GUTTER;

  const ratio = (dateKey - minKey) / (maxKey - minKey);
  const plotWidth =
    chartWidth - SEASON_MATCH_CHART_LEFT_GUTTER - SEASON_MATCH_CHART_RIGHT_GUTTER;
  return SEASON_MATCH_CHART_LEFT_GUTTER + ratio * plotWidth;
}

export function getSeasonMatchChartScrollLeft(
  salesStartDateKey: number,
  rows: TicketsSeasonMatchChartRow[],
  chartWidth: number,
  viewportWidth: number,
): number {
  const xPosition = getSeasonMatchDateXPosition(
    salesStartDateKey,
    rows,
    chartWidth,
  );
  const leadPadding = Math.min(viewportWidth * 0.25, 80);
  const target = xPosition - leadPadding;
  const maxScroll = Math.max(0, chartWidth - viewportWidth);
  return Math.max(0, Math.min(target, maxScroll));
}

export function getSeasonMatchYDomainKeys(
  views: TicketsSeasonMatchSeriesView[],
): string[] {
  const keys: string[] = [];
  for (const view of views) {
    if (view.hasFactSales || view.isOnSale) {
      keys.push(seasonMatchFactKey(view.matchId));
    }
    keys.push(seasonMatchPlanKey(view.matchId));
  }
  return keys;
}

export function buildSeasonMatchXAxisTicks(
  rows: TicketsSeasonMatchChartRow[],
  options?: { stepDays?: number; grouping?: TimeGrouping },
): number[] {
  if (rows.length === 0) return [];

  const grouping = options?.grouping ?? "day";
  if (grouping !== "day") {
    if (rows.length <= 14) {
      return rows.map((row) => row.dateKey);
    }
    const step = grouping === "month" ? 1 : 2;
    return rows
      .filter((_, index) => index % step === 0 || index === rows.length - 1)
      .map((row) => row.dateKey);
  }

  const stepDays = options?.stepDays ?? 2;
  const minKey = rows[0].dateKey;
  const maxKey = rows[rows.length - 1].dateKey;
  const ticks: number[] = [];
  let current = startOfDay(new Date(minKey));
  const end = startOfDay(new Date(maxKey));

  while (current.getTime() <= end.getTime()) {
    ticks.push(current.getTime());
    current = addDays(current, stepDays);
  }

  if (ticks[ticks.length - 1] !== end.getTime()) {
    ticks.push(end.getTime());
  }

  return ticks;
}

export function getSeasonMatchLineOpacity(
  view: TicketsSeasonMatchSeriesView,
  options: {
    hidden: boolean;
    hoveredMatchId: string | null;
    brightMatchIds: Set<string>;
    comparisonMode?: boolean;
  },
): number {
  if (options.hidden) return 0;

  if (view.isComparison) {
    if (options.hoveredMatchId != null) {
      return options.hoveredMatchId === view.matchId ? 0.9 : 0.2;
    }
    return 0.55;
  }

  if (view.isSelected) {
    if (options.hoveredMatchId != null) {
      return options.hoveredMatchId === view.matchId ? 1 : 0.25;
    }
    return 1;
  }

  if (options.comparisonMode) {
    if (options.hoveredMatchId != null) {
      return options.hoveredMatchId === view.matchId ? 1 : 0.25;
    }
    return 1;
  }

  if (options.hoveredMatchId != null) {
    return options.hoveredMatchId === view.matchId ? 1 : 0.12;
  }
  if (!options.brightMatchIds.has(view.matchId)) return 0.2;
  return 1;
}

export function getSeasonMatchStrokeWidth(
  view: TicketsSeasonMatchSeriesView,
  hoveredMatchId: string | null,
): number {
  if (hoveredMatchId === view.matchId) {
    return view.isSelected ? 3.5 : 3;
  }
  if (view.isSelected) return 2.5;
  return view.isComparison ? 1.5 : 2;
}

export function pickBrightSeasonMatchIds(
  views: TicketsSeasonMatchSeriesView[],
): Set<string> {
  if (views.some((view) => view.isSelected)) {
    return new Set(views.map((view) => view.matchId));
  }

  if (views.length <= SEASON_MATCH_MAX_BRIGHT_LINES) {
    return new Set(views.map((view) => view.matchId));
  }

  return new Set(
    [...views]
      .sort((left, right) => right.currentFact - left.currentFact)
      .slice(0, SEASON_MATCH_MAX_BRIGHT_LINES)
      .map((view) => view.matchId),
  );
}

export type SeasonMatchPlanLabelCandidate = {
  matchId: string;
  x: number;
  y: number;
  priority: number;
};

export function pickVisibleSeasonMatchPlanLabelIds(
  candidates: SeasonMatchPlanLabelCandidate[],
): Set<string> {
  const placed: Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> = [];
  const visible = new Set<string>();

  const sorted = [...candidates].sort((left, right) => right.priority - left.priority);

  for (const candidate of sorted) {
    const left = candidate.x - SEASON_MATCH_PLAN_LABEL_WIDTH / 2;
    const right = candidate.x + SEASON_MATCH_PLAN_LABEL_WIDTH / 2;
    const bottom = candidate.y - SEASON_MATCH_PLAN_LABEL_OFFSET;
    const top = bottom - SEASON_MATCH_PLAN_LABEL_HEIGHT;
    const overlaps = placed.some(
      (box) =>
        left < box.right + SEASON_MATCH_PLAN_LABEL_GAP &&
        right > box.left - SEASON_MATCH_PLAN_LABEL_GAP &&
        top < box.bottom + SEASON_MATCH_PLAN_LABEL_GAP &&
        bottom > box.top - SEASON_MATCH_PLAN_LABEL_GAP,
    );
    if (overlaps) continue;
    placed.push({ left, right, top, bottom });
    visible.add(candidate.matchId);
  }

  return visible;
}

export function getSeasonMatchPlanMarkerY(
  value: number,
  yMax: number,
  chartHeight: number,
): number {
  const plotHeight = Math.max(
    1,
    chartHeight - SEASON_MATCH_CHART_TOP_GUTTER - SEASON_MATCH_CHART_BOTTOM_GUTTER,
  );
  const ratio = yMax > 0 ? Math.min(1, Math.max(0, value / yMax)) : 0;
  return SEASON_MATCH_CHART_TOP_GUTTER + (1 - ratio) * plotHeight;
}

export const SEASON_MATCH_QUICK_FILTERS: {
  value: TicketsSeasonMatchQuickFilter;
  label: string;
}[] = [
  { value: "all", label: "Все матчи" },
  { value: "on_sale", label: "В продаже" },
  { value: "completed", label: "Завершённые" },
  { value: "met_plan", label: "Выполнили план" },
  { value: "missed_plan", label: "Не выполнили план" },
];

import { addDays, format, startOfDay } from "date-fns";
import type {
  TicketMatchCumulativeSeries,
  TicketsSeasonMatchChartRow,
  TicketsSeasonMatchQuickFilter,
  TicketsSeasonMatchSeriesView,
  TicketsSeasonMatchStatus,
} from "@/types/dashboard";

export const SEASON_MATCH_FACT_KEY_PREFIX = "fact_";
export const SEASON_MATCH_PLAN_KEY_PREFIX = "plan_";

export const SEASON_MATCH_CHART_MIN_WIDTH = 760;
export const SEASON_MATCH_CHART_DAY_WIDTH = 44;
/** Y-axis width (52) + chart left margin (4). */
export const SEASON_MATCH_CHART_LEFT_GUTTER = 56;
export const SEASON_MATCH_CHART_RIGHT_GUTTER = 20;
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

export function getSeasonMatchChartWidth(
  rows: TicketsSeasonMatchChartRow[],
): number {
  if (rows.length <= 1) return SEASON_MATCH_CHART_MIN_WIDTH;
  return Math.max(rows.length * SEASON_MATCH_CHART_DAY_WIDTH, SEASON_MATCH_CHART_MIN_WIDTH);
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
  stepDays = 2,
): number[] {
  if (rows.length === 0) return [];

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

import { addMonths, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { formatShortMonthYear } from "@/lib/format";
import type {
  TicketMatchCumulativeSeries,
  TicketsSeasonMatchChartRow,
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
/** Enough for «03.02.26» at 11px plus a small gutter between labels. */
export const SEASON_MATCH_AXIS_MIN_TICK_GAP_PX = 64;
export const SEASON_MATCH_AXIS_STAGGER_DY = 14;
export const SEASON_MATCH_AXIS_TICK_HEIGHT = 48;
export const SEASON_MATCH_MAX_BRIGHT_LINES = 10;
/** Completed matches shown when nothing is currently on sale. */
export const SEASON_MATCH_LAST_COMPLETED_FALLBACK_COUNT = 3;
export const SEASON_MATCH_PLAN_LEGEND_LABEL = "План продаж";
export const SEASON_MATCH_COMPARISON_COLOR = "#9CA3AF";
export const SEASON_MATCH_COMPARISON_LEGEND_LABEL =
  "Предыдущие матчи того же класса";
/** Widget-local selector: restore auto current-sales / last-3 logic. */
export const SEASON_MATCH_CURRENT_SALES_VALUE = "__current_sales__";
export const SEASON_MATCH_CURRENT_SALES_LABEL = "Текущие продажи";

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

/**
 * Current / ongoing ticket sales: the match is not finished and MOCK_TODAY
 * (via currentDaysBeforeMatch) falls inside the sales window.
 * Equivalent to the former "В продаже" chip.
 */
export function isSeasonMatchCurrentlyOnSale(item: {
  eventCompleted: boolean;
  currentDaysBeforeMatch: number | null;
}): boolean {
  return !item.eventCompleted && item.currentDaysBeforeMatch != null;
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
      isOnSale: isSeasonMatchCurrentlyOnSale(item),
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

export function buildSeasonMatchSelectorOptions(
  views: TicketsSeasonMatchSeriesView[],
): Array<{ value: string; label: string }> {
  const matches = views
    .filter((view) => !view.isComparison)
    .sort((left, right) => left.matchDateKey - right.matchDateKey)
    .map((view) => ({
      value: view.matchId,
      label: view.legendLabel,
    }));

  return [
    {
      value: SEASON_MATCH_CURRENT_SALES_VALUE,
      label: SEASON_MATCH_CURRENT_SALES_LABEL,
    },
    ...matches,
  ];
}

export function toSeasonMatchSelectorValue(
  selectedMatchIds: string[],
): string[] {
  if (selectedMatchIds.length === 0) {
    return [SEASON_MATCH_CURRENT_SALES_VALUE];
  }
  return selectedMatchIds.filter(
    (id) => id !== SEASON_MATCH_CURRENT_SALES_VALUE,
  );
}

/**
 * Maps MultiSelect next value back to widget match ids.
 * "Текущие продажи" is exclusive: picking it clears matches (auto mode);
 * picking a match while auto is on drops the exclusive option.
 */
export function fromSeasonMatchSelectorValue(
  previousSelectedMatchIds: string[],
  nextSelectorValue: string[],
): string[] {
  const wasAuto = previousSelectedMatchIds.length === 0;
  const nextHasCurrent = nextSelectorValue.includes(
    SEASON_MATCH_CURRENT_SALES_VALUE,
  );
  const nextMatches = nextSelectorValue.filter(
    (id) => id !== SEASON_MATCH_CURRENT_SALES_VALUE,
  );

  if (nextHasCurrent) {
    if (!wasAuto) {
      return [];
    }
    return nextMatches;
  }

  return nextMatches;
}

export type SelectSeasonMatchChartViewsOptions = {
  /**
   * Widget-local match ids. Empty means default: current on-sale matches,
   * or the last completed matches if nothing is on sale.
   */
  selectedMatchIds?: string[];
  /**
   * When the tab already scoped the series (global match filter or
   * comparison mode), keep incoming views instead of current-sales / last-3.
   */
  preserveIncomingViews?: boolean;
};

/**
 * Default: matches currently on sale. If none → last 3 completed (by date).
 * Widget-local selection overrides that and can include completed matches.
 */
export function selectSeasonMatchChartViews(
  views: TicketsSeasonMatchSeriesView[],
  options: SelectSeasonMatchChartViewsOptions = {},
): TicketsSeasonMatchSeriesView[] {
  const selectedMatchIds = options.selectedMatchIds ?? [];
  if (selectedMatchIds.length > 0) {
    const selected = new Set(selectedMatchIds);
    return views.filter((view) => selected.has(view.matchId));
  }

  if (options.preserveIncomingViews) {
    return views;
  }

  if (views.some((view) => view.isSelected)) {
    return views;
  }

  const onSale = views.filter((view) => view.isOnSale);
  if (onSale.length > 0) {
    return onSale;
  }

  return [...views]
    .filter((view) => view.eventCompleted)
    .sort((left, right) => right.matchDateKey - left.matchDateKey)
    .slice(0, SEASON_MATCH_LAST_COMPLETED_FALLBACK_COUNT)
    .sort((left, right) => left.matchDateKey - right.matchDateKey);
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

function isSeasonMatchMonthStart(dateKey: number): boolean {
  const date = new Date(dateKey);
  return startOfMonth(date).getTime() === startOfDay(date).getTime();
}

export function formatSeasonMatchAxisLabel(
  dateKey: number,
  rows: TicketsSeasonMatchChartRow[],
  matchDateKeys?: Iterable<number>,
): string {
  const matchDates =
    matchDateKeys instanceof Set
      ? matchDateKeys
      : new Set(matchDateKeys ?? []);
  if (matchDates.has(dateKey)) {
    return formatSeasonMatchDateLabel(dateKey);
  }
  if (isSeasonMatchMonthStart(dateKey)) {
    return formatShortMonthYear(new Date(dateKey));
  }
  const row = rows.find((entry) => entry.dateKey === dateKey);
  return row?.periodLabel ?? formatSeasonMatchDateLabel(dateKey);
}

/**
 * Plot width so dense series keep ~DAY_WIDTH px per point (horizontal scroll),
 * while sparse series stretch to the card:
 *   container known: max(containerWidth, min(maxWidth?, rows * DAY_WIDTH))
 *   otherwise:       max(MIN_WIDTH, rows * DAY_WIDTH)
 */
export function getSeasonMatchChartWidth(
  rows: TicketsSeasonMatchChartRow[],
  options?: { maxWidth?: number; containerWidth?: number },
): number {
  const denseWidth =
    Math.max(rows.length, 1) * SEASON_MATCH_CHART_DAY_WIDTH;

  if (options?.containerWidth != null && options.containerWidth > 0) {
    const capped =
      options.maxWidth != null
        ? Math.min(denseWidth, options.maxWidth)
        : denseWidth;
    return Math.max(options.containerWidth, capped);
  }

  const dataWidth = Math.max(denseWidth, SEASON_MATCH_CHART_MIN_WIDTH);
  return options?.maxWidth != null
    ? Math.min(dataWidth, options.maxWidth)
    : dataWidth;
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

function collectSeasonMatchMonthTicks(minKey: number, maxKey: number): number[] {
  const ticks: number[] = [];
  let current = startOfMonth(new Date(minKey));
  if (current.getTime() < startOfDay(new Date(minKey)).getTime()) {
    current = addMonths(current, 1);
  }
  const end = startOfDay(new Date(maxKey));
  while (current.getTime() <= end.getTime()) {
    ticks.push(current.getTime());
    current = addMonths(current, 1);
  }
  return ticks;
}

function seasonMatchAxisTicksCollide(
  left: number,
  right: number,
  rows: TicketsSeasonMatchChartRow[],
  chartWidth: number,
  minGapPx: number,
): boolean {
  const gap = Math.abs(
    getSeasonMatchDateXPosition(left, rows, chartWidth) -
      getSeasonMatchDateXPosition(right, rows, chartWidth),
  );
  return gap < minGapPx;
}

export function buildSeasonMatchXAxisTicks(
  rows: TicketsSeasonMatchChartRow[],
  options?: {
    stepDays?: number;
    grouping?: TimeGrouping;
    matchDateKeys?: Iterable<number>;
    chartWidth?: number;
    minTickGapPx?: number;
  },
): number[] {
  if (rows.length === 0) return [];

  const minKey = rows[0].dateKey;
  const maxKey = rows[rows.length - 1].dateKey;
  const chartWidth = options?.chartWidth ?? SEASON_MATCH_CHART_MIN_WIDTH;
  const minGapPx = options?.minTickGapPx ?? SEASON_MATCH_AXIS_MIN_TICK_GAP_PX;

  const matchDates = [...new Set(options?.matchDateKeys ?? [])]
    .filter((key) => key >= minKey && key <= maxKey)
    .sort((left, right) => left - right);

  const kept = [...matchDates];
  for (const tick of collectSeasonMatchMonthTicks(minKey, maxKey)) {
    if (kept.includes(tick)) continue;
    const collides = kept.some((other) =>
      seasonMatchAxisTicksCollide(tick, other, rows, chartWidth, minGapPx),
    );
    if (!collides) kept.push(tick);
  }

  if (kept.length === 0) {
    kept.push(minKey);
    if (
      maxKey !== minKey &&
      !seasonMatchAxisTicksCollide(minKey, maxKey, rows, chartWidth, minGapPx)
    ) {
      kept.push(maxKey);
    }
  }

  return kept.sort((left, right) => left - right);
}

export function getSeasonMatchAxisTickOffsets(
  ticks: number[],
  rows: TicketsSeasonMatchChartRow[],
  chartWidth: number,
  minGapPx = SEASON_MATCH_AXIS_MIN_TICK_GAP_PX,
): Map<number, number> {
  const offsets = new Map<number, number>();
  let prevKey: number | null = null;
  let prevOffset = 0;

  for (const tick of ticks) {
    let offset = 0;
    if (
      prevKey != null &&
      seasonMatchAxisTicksCollide(tick, prevKey, rows, chartWidth, minGapPx)
    ) {
      offset = prevOffset === 0 ? SEASON_MATCH_AXIS_STAGGER_DY : 0;
    }
    offsets.set(tick, offset);
    prevKey = tick;
    prevOffset = offset;
  }

  return offsets;
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

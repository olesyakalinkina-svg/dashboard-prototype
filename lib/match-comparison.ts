import {
  computeCombinedMatchSalesTable,
  computeMerchMatchSalesTable,
  filterMatchesByTicketFilters,
} from "@/lib/filters";
import { formatCurrency, formatPercent, formatTicketEventTitle } from "@/lib/format";
import {
  DEFAULT_MATCH_SALES_FILTERS,
  matchSalesFiltersToMerchFilters,
  matchSalesFiltersToTicketFilters,
} from "@/lib/match-sales-filter-options";
import { getMatchById } from "@/lib/mock/hockey";
import { buildMatchFilterOptions } from "@/lib/ticket-filter-options";
import type {
  CombinedMatchSalesRow,
  DashboardFilters,
  Match,
  MatchSalesFilters,
  MerchMatchSalesRow,
  SubscriptionFilters,
} from "@/types/dashboard";

const DASHBOARD_FILTERS: DashboardFilters = {
  dateRange: 30,
  stream: "all",
  matchId: "all",
  promotionId: "all",
};

export const MATCH_COMPARISON_METRICS = [
  "revenue",
  "occupancy",
  "avgCheck",
  "conversion",
  "merch",
] as const;

export type MatchComparisonMetricId = (typeof MATCH_COMPARISON_METRICS)[number];

export const MATCH_COMPARISON_METRIC_LABELS: Record<
  MatchComparisonMetricId,
  string
> = {
  revenue: "Выручка",
  occupancy: "Заполняемость",
  avgCheck: "Чеки",
  conversion: "Конверсия",
  merch: "Мерч",
};

export const MATCH_COMPARISON_EMPTY = "—";

export type MatchComparisonSide = {
  matchId: string;
  eventLabel: string;
  date: Date | null;
  revenue: number | null;
  occupancy: number | null;
  avgCheck: number | null;
  conversion: number | null;
  merch: number | null;
};

export type MatchComparisonResult = {
  a: MatchComparisonSide;
  b: MatchComparisonSide;
};

const CURRENCY_METRICS: ReadonlySet<MatchComparisonMetricId> = new Set([
  "revenue",
  "avgCheck",
  "merch",
]);

export function subscriptionFiltersToMatchSalesFilters(
  filters: Pick<
    SubscriptionFilters,
    "season" | "league" | "tournamentStage" | "arena"
  >,
  matchIds: string[] = [],
): MatchSalesFilters {
  return {
    ...DEFAULT_MATCH_SALES_FILTERS,
    season: filters.season,
    league: filters.league,
    tournamentStage: filters.tournamentStage,
    arena: filters.arena,
    eventCompleted: "all",
    matchId: matchIds,
  };
}

export function listMatchComparisonMatches(
  filters: Pick<
    SubscriptionFilters,
    "season" | "league" | "tournamentStage" | "arena"
  >,
): Match[] {
  return filterMatchesByTicketFilters(
    matchSalesFiltersToTicketFilters(
      subscriptionFiltersToMatchSalesFilters(filters),
    ),
  );
}

export function listMatchComparisonOptions(
  filters: Pick<
    SubscriptionFilters,
    "season" | "league" | "tournamentStage" | "arena"
  >,
): { value: string; label: string }[] {
  return buildMatchFilterOptions(listMatchComparisonMatches(filters));
}

/** Newest completed home games first; fall back to any matches if fewer than two completed. */
export function pickDefaultMatchComparisonIds(
  matches: Match[],
): [string | null, string | null] {
  const newestFirst = [...matches].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const completed = newestFirst.filter((match) => match.eventCompleted);
  const pool = completed.length >= 2 ? completed : newestFirst;
  return [pool[0]?.id ?? null, pool[1]?.id ?? null];
}

function sideFromRows(
  matchId: string,
  combinedById: Map<string, CombinedMatchSalesRow>,
  merchById: Map<string, MerchMatchSalesRow>,
): MatchComparisonSide {
  const match = getMatchById().get(matchId);
  const combined = combinedById.get(matchId);
  const merch = merchById.get(matchId);

  const avgCheck =
    combined && combined.ticketsSold > 0
      ? combined.ticketRevenue / combined.ticketsSold
      : null;

  const conversion =
    merch && merch.attendance > 0 ? merch.purchaseConversionPct : null;

  return {
    matchId,
    eventLabel: match ? formatTicketEventTitle(match) : matchId,
    date: match?.date ?? null,
    revenue: combined ? combined.totalRevenue : null,
    occupancy: combined ? combined.fillRate : null,
    avgCheck,
    conversion,
    merch: combined ? combined.merchRevenue : null,
  };
}

export function computeMatchComparison(
  filters: Pick<
    SubscriptionFilters,
    "season" | "league" | "tournamentStage" | "arena"
  >,
  matchIdA: string,
  matchIdB: string,
): MatchComparisonResult {
  const matchSalesFilters = subscriptionFiltersToMatchSalesFilters(filters, [
    matchIdA,
    matchIdB,
  ]);
  const combined = computeCombinedMatchSalesTable(
    DASHBOARD_FILTERS,
    matchSalesFilters,
  );
  const merchRows = computeMerchMatchSalesTable(
    DASHBOARD_FILTERS,
    matchSalesFiltersToMerchFilters(matchSalesFilters),
  );
  const combinedById = new Map(combined.map((row) => [row.matchId, row]));
  const merchById = new Map(merchRows.map((row) => [row.matchId, row]));

  return {
    a: sideFromRows(matchIdA, combinedById, merchById),
    b: sideFromRows(matchIdB, combinedById, merchById),
  };
}

export function getMatchComparisonMetricValue(
  side: MatchComparisonSide,
  metric: MatchComparisonMetricId,
): number | null {
  return side[metric];
}

export function formatMatchComparisonValue(
  metric: MatchComparisonMetricId,
  value: number | null,
): string {
  if (value == null) return MATCH_COMPARISON_EMPTY;
  if (CURRENCY_METRICS.has(metric)) return formatCurrency(value);
  return formatPercent(value);
}

export function matchComparisonDelta(
  metric: MatchComparisonMetricId,
  a: MatchComparisonSide,
  b: MatchComparisonSide,
): number | null {
  const left = getMatchComparisonMetricValue(a, metric);
  const right = getMatchComparisonMetricValue(b, metric);
  if (left == null || right == null) return null;
  return right - left;
}

export function formatMatchComparisonDelta(
  metric: MatchComparisonMetricId,
  delta: number | null,
): string {
  if (delta == null) return MATCH_COMPARISON_EMPTY;
  if (CURRENCY_METRICS.has(metric)) {
    const formatted = formatCurrency(delta);
    return delta > 0 ? `+${formatted}` : formatted;
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatPercent(delta)}`;
}

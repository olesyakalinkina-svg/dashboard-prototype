import type {
  MatchSalesFilters,
  MerchFilters,
  TicketFilters,
} from "@/types/dashboard";
import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
} from "@/lib/merch-filter-options";
import {
  arenaForSelectedLeague,
  sanitizeLeagueArena,
} from "@/lib/ticket-filter-options";

export const DEFAULT_MATCH_SALES_PURCHASE_DATE_RANGE: MatchSalesFilters["purchaseDateRange"] =
  {
    from: null,
    to: null,
  };

export const DEFAULT_MATCH_SALES_FILTERS: MatchSalesFilters = {
  season: "2025/26",
  league: "KHL",
  tournamentStage: "all",
  matchClass: "all",
  series: "all",
  arena: "all",
  eventCompleted: "all",
  matchId: [],
  purchaseDateRange: DEFAULT_MATCH_SALES_PURCHASE_DATE_RANGE,
};

export function applyMatchSalesFilterPatch(
  current: MatchSalesFilters,
  patch: Partial<MatchSalesFilters>,
): MatchSalesFilters {
  const next = { ...current, ...patch };
  if (patch.league !== undefined && patch.arena === undefined) {
    next.arena = arenaForSelectedLeague(next.league, current.arena);
  } else {
    next.arena = sanitizeLeagueArena(next.league, next.arena);
  }
  return next;
}

export function matchSalesFiltersToTicketFilters(
  filters: MatchSalesFilters,
): TicketFilters {
  return {
    season: filters.season,
    league: filters.league,
    tournamentStage: filters.tournamentStage,
    matchClass: filters.matchClass,
    series: filters.series,
    arena: filters.arena,
    eventCompleted: filters.eventCompleted,
    matchId: filters.matchId,
    ticketType: "all",
    priceZone: "all",
    sector: [],
    orderSource: "all",
    transactionDateRange: filters.purchaseDateRange,
    timeGrouping: "week",
  };
}

export function matchSalesFiltersToMerchFilters(
  filters: MatchSalesFilters,
): MerchFilters {
  return {
    season: filters.season,
    league: filters.league,
    tournamentStage: filters.tournamentStage,
    matchClass: filters.matchClass,
    series: filters.series,
    matchId: filters.matchId,
    salesChannels: [...ALL_MERCH_SALES_POINTS],
    productCategories: [...ALL_MERCH_PRODUCT_CATEGORIES],
    orderDateRange: filters.purchaseDateRange,
    timeGrouping: "week",
  };
}

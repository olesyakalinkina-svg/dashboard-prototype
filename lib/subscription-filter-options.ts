import type {
  SubscriptionFilters,
  SubscriptionSalesChannel,
} from "@/types/dashboard";

export const SUBSCRIPTION_CHANNEL_LABELS: Record<
  SubscriptionSalesChannel,
  string
> = {
  box_office: "Кассы",
  official_site: "Официальный сайт",
};

export const DEFAULT_SUBSCRIPTION_FILTERS: SubscriptionFilters = {
  season: "2025/26",
  league: "all",
  tournamentStage: "all",
  arena: "all",
  ticketType: "all",
  priceZone: "all",
  timeGrouping: "week",
};

export {
  ARENA_OPTIONS,
  LEAGUE_OPTIONS,
  PRICE_ZONE_OPTIONS,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/ticket-filter-options";

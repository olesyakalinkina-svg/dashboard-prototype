import type {
  Subscription,
  SubscriptionFilters,
  SubscriptionPriceCategory,
  SubscriptionSalesChannel,
} from "@/types/dashboard";

export const SUBSCRIPTION_CHANNEL_LABELS: Record<
  SubscriptionSalesChannel,
  string
> = {
  box_office: "Кассы",
  official_site: "Официальный сайт",
};

export const ALL_SUBSCRIPTION_PRICE_CATEGORIES: SubscriptionPriceCategory[] = [
  "all_inclusive",
  "weekend",
  "seasonal",
];

export const SUBSCRIPTION_PRICE_CATEGORY_LABELS: Record<
  SubscriptionPriceCategory,
  string
> = {
  all_inclusive: "Все включено",
  weekend: "Выходного дня",
  seasonal: "Сезонный",
};

export const SUBSCRIPTION_PRICE_CATEGORY_COLORS: Record<
  SubscriptionPriceCategory,
  string
> = {
  all_inclusive: "#5282FF",
  weekend: "#00BFA5",
  seasonal: "#FF7043",
};

const PLAN_ID_TO_PRICE_CATEGORY: Record<string, SubscriptionPriceCategory> = {
  "plan-1": "weekend",
  "plan-2": "weekend",
  "plan-3": "weekend",
  "plan-4": "seasonal",
  "plan-5": "all_inclusive",
  "plan-6": "seasonal",
};

export function getSubscriptionPriceCategory(
  sub: Pick<Subscription, "planId" | "planName">,
): SubscriptionPriceCategory {
  const byPlanId = PLAN_ID_TO_PRICE_CATEGORY[sub.planId];
  if (byPlanId) return byPlanId;

  const name = sub.planName.toLowerCase();
  if (name.includes("все включено") || name.includes("vip")) {
    return "all_inclusive";
  }
  if (name.includes("выходн")) return "weekend";
  if (name.includes("сезон")) return "seasonal";
  return "seasonal";
}

export const DEFAULT_SUBSCRIPTION_FILTERS: SubscriptionFilters = {
  season: "2025/26",
  league: "KHL",
  tournamentStage: "all",
  arena: "all",
  ticketType: "all",
  sector: "all",
  timeGrouping: "week",
};

export function formatSubscriptionSeasonShort(season: string): string {
  const [startYear, endYear] = season.split("/");
  if (!startYear || !endYear) return season;
  return `${startYear.slice(-2)}/${endYear.slice(-2)}`;
}

export function getSubscriptionCategoryChartTitle(
  season: string | "all",
): string {
  if (season === "all") return "Что покупают";
  return `Что покупают в ${formatSubscriptionSeasonShort(season)}`;
}

export {
  ARENA_OPTIONS,
  LEAGUE_OPTIONS,
  SECTOR_OPTIONS,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/ticket-filter-options";

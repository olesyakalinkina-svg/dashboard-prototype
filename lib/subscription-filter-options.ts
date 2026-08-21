import type {
  Subscription,
  SubscriptionFilters,
  SubscriptionPriceCategory,
  SubscriptionSalesChannel,
} from "@/types/dashboard";
import {
  arenaForSelectedLeague,
  sanitizeLeagueArena,
} from "@/lib/ticket-filter-options";

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

export {
  getSubscriptionPriceCategoryColor,
  SUBSCRIPTION_PRICE_CATEGORY_COLORS,
} from "@/lib/subscription-price-category-colors";

const PLAN_ID_TO_PRICE_CATEGORY: Record<string, SubscriptionPriceCategory> = {
  "plan-1": "weekend",
  "plan-2": "weekend",
  "plan-3": "weekend",
  "plan-4": "seasonal",
  "plan-5": "all_inclusive",
  "plan-6": "seasonal",
  "plan-7": "all_inclusive",
  "plan-8": "all_inclusive",
  "plan-9": "seasonal",
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

export const SUBSCRIPTION_PRICE_CATEGORY_OPTIONS: {
  value: SubscriptionPriceCategory | "all";
  label: string;
}[] = [
  { value: "all", label: "Все" },
  ...ALL_SUBSCRIPTION_PRICE_CATEGORIES.map((value) => ({
    value,
    label: SUBSCRIPTION_PRICE_CATEGORY_LABELS[value],
  })),
];

export function applySubscriptionFilterPatch(
  current: SubscriptionFilters,
  patch: Partial<SubscriptionFilters>,
): SubscriptionFilters {
  const next = { ...current, ...patch };
  if (patch.league !== undefined && patch.arena === undefined) {
    next.arena = arenaForSelectedLeague(next.league, current.arena);
  } else {
    next.arena = sanitizeLeagueArena(next.league, next.arena);
  }
  return next;
}

export function subscriptionMatchesPriceCategory(
  sub: Pick<Subscription, "planId" | "planName">,
  priceCategory: SubscriptionPriceCategory | "all",
): boolean {
  if (priceCategory === "all") return true;
  return getSubscriptionPriceCategory(sub) === priceCategory;
}

export const DEFAULT_SUBSCRIPTION_FILTERS: SubscriptionFilters = {
  season: "2025/26",
  league: "KHL",
  tournamentStage: "all",
  arena: "all",
  priceCategory: "all",
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
  arenaForSelectedLeague,
  getLockedLeagueArena as getLockedSubscriptionArena,
  isLeagueArenaLocked as isSubscriptionArenaLocked,
  LEAGUE_OPTIONS,
  sanitizeLeagueArena as sanitizeSubscriptionArena,
  SEASON_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
} from "@/lib/ticket-filter-options";

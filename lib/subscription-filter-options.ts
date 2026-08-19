import type {
  ArenaId,
  League,
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

const LOCKED_SUBSCRIPTION_ARENA: Record<League, ArenaId> = {
  KHL: "main",
  VHL: "secondary",
  MHL: "main",
};

/** League is a single Select on this tab, not a multi-select. */
export function getLockedSubscriptionArena(
  league: League | "all",
): ArenaId | null {
  if (league === "all") return null;
  return LOCKED_SUBSCRIPTION_ARENA[league];
}

export function isSubscriptionArenaLocked(
  league: League | "all",
): boolean {
  return getLockedSubscriptionArena(league) !== null;
}

export function sanitizeSubscriptionArena(
  league: League | "all",
  arena: ArenaId | "all",
): ArenaId | "all" {
  return getLockedSubscriptionArena(league) ?? arena;
}

export function applySubscriptionFilterPatch(
  current: SubscriptionFilters,
  patch: Partial<SubscriptionFilters>,
): SubscriptionFilters {
  const next = { ...current, ...patch };
  next.arena = sanitizeSubscriptionArena(next.league, next.arena);
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
  arena: "main",
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
  LEAGUE_OPTIONS,
  SEASON_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
} from "@/lib/ticket-filter-options";

import type {
  Subscription,
  SubscriptionFilters,
  SubscriptionPriceCategory,
} from "@/types/dashboard";
import {
  isValidSoldSubscription,
  subscriptionMatchesCampaignFilters,
} from "@/lib/subscription-campaign/compute";
import {
  ALL_SUBSCRIPTION_PRICE_CATEGORIES,
  formatSubscriptionSeasonShort,
  getSubscriptionPriceCategory,
  SUBSCRIPTION_PRICE_CATEGORY_LABELS,
} from "@/lib/subscription-filter-options";

/** Renewal is always this pair; the season dropdown is ignored. */
export const RENEWAL_BASE_SEASON = "2024/25";
export const RENEWAL_NEXT_SEASON = "2025/26";

export type SubscriptionRenewalAttributeFilters = Pick<
  SubscriptionFilters,
  "league" | "tournamentStage" | "arena" | "priceCategory"
>;

export type SubscriptionRenewalProductShare = {
  categoryKey: SubscriptionPriceCategory;
  planName: string;
  base: number;
  renewed: number;
  share: number;
};

export type SubscriptionRenewalKpis = {
  renewed: number;
  notRenewed: number;
  newClients: number;
  /** Share of 2024/25 unique owners who bought 2025/26. */
  renewedPct: number;
  /** Share of 2024/25 unique owners with no 2025/26 purchase. */
  notRenewedPct: number;
  /** Share of 2025/26 unique buyers who had no 2024/25 purchase. */
  newClientsPct: number;
  previousUnique: number;
  nextUnique: number;
};

export type SubscriptionRenewalResult = {
  baseSeason: typeof RENEWAL_BASE_SEASON;
  nextSeason: typeof RENEWAL_NEXT_SEASON;
  kpis: SubscriptionRenewalKpis;
  products: SubscriptionRenewalProductShare[];
};

/**
 * Unique owners of a 2024/25 price category who bought **any** 2025/26
 * subscription (not necessarily the same category). Share = renewed / base.
 *
 * Product rows are the three tariffs from `getSubscriptionPriceCategory`
 * (Все включено / Выходного дня / Сезонный), same grouping as
 * `computeSubscriptionPriceCategoryShares`.
 *
 * Filters: league / arena / tournamentStage / priceCategory apply to both
 * seasons. Season is fixed to 2024/25 → 2025/26. Cancelled rows are excluded
 * via `isValidSoldSubscription`.
 */
export function computeSubscriptionRenewal({
  subscriptions,
  filters,
}: {
  subscriptions: readonly Subscription[];
  filters: SubscriptionRenewalAttributeFilters;
}): SubscriptionRenewalResult {
  const previousOwners = new Set<string>();
  const nextOwners = new Set<string>();
  const previousByCategory = new Map<SubscriptionPriceCategory, Set<string>>();
  for (const category of ALL_SUBSCRIPTION_PRICE_CATEGORIES) {
    previousByCategory.set(category, new Set());
  }

  for (const sub of subscriptions) {
    if (!isValidSoldSubscription(sub)) continue;
    if (!subscriptionMatchesCampaignFilters(sub, filters)) continue;

    if (sub.season === RENEWAL_BASE_SEASON) {
      previousOwners.add(sub.customerId);
      previousByCategory
        .get(getSubscriptionPriceCategory(sub))
        ?.add(sub.customerId);
    } else if (sub.season === RENEWAL_NEXT_SEASON) {
      nextOwners.add(sub.customerId);
    }
  }

  let renewed = 0;
  for (const customerId of previousOwners) {
    if (nextOwners.has(customerId)) renewed += 1;
  }
  const notRenewed = previousOwners.size - renewed;
  const newClients = nextOwners.size - renewed;
  const previousUnique = previousOwners.size;
  const nextUnique = nextOwners.size;

  const products: SubscriptionRenewalProductShare[] =
    ALL_SUBSCRIPTION_PRICE_CATEGORIES.map((categoryKey) => {
      const owners = previousByCategory.get(categoryKey) ?? new Set<string>();
      let renewedForCategory = 0;
      for (const customerId of owners) {
        if (nextOwners.has(customerId)) renewedForCategory += 1;
      }
      const base = owners.size;
      return {
        categoryKey,
        planName: SUBSCRIPTION_PRICE_CATEGORY_LABELS[categoryKey],
        base,
        renewed: renewedForCategory,
        share: base > 0 ? (renewedForCategory / base) * 100 : 0,
      };
    });

  return {
    baseSeason: RENEWAL_BASE_SEASON,
    nextSeason: RENEWAL_NEXT_SEASON,
    kpis: {
      renewed,
      notRenewed,
      newClients,
      renewedPct: previousUnique > 0 ? (renewed / previousUnique) * 100 : 0,
      notRenewedPct:
        previousUnique > 0 ? (notRenewed / previousUnique) * 100 : 0,
      newClientsPct: nextUnique > 0 ? (newClients / nextUnique) * 100 : 0,
      previousUnique,
      nextUnique,
    },
    products,
  };
}

export function getRenewalSectionTitle(): string {
  return `Продление ${formatSubscriptionSeasonShort(RENEWAL_BASE_SEASON)} - ${formatSubscriptionSeasonShort(RENEWAL_NEXT_SEASON)}`;
}

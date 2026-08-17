import { DEFAULT_MATCH_SALES_FILTERS } from "@/lib/match-sales-filter-options";
import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  DEFAULT_MERCH_FILTERS,
} from "@/lib/merch-filter-options";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import {
  DEFAULT_TICKET_FILTERS,
  hasTransactionDateRangeFilter,
  isNoMatchesFilterValue,
} from "@/lib/ticket-filter-options";
import type {
  MatchSalesFilters,
  MerchFilters,
  SubscriptionFilters,
  TicketFilters,
} from "@/types/dashboard";

function countDiffs<T extends object>(
  current: T,
  defaults: T,
  checks: (keyof T)[],
): number {
  let count = 0;
  for (const key of checks) {
    const currentValue = current[key];
    const defaultValue = defaults[key];
    if (Array.isArray(currentValue) && Array.isArray(defaultValue)) {
      if (
        currentValue.length !== defaultValue.length ||
        currentValue.some((value, index) => value !== defaultValue[index])
      ) {
        count += 1;
      }
      continue;
    }
    if (currentValue !== defaultValue) {
      count += 1;
    }
  }
  return count;
}

export function countActiveTicketFilters(filters: TicketFilters): number {
  let count = countDiffs(filters, DEFAULT_TICKET_FILTERS, [
    "league",
    "tournamentStage",
    "matchClass",
    "arena",
    "eventCompleted",
    "ticketType",
    "priceZone",
    "orderSource",
    "timeGrouping",
  ]);

  if (filters.matchId.length > 0 && !isNoMatchesFilterValue(filters.matchId)) {
    count += 1;
  }

  if (hasTransactionDateRangeFilter(filters.transactionDateRange)) {
    count += 1;
  }

  if (filters.season !== DEFAULT_TICKET_FILTERS.season) {
    count += 1;
  }

  return count;
}

export function countActiveMerchFilters(filters: MerchFilters): number {
  let count = countDiffs(filters, DEFAULT_MERCH_FILTERS, [
    "league",
    "tournamentStage",
    "matchClass",
    "timeGrouping",
  ]);

  if (filters.matchId.length > 0 && !isNoMatchesFilterValue(filters.matchId)) {
    count += 1;
  }

  if (
    filters.salesChannels.length !== ALL_MERCH_SALES_POINTS.length ||
    filters.salesChannels.some(
      (channel) => !ALL_MERCH_SALES_POINTS.includes(channel),
    )
  ) {
    count += 1;
  }

  if (
    filters.productCategories.length !== ALL_MERCH_PRODUCT_CATEGORIES.length ||
    filters.productCategories.some(
      (category) => !ALL_MERCH_PRODUCT_CATEGORIES.includes(category),
    )
  ) {
    count += 1;
  }

  if (filters.orderDateRange.from !== null || filters.orderDateRange.to !== null) {
    count += 1;
  }

  if (filters.season !== DEFAULT_MERCH_FILTERS.season) {
    count += 1;
  }

  return count;
}

export function countActiveMatchSalesFilters(filters: MatchSalesFilters): number {
  let count = countDiffs(filters, DEFAULT_MATCH_SALES_FILTERS, [
    "league",
    "tournamentStage",
    "matchClass",
    "arena",
    "eventCompleted",
  ]);

  if (filters.matchId.length > 0 && !isNoMatchesFilterValue(filters.matchId)) {
    count += 1;
  }

  if (
    filters.purchaseDateRange.from !== null ||
    filters.purchaseDateRange.to !== null
  ) {
    count += 1;
  }

  if (filters.season !== DEFAULT_MATCH_SALES_FILTERS.season) {
    count += 1;
  }

  return count;
}

export function countActiveSubscriptionFilters(
  filters: SubscriptionFilters,
): number {
  let count = countDiffs(filters, DEFAULT_SUBSCRIPTION_FILTERS, [
    "league",
    "tournamentStage",
    "arena",
    "ticketType",
    "priceZone",
    "timeGrouping",
  ]);

  if (filters.season !== DEFAULT_SUBSCRIPTION_FILTERS.season) {
    count += 1;
  }

  return count;
}

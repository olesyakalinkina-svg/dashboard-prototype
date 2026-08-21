import type { SubscriptionPriceCategory } from "@/types/dashboard";

/** Shared bar colors for «Что покупают» and «Продление по продукту». */
export const SUBSCRIPTION_PRICE_CATEGORY_COLORS: Record<
  SubscriptionPriceCategory,
  string
> = {
  all_inclusive: "#5282FF",
  weekend: "#00BFA5",
  seasonal: "#FF7043",
};

export function getSubscriptionPriceCategoryColor(
  category: SubscriptionPriceCategory,
): string {
  return SUBSCRIPTION_PRICE_CATEGORY_COLORS[category];
}

import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  isMerchMatchTablePoint,
} from "@/lib/merch-filter-options";
import type { League, MatchClass, MerchFilters } from "@/types/dashboard";

/**
 * Match-level merch sales plan used by Merch → Продажи (Выручка fulfillment %).
 *
 * Data source: mock planning rates in this module, independent of realized merch
 * transactions (same idea as `getMatchPlanRevenue` for tickets). The table does
 * not store a plan on each SKU/channel; fulfillment is match-level only.
 *
 * Formula:
 *   crowd = attendance, or 60% of capacity when attendance is missing
 *   expected receipts = crowd × conversionRate(league)
 *   expected avg check = avgCheck(league) × classScale(matchClass)
 *   planRevenue = round(receipts × avgCheck × merchPlanScale(filters))
 *
 * Conversion and avg-check vary by league and class so fulfillment
 * (`revenue / planRevenue * 100`) differs across matches. When crowd is 0,
 * plan is 0 and the UI shows "—", not 0%.
 */

const MERCH_CONVERSION_BY_LEAGUE: Record<League, number> = {
  KHL: 0.0075,
  VHL: 0.01,
  MHL: 0.0045,
};

const MERCH_AVG_CHECK_BY_LEAGUE: Record<League, number> = {
  KHL: 4600,
  VHL: 3600,
  MHL: 2800,
};

const MERCH_CLASS_SCALE: Record<MatchClass, number> = {
  class_3: 0.9,
  class_2: 1,
  class_1: 1.12,
  playoff: 1.22,
};

export function getMatchMerchPlanCrowd(match: {
  attendance: number;
  capacity: number;
}): number {
  if (match.attendance > 0) return match.attendance;
  if (match.capacity > 0) return Math.round(match.capacity * 0.6);
  return 0;
}

export function getMatchMerchPlanRevenue(match: {
  league: League;
  matchClass: MatchClass;
  attendance: number;
  capacity: number;
}): number {
  const crowd = getMatchMerchPlanCrowd(match);
  if (crowd <= 0) return 0;
  const receipts = crowd * MERCH_CONVERSION_BY_LEAGUE[match.league];
  const avgCheck =
    MERCH_AVG_CHECK_BY_LEAGUE[match.league] * MERCH_CLASS_SCALE[match.matchClass];
  return Math.round(receipts * avgCheck);
}

/** Scale match plan when merch dimension filters are narrower than the full set. */
export function merchPlanScale(
  merchFilters: Pick<MerchFilters, "salesChannels" | "productCategories">,
): number {
  const matchPoints = ALL_MERCH_SALES_POINTS.filter((point) =>
    isMerchMatchTablePoint(point),
  );
  const selectedMatchPoints = merchFilters.salesChannels.filter((point) =>
    isMerchMatchTablePoint(point),
  );

  let scale = 1;
  if (matchPoints.length === 0 || selectedMatchPoints.length === 0) {
    scale = 0;
  } else if (selectedMatchPoints.length < matchPoints.length) {
    scale = selectedMatchPoints.length / matchPoints.length;
  }

  const categories = merchFilters.productCategories;
  if (categories.length === 0) return 0;
  if (categories.length < ALL_MERCH_PRODUCT_CATEGORIES.length) {
    scale *= categories.length / ALL_MERCH_PRODUCT_CATEGORIES.length;
  }
  return scale;
}

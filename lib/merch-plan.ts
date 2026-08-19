import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  isMerchMatchTablePoint,
} from "@/lib/merch-filter-options";
import type { League, MatchClass, MerchFilters } from "@/types/dashboard";

/**
 * Hard cap for Merch → Продажи «Выручка» fulfillment (actual / plan).
 * Outliers raise the stored match plan rather than showing 145%+.
 * Explicit `MERCH_PLAN_FULFILLMENT_BY_MATCH_ID` rows skip this cap.
 */
export const MAX_MERCH_PLAN_FULFILLMENT = 1.03;

/**
 * When ticket revenue/plan is at least 100% (Билеты «план выполнен»),
 * merch revenue/plan must sit in this band — never 145%, never a sold-out
 * match with merch stuck at 39%. Explicit match-id targets override this
 * (e.g. Торпедо 61% is allowed even when tickets are on plan).
 */
export const MIN_MERCH_PLAN_WHEN_TICKETS_MET = 0.75;
export const MAX_MERCH_PLAN_WHEN_TICKETS_MET = 1;

/**
 * Explicit Merch → Продажи fulfillment (actual / plan) for KHL 2025/26.
 * `plan = round(revenue / target)`. СКА and unlisted matches keep formula /
 * stored `merchPlanRevenue` (including the 103% and tickets-met 75–100% bands).
 */
export const MERCH_PLAN_FULFILLMENT_BY_MATCH_ID: Readonly<
  Record<string, number>
> = {
  "match-14": 0.61, // Торпедо
  "match-13": 0.7, // Сочи
  "match-12": 0.75, // Амур
  "match-11": 0.82, // Сибирь
  "match-10": 0.76, // Спартак
  "match-9": 0.95, // Динамо Минск
  "match-8": 0.69, // Салават Юлаев
  "match-7": 0.97, // Металлург
  "match-6": 1, // Трактор
  "match-5": 0.99, // Локомотив
  "match-4": 0.89, // Ак Барс
  "match-3": 0.98, // Авангард
  "match-2": 0.72, // ЦСКА
};

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
 * plan is 0 and the UI shows "—", not 0%. Stored `merchPlanRevenue` overrides
 * the formula when the generator raised the plan to the 103% (or 100%) cap.
 * `MERCH_PLAN_FULFILLMENT_BY_MATCH_ID` wins over both: plan = revenue / target.
 */

export type MatchMerchPlanInput = {
  id?: string;
  league: League;
  matchClass: MatchClass;
  attendance: number;
  capacity: number;
  merchPlanRevenue?: number;
};

export function explicitMerchPlanFulfillment(
  matchId: string | undefined,
): number | undefined {
  if (!matchId) return undefined;
  return MERCH_PLAN_FULFILLMENT_BY_MATCH_ID[matchId];
}

export function merchPlanRevenueForTarget(
  actualRevenue: number,
  targetRatio: number,
): number {
  if (!(actualRevenue > 0) || !(targetRatio > 0)) return 0;
  return Math.max(1, Math.round(actualRevenue / targetRatio));
}

/** Sets stored plan so Продажи shows the explicit list %. Returns true if applied. */
export function applyExplicitMatchMerchPlan(
  match: { id: string; merchPlanRevenue?: number },
  actualRevenue: number,
): boolean {
  const target = MERCH_PLAN_FULFILLMENT_BY_MATCH_ID[match.id];
  if (target == null) return false;
  const plan = merchPlanRevenueForTarget(actualRevenue, target);
  if (!(plan > 0)) return false;
  match.merchPlanRevenue = plan;
  return true;
}

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

export function baseMatchMerchPlanRevenue(match: MatchMerchPlanInput): number {
  const crowd = getMatchMerchPlanCrowd(match);
  if (crowd <= 0) return 0;
  const receipts = crowd * MERCH_CONVERSION_BY_LEAGUE[match.league];
  const avgCheck =
    MERCH_AVG_CHECK_BY_LEAGUE[match.league] * MERCH_CLASS_SCALE[match.matchClass];
  return Math.round(receipts * avgCheck);
}

export function getMatchMerchPlanRevenue(match: MatchMerchPlanInput): number {
  if (match.merchPlanRevenue != null && match.merchPlanRevenue > 0) {
    return match.merchPlanRevenue;
  }
  return baseMatchMerchPlanRevenue(match);
}

export function merchPlanCapForTicketFulfillment(
  ticketRevenuePlanMet: boolean,
): number {
  return ticketRevenuePlanMet
    ? MAX_MERCH_PLAN_WHEN_TICKETS_MET
    : MAX_MERCH_PLAN_FULFILLMENT;
}

/**
 * If realized match-table merch beats the formula plan past the cap
 * (103%, or 100% when tickets are already on plan), raise the stored plan
 * so the table % lands on the cap. Does not trim sales.
 */
export function applyMatchMerchPlanFulfillmentBand(
  match: MatchMerchPlanInput,
  actualRevenue: number,
  ticketRevenuePlanMet: boolean,
): void {
  if (explicitMerchPlanFulfillment(match.id) != null) return;
  const formula = baseMatchMerchPlanRevenue(match);
  if (!(formula > 0) || !(actualRevenue > 0)) return;
  const cap = merchPlanCapForTicketFulfillment(ticketRevenuePlanMet);
  if (actualRevenue <= formula * cap) return;
  match.merchPlanRevenue = Math.ceil(actualRevenue / cap);
}

/**
 * When tickets are on plan but merch is under 75% of the formula plan,
 * lower the stored merch plan so fulfillment lands on 75%.
 */
export function applyMatchMerchPlanFloorWhenTicketsMet(
  match: MatchMerchPlanInput,
  actualRevenue: number,
): void {
  if (explicitMerchPlanFulfillment(match.id) != null) return;
  const formula = baseMatchMerchPlanRevenue(match);
  if (!(formula > 0) || !(actualRevenue > 0)) return;
  if (actualRevenue >= formula * MIN_MERCH_PLAN_WHEN_TICKETS_MET) return;
  match.merchPlanRevenue = Math.max(
    1,
    Math.floor(actualRevenue / MIN_MERCH_PLAN_WHEN_TICKETS_MET),
  );
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

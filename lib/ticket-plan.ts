import type { League, MatchClass, TournamentStage } from "@/types/dashboard";

export const MAIN_ARENA_CAPACITY = 12000;
export const SECONDARY_ARENA_CAPACITY = 3000;
/** MHL home games use a partial bowl on the main arena (~52% of seats). */
export const MHL_ARENA_CAPACITY = 6300;

export const TICKET_PLAN_FILL_RATE = 0.82;
/**
 * Baseline KHL plan average ticket price (class_2).
 * Kept at catalog scale so unit prices fill all four cost buckets
 * (до 1500 … от 4000 до 6000) instead of collapsing near 310 ₽.
 */
export const TICKET_PLAN_AVG_PRICE = 1750;
/** Same catalog baseline; the 310 ₽ crush is no longer applied to zone prices. */
export const LEGACY_TICKET_PLAN_AVG_PRICE = 1750;

/** Class tiers keep the former 250/310/420/480 ratios on the catalog baseline. */
const KHL_PLAN_AVG_PRICE_BY_CLASS: Record<MatchClass, number> = {
  class_3: Math.round(TICKET_PLAN_AVG_PRICE * (250 / 310)),
  class_2: TICKET_PLAN_AVG_PRICE,
  class_1: Math.round(TICKET_PLAN_AVG_PRICE * (420 / 310)),
  playoff: Math.round(TICKET_PLAN_AVG_PRICE * (480 / 310)),
};

/** Same class tier ratios as KHL, applied to each league's baseline avg price. */
const CLASS_PRICE_SCALE: Record<MatchClass, number> = {
  class_3: KHL_PLAN_AVG_PRICE_BY_CLASS.class_3 / TICKET_PLAN_AVG_PRICE,
  class_2: 1,
  class_1: KHL_PLAN_AVG_PRICE_BY_CLASS.class_1 / TICKET_PLAN_AVG_PRICE,
  playoff: KHL_PLAN_AVG_PRICE_BY_CLASS.playoff / TICKET_PLAN_AVG_PRICE,
};

const VHL_BASE_AVG_PRICE = 1100;
const MHL_BASE_AVG_PRICE = 700;

export type MatchTicketPlanProfile = {
  fillRate: number;
  avgPrice: number;
};

export function getKhlPlanAvgPrice(matchClass: MatchClass): number {
  return KHL_PLAN_AVG_PRICE_BY_CLASS[matchClass] ?? TICKET_PLAN_AVG_PRICE;
}

export function getVhlPlanAvgPrice(matchClass: MatchClass): number {
  return Math.round(VHL_BASE_AVG_PRICE * CLASS_PRICE_SCALE[matchClass]);
}

export function getMhlPlanAvgPrice(matchClass: MatchClass): number {
  return Math.round(MHL_BASE_AVG_PRICE * CLASS_PRICE_SCALE[matchClass]);
}

/** Class 1 and playoff games are treated as sold out (100% occupancy). */
export function isSoldOutOccupancyMatch(match: {
  matchClass: MatchClass;
  tournamentStage?: TournamentStage;
}): boolean {
  return (
    match.matchClass === "class_1" ||
    match.matchClass === "playoff" ||
    match.tournamentStage === "playoff"
  );
}

export function getMatchTicketPlanProfile(match: {
  league: League;
  matchClass: MatchClass;
}): MatchTicketPlanProfile {
  switch (match.league) {
    case "VHL":
      return {
        fillRate: TICKET_PLAN_FILL_RATE,
        avgPrice: getVhlPlanAvgPrice(match.matchClass),
      };
    case "MHL":
      return {
        fillRate: TICKET_PLAN_FILL_RATE,
        avgPrice: getMhlPlanAvgPrice(match.matchClass),
      };
    default:
      return {
        fillRate: TICKET_PLAN_FILL_RATE,
        avgPrice: getKhlPlanAvgPrice(match.matchClass),
      };
  }
}

export function getMatchPlanTickets(match: {
  league: League;
  matchClass: MatchClass;
  capacity: number;
}): number {
  const profile = getMatchTicketPlanProfile(match);
  return Math.round(match.capacity * profile.fillRate);
}

export function getMatchPlanRevenue(match: {
  league: League;
  matchClass: MatchClass;
  capacity: number;
}): number {
  const profile = getMatchTicketPlanProfile(match);
  const planTickets = getMatchPlanTickets(match);
  return Math.round(planTickets * profile.avgPrice);
}

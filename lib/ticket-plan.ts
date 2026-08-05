import type { League, MatchClass } from "@/types/dashboard";

export const MAIN_ARENA_CAPACITY = 12000;
export const SECONDARY_ARENA_CAPACITY = 3000;
/** MHL home games use a partial bowl on the main arena (~52% of seats). */
export const MHL_ARENA_CAPACITY = 6300;

export const TICKET_PLAN_FILL_RATE = 0.82;
/** Baseline KHL plan average ticket price (class_2). */
export const TICKET_PLAN_AVG_PRICE = 310;
/** Legacy baseline used before the 2–4.5M KHL revenue retune. */
export const LEGACY_TICKET_PLAN_AVG_PRICE = 1750;

const KHL_PLAN_AVG_PRICE_BY_CLASS: Record<MatchClass, number> = {
  class_3: 250,
  class_2: TICKET_PLAN_AVG_PRICE,
  class_1: 420,
  playoff: 480,
};

export type MatchTicketPlanProfile = {
  fillRate: number;
  avgPrice: number;
};

export function getKhlPlanAvgPrice(matchClass: MatchClass): number {
  return KHL_PLAN_AVG_PRICE_BY_CLASS[matchClass] ?? TICKET_PLAN_AVG_PRICE;
}

export function getMatchTicketPlanProfile(match: {
  league: League;
  matchClass: MatchClass;
}): MatchTicketPlanProfile {
  switch (match.league) {
    case "VHL":
      return { fillRate: TICKET_PLAN_FILL_RATE, avgPrice: 1100 };
    case "MHL":
      return { fillRate: TICKET_PLAN_FILL_RATE, avgPrice: 700 };
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

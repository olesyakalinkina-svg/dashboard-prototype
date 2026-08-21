import type { ArenaId, League, MatchClass, TournamentStage } from "@/types/dashboard";

export const MAIN_ARENA_CAPACITY = 12000;
export const SECONDARY_ARENA_CAPACITY = 4000;
/** MHL home games use a partial bowl on the main arena (~52% of seats). */
export const MHL_ARENA_CAPACITY = 6300;

export const TICKET_PLAN_FILL_RATE = 0.82;
/**
 * Baseline KHL plan average ticket price (class_2).
 * Kept at catalog scale so unit prices fill all six cost buckets
 * (500 … 3000) instead of collapsing near 310 ₽.
 */
export const TICKET_PLAN_AVG_PRICE = 1750;
/** Same catalog baseline; the 310 ₽ crush is no longer applied to zone prices. */
export const LEGACY_TICKET_PLAN_AVG_PRICE = 1750;

/**
 * Per-match and tickets-tab KPI cap: actual / plan ≤ 105%.
 * When realized sales exceed this, the plan is raised (not the UI %).
 */
export const MAX_TICKET_PLAN_FULFILLMENT = 1.05;

/**
 * Class 2 and class 3 (regular, not playoff): actual / plan ≤ 90%.
 * When realized revenue exceeds this, the stored plan is raised.
 * Playoff and class 1 keep the 105% cap (and 99% sold-out floor).
 */
export const MAX_REGULAR_TICKET_PLAN_FULFILLMENT = 0.9;

/**
 * Class 1 and playoff (sold-out) matches: actual / plan ≥ 99%.
 * When realized revenue is below this, the stored plan is lowered.
 */
export const MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT = 0.99;

/**
 * If actual / plan is above this, occupancy
 * (arena+parking issued) / (arenaCap+parkingCap) must be at least
 * `MIN_HIGH_REVENUE_OCCUPANCY` (and at most 100%). The 89–95% revenue
 * band is inclusive of 95%, so this floor applies only when fulfillment
 * is strictly greater than 95% and less than 100%.
 */
export const HIGH_REVENUE_PLAN_THRESHOLD = 0.95;
export const MIN_HIGH_REVENUE_OCCUPANCY = 0.96;

/**
 * If actual / plan is in `[MID_REVENUE_PLAN_MIN, HIGH_REVENUE_PLAN_THRESHOLD]`,
 * occupancy must be in `[MID_REVENUE_PLAN_MIN, MAX_MID_REVENUE_OCCUPANCY]`.
 */
export const MID_REVENUE_PLAN_MIN = 0.89;
export const MAX_MID_REVENUE_OCCUPANCY = 0.96;

/**
 * If actual / plan is at least this, occupancy must be 100% (the product
 * cap). Продажи «Оформлено» uses arena+parking mass; the zone-sector widget
 * uses arena fill only. Never display occupancy above 100%.
 */
export const OVER_PLAN_REVENUE_THRESHOLD = 1;
export const MIN_OVER_PLAN_OCCUPANCY = 1;

/**
 * Fixed parking inventory per bowl (not 12% of tickets sold).
 * Main KHL: 1440. Secondary VHL: 800. MHL partial bowl: 756.
 */
export const PARKING_CAPACITY_MAIN = 1440;
export const PARKING_CAPACITY_SECONDARY = 800;
export const PARKING_CAPACITY_MHL = 756;
/** Filter-share when a ticket-type cut is applied to match plan (arena vs parking). */
export const TICKET_PLAN_PARKING_SHARE = 0.12;
export const TICKET_PLAN_PARKING_UNIT_PRICE = 500;

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

export type MatchTicketPlanInput = {
  league: League;
  matchClass: MatchClass;
  capacity: number;
  arena?: ArenaId;
  tournamentStage?: TournamentStage;
  ticketPlanTickets?: number;
  ticketPlanRevenue?: number;
};

export type ParkingCapacityMatch = {
  capacity: number;
  arena?: ArenaId;
  league?: League;
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
  tournamentStage?: TournamentStage;
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

/** Arena seat plan only (no parking). Regular fill is 82% of capacity. */
export function getMatchPlanArenaTickets(match: MatchTicketPlanInput): number {
  const profile = getMatchTicketPlanProfile(match);
  return Math.round(match.capacity * profile.fillRate);
}

export function getMatchPlanParkingTickets(match: MatchTicketPlanInput): number {
  const parkingCap = getMatchParkingCapacity(match);
  if (parkingCap <= 0) return 0;
  const profile = getMatchTicketPlanProfile(match);
  return Math.round(parkingCap * profile.fillRate);
}

function baseMatchPlanTickets(match: MatchTicketPlanInput): number {
  return getMatchPlanArenaTickets(match) + getMatchPlanParkingTickets(match);
}

function baseMatchPlanRevenue(match: MatchTicketPlanInput): number {
  const profile = getMatchTicketPlanProfile(match);
  const arenaTickets = getMatchPlanArenaTickets(match);
  const parkingTickets = getMatchPlanParkingTickets(match);
  return Math.round(
    arenaTickets * profile.avgPrice +
      parkingTickets * TICKET_PLAN_PARKING_UNIT_PRICE,
  );
}

/** Arena + parking ticket-count plan (what «Проданные билеты» compares to). */
export function getMatchPlanTickets(match: MatchTicketPlanInput): number {
  if (match.ticketPlanTickets != null && match.ticketPlanTickets > 0) {
    return match.ticketPlanTickets;
  }
  return baseMatchPlanTickets(match);
}

export function getMatchPlanRevenue(match: MatchTicketPlanInput): number {
  if (match.ticketPlanRevenue != null && match.ticketPlanRevenue > 0) {
    return match.ticketPlanRevenue;
  }
  return baseMatchPlanRevenue(match);
}

/** Билеты Продажи: revenue / plan ≥ 100% means the ticket sales plan is met. */
export function isTicketRevenuePlanMet(
  match: MatchTicketPlanInput,
  actualRevenue: number,
): boolean {
  const plan = getMatchPlanRevenue(match);
  return plan > 0 && actualRevenue / plan >= OVER_PLAN_REVENUE_THRESHOLD;
}

/**
 * Arena-seat share of the ticket revenue plan (parking excluded).
 * Uses the same stored `ticketPlanRevenue` as «Продажи» when the 105%
 * cap (or other band) raised the plan; otherwise `arenaTickets × avgPrice`.
 */
export function getMatchPlanArenaRevenue(match: MatchTicketPlanInput): number {
  const profile = getMatchTicketPlanProfile(match);
  const arenaBase = Math.round(
    getMatchPlanArenaTickets(match) * profile.avgPrice,
  );
  const fullBase = baseMatchPlanRevenue(match);
  if (!(fullBase > 0)) return arenaBase;
  return Math.round((getMatchPlanRevenue(match) * arenaBase) / fullBase);
}

function planCeilingForActual(
  actual: number,
  plan: number,
  cap = MAX_TICKET_PLAN_FULFILLMENT,
): number | undefined {
  if (!(plan > 0) || !(actual > 0)) return undefined;
  if (actual <= plan * cap) return undefined;
  return Math.ceil(actual / cap);
}

export function isRegularTicketPlanMatch(match: {
  matchClass: MatchClass;
  tournamentStage?: TournamentStage;
}): boolean {
  if (isSoldOutOccupancyMatch(match)) return false;
  return match.matchClass === "class_2" || match.matchClass === "class_3";
}

export function maxRevenuePlanFulfillment(match: {
  matchClass: MatchClass;
  tournamentStage?: TournamentStage;
}): number {
  if (isRegularTicketPlanMatch(match)) return MAX_REGULAR_TICKET_PLAN_FULFILLMENT;
  return MAX_TICKET_PLAN_FULFILLMENT;
}

/** Fixed parking stalls for a known bowl size. Never `sold × 0.12`. */
export function parkingCapacityForArenaSeats(arenaCapacity: number): number {
  if (!(arenaCapacity > 0)) return 0;
  if (arenaCapacity === SECONDARY_ARENA_CAPACITY) return PARKING_CAPACITY_SECONDARY;
  if (arenaCapacity === MHL_ARENA_CAPACITY) return PARKING_CAPACITY_MHL;
  return PARKING_CAPACITY_MAIN;
}

/** Fixed parking inventory for the match bowl (0 when there are no seats). */
export function getMatchParkingCapacity(match: ParkingCapacityMatch): number {
  if (!(match.capacity > 0)) return 0;
  if (match.league === "MHL") return PARKING_CAPACITY_MHL;
  if (match.arena === "secondary") return PARKING_CAPACITY_SECONDARY;
  if (match.arena === "main") return PARKING_CAPACITY_MAIN;
  return parkingCapacityForArenaSeats(match.capacity);
}

/** 100% for «Оформлено»: arena seats + fixed parking inventory. */
export function getMatchOccupancyCapacity(match: ParkingCapacityMatch): number {
  if (!(match.capacity > 0)) return 0;
  return match.capacity + getMatchParkingCapacity(match);
}

export function occupancyMassCapacity(arenaCapacity: number): number {
  if (!(arenaCapacity > 0)) return 0;
  return arenaCapacity + parkingCapacityForArenaSeats(arenaCapacity);
}

/**
 * Occupancy / fill for «Оформлено»:
 * (arena issued + parking issued) / (arenaCap + fixed parkingCap) × 100,
 * capped at 100%.
 */
export function issuedOccupancyPercent(
  issuedTickets: number,
  arenaCapacity: number | null | undefined,
): number | null {
  if (arenaCapacity == null || !(arenaCapacity > 0)) return null;
  const denom = occupancyMassCapacity(arenaCapacity);
  if (!(denom > 0)) return null;
  return Math.min(100, (issuedTickets / denom) * 100);
}

/**
 * If realized tickets beat the formula plan by more than 105%, or revenue
 * beats the class cap (90% for class 2/3, 105% otherwise), raise the stored
 * plan so fulfillment lands on the cap (do not trim sales).
 */
export function raiseMatchTicketPlanToFulfillmentCap(
  match: MatchTicketPlanInput,
  actual: { tickets: number; revenue: number; arenaRevenue?: number },
): void {
  const ticketsFloor = planCeilingForActual(
    actual.tickets,
    baseMatchPlanTickets(match),
  );
  if (ticketsFloor != null) {
    match.ticketPlanTickets = ticketsFloor;
  }
  const cap = maxRevenuePlanFulfillment(match);
  const revenueFloor = planCeilingForActual(
    actual.revenue,
    baseMatchPlanRevenue(match),
    cap,
  );
  if (revenueFloor != null) {
    match.ticketPlanRevenue = revenueFloor;
  }
  raiseRevenuePlanWhenArenaOverCap(match, actual, cap);
}

function revenuePlanRatioOverCap(
  match: MatchTicketPlanInput,
  actual: { revenue: number; arenaRevenue?: number },
  cap: number,
): boolean {
  const plan = getMatchPlanRevenue(match);
  if (plan > 0 && actual.revenue > plan * cap) return true;
  if (actual.arenaRevenue == null || !(actual.arenaRevenue > 0)) return false;
  const arenaPlan = getMatchPlanArenaRevenue(match);
  return arenaPlan > 0 && actual.arenaRevenue > arenaPlan * cap;
}

function bumpStoredRevenuePlanUntilAtMost(
  match: MatchTicketPlanInput,
  actual: { revenue: number; arenaRevenue?: number },
  cap: number,
): void {
  let guard = 0;
  while (revenuePlanRatioOverCap(match, actual, cap) && guard++ < 10_000) {
    const plan = getMatchPlanRevenue(match);
    match.ticketPlanRevenue = plan + 1;
  }
}

function dropStoredRevenuePlanUntilAtLeast(
  match: MatchTicketPlanInput,
  actual: { revenue: number; arenaRevenue?: number },
  floor: number,
): void {
  let guard = 0;
  while (guard++ < 10_000) {
    const plan = getMatchPlanRevenue(match);
    if (!(plan > 1)) return;
    const underFull = actual.revenue / plan < floor - 1e-12;
    const arenaPlan = getMatchPlanArenaRevenue(match);
    const underArena =
      actual.arenaRevenue != null &&
      actual.arenaRevenue > 0 &&
      arenaPlan > 1 &&
      actual.arenaRevenue / arenaPlan < floor - 1e-12;
    if (!underFull && !underArena) return;
    match.ticketPlanRevenue = plan - 1;
  }
}

function raiseRevenuePlanWhenArenaOverCap(
  match: MatchTicketPlanInput,
  actual: { arenaRevenue?: number },
  cap: number,
): void {
  if (actual.arenaRevenue == null || !(actual.arenaRevenue > 0)) return;
  const arenaPlan = getMatchPlanArenaRevenue(match);
  if (!(arenaPlan > 0) || actual.arenaRevenue <= arenaPlan * cap) return;
  setMatchPlanForArenaFulfillment(match, actual.arenaRevenue, cap);
}

function raiseRegularMatchRevenuePlanToCap(
  match: MatchTicketPlanInput,
  actual: { revenue: number; arenaRevenue?: number },
): void {
  if (!isRegularTicketPlanMatch(match)) return;
  const next = planCeilingForActual(
    actual.revenue,
    getMatchPlanRevenue(match),
    MAX_REGULAR_TICKET_PLAN_FULFILLMENT,
  );
  if (next != null) {
    match.ticketPlanRevenue = next;
  }
  raiseRevenuePlanWhenArenaOverCap(
    match,
    actual,
    MAX_REGULAR_TICKET_PLAN_FULFILLMENT,
  );
}

function soldOutRevenuePlanFloor(
  actual: number,
  plan: number,
): number | undefined {
  if (!(plan > 0) || !(actual > 0)) return undefined;
  if (actual >= plan * MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT) return undefined;
  const next = Math.max(
    1,
    Math.floor(actual / MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT),
  );
  if (next >= plan) return undefined;
  return next;
}

export function minHighRevenueOccupancyIssued(arenaCapacity: number): number {
  const mass = occupancyMassCapacity(arenaCapacity);
  if (!(mass > 0)) return 0;
  return Math.ceil(mass * MIN_HIGH_REVENUE_OCCUPANCY);
}

export function minMidRevenueOccupancyIssued(arenaCapacity: number): number {
  const mass = occupancyMassCapacity(arenaCapacity);
  if (!(mass > 0)) return 0;
  return Math.ceil(mass * MID_REVENUE_PLAN_MIN);
}

export function maxMidRevenueOccupancyIssued(arenaCapacity: number): number {
  const mass = occupancyMassCapacity(arenaCapacity);
  if (!(mass > 0)) return 0;
  return Math.floor(mass * MAX_MID_REVENUE_OCCUPANCY);
}

function occupancyShare(issued: number, mass: number): number {
  return mass > 0 ? issued / mass : 0;
}

/**
 * When occupancy is still under 96% and revenue/plan is in (95%, 100%),
 * raise the stored revenue plan so the UI % is at most 95%. The generator
 * prefers to fill empty seats first; this is the fallback so the table
 * does not lie. Matches already at ≥100% of plan are left for the fill
 * pass (those must show 100% issued, not a lowered %).
 */
function raiseRevenuePlanWhenHighRevenueOccupancyMissing(
  match: MatchTicketPlanInput,
  actual: { revenue: number; occupancyIssued?: number },
): void {
  if (actual.occupancyIssued == null) return;
  if (!(match.capacity > 0)) return;
  const occupancyMass = occupancyMassCapacity(match.capacity);
  const occ = occupancyShare(actual.occupancyIssued, occupancyMass);
  if (occ >= MIN_HIGH_REVENUE_OCCUPANCY) return;
  const plan = getMatchPlanRevenue(match);
  if (!(plan > 0) || !(actual.revenue > 0)) return;
  const ratio = actual.revenue / plan;
  if (ratio <= HIGH_REVENUE_PLAN_THRESHOLD) return;
  if (ratio >= OVER_PLAN_REVENUE_THRESHOLD) return;
  match.ticketPlanRevenue = Math.ceil(
    actual.revenue / HIGH_REVENUE_PLAN_THRESHOLD,
  );
}

function raiseRevenuePlanWhenMidRevenueOccupancyMissing(
  match: MatchTicketPlanInput,
  actual: { revenue: number; occupancyIssued?: number },
): void {
  if (actual.occupancyIssued == null) return;
  if (!(match.capacity > 0)) return;
  const occupancyMass = occupancyMassCapacity(match.capacity);
  const occ = occupancyShare(actual.occupancyIssued, occupancyMass);
  if (occ >= MID_REVENUE_PLAN_MIN) return;
  const plan = getMatchPlanRevenue(match);
  if (!(plan > 0) || !(actual.revenue > 0)) return;
  const ratio = actual.revenue / plan;
  if (ratio < MID_REVENUE_PLAN_MIN || ratio > HIGH_REVENUE_PLAN_THRESHOLD) {
    return;
  }
  let next = Math.ceil(actual.revenue / MID_REVENUE_PLAN_MIN);
  while (
    next > 0 &&
    actual.revenue / next >= MID_REVENUE_PLAN_MIN
  ) {
    next += 1;
  }
  match.ticketPlanRevenue = next;
}

function lowerRevenuePlanWhenMidRevenueOccupancyHigh(
  match: MatchTicketPlanInput,
  actual: { revenue: number; occupancyIssued?: number },
): void {
  if (actual.occupancyIssued == null) return;
  if (!(match.capacity > 0)) return;
  const occupancyMass = occupancyMassCapacity(match.capacity);
  const occ = occupancyShare(actual.occupancyIssued, occupancyMass);
  if (occ <= MAX_MID_REVENUE_OCCUPANCY) return;
  const plan = getMatchPlanRevenue(match);
  if (!(plan > 0) || !(actual.revenue > 0)) return;
  const ratio = actual.revenue / plan;
  if (ratio < MID_REVENUE_PLAN_MIN || ratio > HIGH_REVENUE_PLAN_THRESHOLD) {
    return;
  }
  let next = Math.max(
    1,
    Math.floor(actual.revenue / (HIGH_REVENUE_PLAN_THRESHOLD + 1e-12)),
  );
  if (actual.revenue / next <= HIGH_REVENUE_PLAN_THRESHOLD) {
    next = Math.max(1, next - 1);
  }
  if (
    occ < OVER_PLAN_REVENUE_THRESHOLD &&
    actual.revenue / next >= OVER_PLAN_REVENUE_THRESHOLD
  ) {
    next = Math.max(next, Math.floor(actual.revenue) + 1);
  }
  if (next < plan) {
    match.ticketPlanRevenue = next;
  }
}

export type MatchTicketPlanActuals = {
  tickets: number;
  revenue: number;
  occupancyIssued?: number;
  arenaRevenue?: number;
  arenaIssued?: number;
};

export function setMatchPlanForArenaFulfillment(
  match: MatchTicketPlanInput,
  arenaRevenue: number,
  targetRatio: number,
): void {
  if (!(arenaRevenue > 0) || !(targetRatio > 0)) return;
  const currentArena = getMatchPlanArenaRevenue(match);
  const currentFull = getMatchPlanRevenue(match);
  if (!(currentArena > 0) || !(currentFull > 0)) return;
  const targetArenaPlan = Math.max(1, Math.ceil(arenaRevenue / targetRatio));
  match.ticketPlanRevenue = Math.max(
    1,
    Math.round((targetArenaPlan * currentFull) / currentArena),
  );
}

function reconcileArenaOccupancyRevenueBand(
  match: MatchTicketPlanInput,
  actual: MatchTicketPlanActuals,
): void {
  if (actual.arenaIssued == null || actual.arenaRevenue == null) return;
  if (!(match.capacity > 0) || !(actual.arenaRevenue > 0)) return;
  const occ = actual.arenaIssued / match.capacity;
  const arenaPlan = getMatchPlanArenaRevenue(match);
  if (!(arenaPlan > 0)) return;
  const ratio = actual.arenaRevenue / arenaPlan;
  if (occ >= MIN_OVER_PLAN_OCCUPANCY - 1e-12) return;

  if (ratio >= OVER_PLAN_REVENUE_THRESHOLD) {
    if (isRegularTicketPlanMatch(match)) {
      setMatchPlanForArenaFulfillment(
        match,
        actual.arenaRevenue,
        MAX_REGULAR_TICKET_PLAN_FULFILLMENT,
      );
      return;
    }
    if (occ >= MID_REVENUE_PLAN_MIN && occ <= MAX_MID_REVENUE_OCCUPANCY) {
      setMatchPlanForArenaFulfillment(
        match,
        actual.arenaRevenue,
        HIGH_REVENUE_PLAN_THRESHOLD,
      );
    } else if (occ >= MIN_HIGH_REVENUE_OCCUPANCY) {
      setMatchPlanForArenaFulfillment(
        match,
        actual.arenaRevenue,
        OVER_PLAN_REVENUE_THRESHOLD - 1e-6,
      );
    }
    return;
  }

  if (ratio > HIGH_REVENUE_PLAN_THRESHOLD && occ < MIN_HIGH_REVENUE_OCCUPANCY) {
    setMatchPlanForArenaFulfillment(
      match,
      actual.arenaRevenue,
      HIGH_REVENUE_PLAN_THRESHOLD,
    );
    return;
  }

  if (ratio >= MID_REVENUE_PLAN_MIN && ratio <= HIGH_REVENUE_PLAN_THRESHOLD) {
    if (isRegularTicketPlanMatch(match)) return;
    if (occ < MID_REVENUE_PLAN_MIN) {
      setMatchPlanForArenaFulfillment(
        match,
        actual.arenaRevenue,
        MID_REVENUE_PLAN_MIN - 1e-6,
      );
    } else if (occ > MAX_MID_REVENUE_OCCUPANCY) {
      setMatchPlanForArenaFulfillment(
        match,
        actual.arenaRevenue,
        HIGH_REVENUE_PLAN_THRESHOLD + 1e-6,
      );
    }
  }
}

/**
 * Cap class 2/3 at 90% of plan, everyone else at 105%. Keep class 1 /
 * playoff revenue in [99%, 105%], then keep occupancy bands consistent
 * with revenue/plan when the generator could not fill remaining seats.
 */
export function applyMatchTicketPlanFulfillmentBand(
  match: MatchTicketPlanInput,
  actual: MatchTicketPlanActuals,
): void {
  raiseMatchTicketPlanToFulfillmentCap(match, actual);
  if (isSoldOutOccupancyMatch(match)) {
    const floor = soldOutRevenuePlanFloor(
      actual.revenue,
      getMatchPlanRevenue(match),
    );
    if (floor != null) {
      match.ticketPlanRevenue = floor;
    }
    if (actual.arenaRevenue != null && actual.arenaRevenue > 0) {
      const arenaFloor = soldOutRevenuePlanFloor(
        actual.arenaRevenue,
        getMatchPlanArenaRevenue(match),
      );
      if (arenaFloor != null) {
        setMatchPlanForArenaFulfillment(
          match,
          actual.arenaRevenue,
          MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT,
        );
      }
    }
  }
  if (!isRegularTicketPlanMatch(match)) {
    raiseRevenuePlanWhenHighRevenueOccupancyMissing(match, actual);
    raiseRevenuePlanWhenMidRevenueOccupancyMissing(match, actual);
    lowerRevenuePlanWhenMidRevenueOccupancyHigh(match, actual);
  }
  reconcileArenaOccupancyRevenueBand(match, actual);
  raiseRegularMatchRevenuePlanToCap(match, actual);
  if (isSoldOutOccupancyMatch(match)) {
    dropStoredRevenuePlanUntilAtLeast(
      match,
      actual,
      MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT,
    );
  }
  bumpStoredRevenuePlanUntilAtMost(
    match,
    actual,
    maxRevenuePlanFulfillment(match),
  );
}

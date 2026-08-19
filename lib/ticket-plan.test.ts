import { describe, expect, it } from "vitest";
import type { Match } from "@/types/dashboard";
import {
  getMatchPlanArenaRevenue,
  getMatchPlanArenaTickets,
  getMatchPlanParkingTickets,
  getMatchPlanRevenue,
  getMatchPlanTickets,
  MAX_REGULAR_TICKET_PLAN_FULFILLMENT,
  MAX_TICKET_PLAN_FULFILLMENT,
  MID_REVENUE_PLAN_MIN,
  MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT,
  applyMatchTicketPlanFulfillmentBand,
  issuedOccupancyPercent,
  minHighRevenueOccupancyIssued,
  occupancyMassCapacity,
  PARKING_CAPACITY_MAIN,
  PARKING_CAPACITY_MHL,
  PARKING_CAPACITY_SECONDARY,
  parkingCapacityForArenaSeats,
  getMatchParkingCapacity,
  SECONDARY_ARENA_CAPACITY,
  raiseMatchTicketPlanToFulfillmentCap,
  TICKET_PLAN_FILL_RATE,
  TICKET_PLAN_PARKING_UNIT_PRICE,
} from "@/lib/ticket-plan";

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    date: new Date(2025, 9, 15),
    opponent: "СКА",
    attendance: 10_000,
    capacity: 12_000,
    season: "2025/26",
    league: "KHL",
    tournamentStage: "regular",
    matchClass: "class_2",
    arena: "main",
    eventCompleted: true,
    ticketSalesWindowDays: 14,
    ...overrides,
  };
}

describe("ticket match sales plan", () => {
  it("plans 82% of seats plus 82% of fixed parking inventory", () => {
    const regular = match();
    const arena = getMatchPlanArenaTickets(regular);
    expect(arena).toBe(Math.round(12_000 * TICKET_PLAN_FILL_RATE));
    expect(getMatchPlanParkingTickets(regular)).toBe(
      Math.round(PARKING_CAPACITY_MAIN * TICKET_PLAN_FILL_RATE),
    );
    expect(getMatchPlanTickets(regular)).toBe(
      arena + getMatchPlanParkingTickets(regular),
    );
  });

  it("uses the same 82% seat fill plus parking for class_1", () => {
    const soldOut = match({ matchClass: "class_1" });
    const arena = getMatchPlanArenaTickets(soldOut);
    expect(arena).toBe(Math.round(12_000 * TICKET_PLAN_FILL_RATE));
    expect(getMatchPlanTickets(soldOut)).toBe(
      arena + Math.round(PARKING_CAPACITY_MAIN * TICKET_PLAN_FILL_RATE),
    );
  });

  it("includes parking revenue at the parking unit price, not the seat avg", () => {
    const regular = match();
    const arena = getMatchPlanArenaTickets(regular);
    const parking = getMatchPlanParkingTickets(regular);
    const revenue = getMatchPlanRevenue(regular);
    expect(parking).toBeGreaterThan(0);
    expect(revenue).toBe(Math.round(arena * 1750 + parking * TICKET_PLAN_PARKING_UNIT_PRICE));
    expect(revenue).toBeGreaterThan(arena * 1750);
  });

  it("arena revenue plan excludes parking and scales with stored ticketPlanRevenue", () => {
    const regular = match();
    const arena = getMatchPlanArenaTickets(regular);
    const parking = getMatchPlanParkingTickets(regular);
    const arenaPlan = getMatchPlanArenaRevenue(regular);
    const fullPlan = getMatchPlanRevenue(regular);
    expect(arenaPlan).toBe(Math.round(arena * 1750));
    expect(arenaPlan).toBeLessThan(fullPlan);
    expect(fullPlan - arenaPlan).toBe(Math.round(parking * TICKET_PLAN_PARKING_UNIT_PRICE));

    regular.ticketPlanRevenue = fullPlan * 2;
    expect(getMatchPlanArenaRevenue(regular)).toBe(arenaPlan * 2);
  });

  it("raises stored plan when class_1 actuals would exceed 105%", () => {
    const row = match({ matchClass: "class_1" });
    const planTickets = getMatchPlanTickets(row);
    const planRevenue = getMatchPlanRevenue(row);
    raiseMatchTicketPlanToFulfillmentCap(row, {
      tickets: Math.round(planTickets * 1.2),
      revenue: Math.round(planRevenue * 1.2),
    });
    expect(row.ticketPlanTickets).toBe(
      Math.ceil((planTickets * 1.2) / MAX_TICKET_PLAN_FULFILLMENT),
    );
    expect(row.ticketPlanRevenue).toBe(
      Math.ceil((planRevenue * 1.2) / MAX_TICKET_PLAN_FULFILLMENT),
    );
    expect(Math.round(planTickets * 1.2) / getMatchPlanTickets(row)).toBeLessThanOrEqual(
      MAX_TICKET_PLAN_FULFILLMENT + 1e-9,
    );
    expect(Math.round(planRevenue * 1.2) / getMatchPlanRevenue(row)).toBeLessThanOrEqual(
      MAX_TICKET_PLAN_FULFILLMENT + 1e-9,
    );
  });

  it("raises stored plan when class_2 revenue would exceed 90%", () => {
    const row = match({ matchClass: "class_2" });
    const planRevenue = getMatchPlanRevenue(row);
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: getMatchPlanTickets(row),
      revenue: Math.round(planRevenue * 1.05),
    });
    expect(row.ticketPlanRevenue).toBe(
      Math.ceil((planRevenue * 1.05) / MAX_REGULAR_TICKET_PLAN_FULFILLMENT),
    );
    expect(
      Math.round(planRevenue * 1.05) / getMatchPlanRevenue(row),
    ).toBeLessThanOrEqual(MAX_REGULAR_TICKET_PLAN_FULFILLMENT + 1e-9);
  });

  it("does not raise plan when actuals are within 105%", () => {
    const row = match();
    const planTickets = getMatchPlanTickets(row);
    const planRevenue = getMatchPlanRevenue(row);
    raiseMatchTicketPlanToFulfillmentCap(row, {
      tickets: Math.round(planTickets * 0.7),
      revenue: Math.round(planRevenue * 0.7),
    });
    expect(row.ticketPlanTickets).toBeUndefined();
    expect(row.ticketPlanRevenue).toBeUndefined();
  });

  it("lowers class_1 revenue plan so sold-out fulfillment is at least 99%", () => {
    const row = match({ matchClass: "class_1" });
    const planRevenue = getMatchPlanRevenue(row);
    const actualRevenue = Math.round(planRevenue * 0.82);
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: getMatchPlanTickets(row),
      revenue: actualRevenue,
    });
    expect(row.ticketPlanRevenue).toBe(
      Math.floor(actualRevenue / MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT),
    );
    expect(actualRevenue / getMatchPlanRevenue(row)).toBeGreaterThanOrEqual(
      MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT - 1e-9,
    );
    expect(actualRevenue / getMatchPlanRevenue(row)).toBeLessThanOrEqual(
      MAX_TICKET_PLAN_FULFILLMENT + 1e-9,
    );
  });

  it("does not lower class_2 revenue plan when under 99%", () => {
    const row = match({ matchClass: "class_2" });
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: getMatchPlanTickets(row),
      revenue: Math.round(getMatchPlanRevenue(row) * 0.82),
    });
    expect(row.ticketPlanRevenue).toBeUndefined();
  });

  it("caps class_2 revenue/plan at 90% even when occupancy fallback would leave a higher %", () => {
    const row = match({ matchClass: "class_2" });
    const originalPlan = getMatchPlanRevenue(row);
    const actualRevenue = Math.round(originalPlan * 0.97);
    const occupancyIssued = Math.round(occupancyMassCapacity(row.capacity) * 0.9);
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: occupancyIssued,
      revenue: actualRevenue,
      occupancyIssued,
    });
    expect(actualRevenue / getMatchPlanRevenue(row)).toBeLessThanOrEqual(
      MAX_REGULAR_TICKET_PLAN_FULFILLMENT + 1e-9,
    );
  });

  it("does not hide class_1 100% revenue by raising plan when occupancy is still low", () => {
    const row = match({ matchClass: "class_1" });
    const planRevenue = getMatchPlanRevenue(row);
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: Math.round(row.capacity * TICKET_PLAN_FILL_RATE),
      revenue: Math.round(planRevenue * 1),
      occupancyIssued: Math.round(row.capacity * TICKET_PLAN_FILL_RATE),
    });
    expect(Math.round(planRevenue * 1) / getMatchPlanRevenue(row)).toBeGreaterThanOrEqual(
      MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT - 1e-9,
    );
  });

  it("caps class_2 at 90% of plan when occupancy is already 96% and revenue is 100%", () => {
    const row = match({ matchClass: "class_2" });
    const planRevenue = getMatchPlanRevenue(row);
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: minHighRevenueOccupancyIssued(row.capacity),
      revenue: Math.round(planRevenue * 1),
      occupancyIssued: minHighRevenueOccupancyIssued(row.capacity),
    });
    expect(Math.round(planRevenue * 1) / getMatchPlanRevenue(row)).toBeLessThanOrEqual(
      MAX_REGULAR_TICKET_PLAN_FULFILLMENT + 1e-9,
    );
  });

  it("keeps class_2 at 90% of plan when occupancy is still under 89%", () => {
    const row = match({ matchClass: "class_2" });
    const originalPlan = getMatchPlanRevenue(row);
    const actualRevenue = Math.round(originalPlan * 0.92);
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: Math.round(row.capacity * 0.7),
      revenue: actualRevenue,
      occupancyIssued: Math.round(occupancyMassCapacity(row.capacity) * 0.7),
    });
    const ratio = actualRevenue / getMatchPlanRevenue(row);
    expect(ratio).toBeLessThanOrEqual(MAX_REGULAR_TICKET_PLAN_FULFILLMENT + 1e-9);
    expect(ratio).toBeGreaterThan(MID_REVENUE_PLAN_MIN);
  });

  it("caps class_2 at 90% when occupancy-high mid-band fallback would raise the %", () => {
    const row = match({ matchClass: "class_2" });
    const originalPlan = getMatchPlanRevenue(row);
    const actualRevenue = Math.round(originalPlan * 0.92);
    const mass = occupancyMassCapacity(row.capacity);
    applyMatchTicketPlanFulfillmentBand(row, {
      tickets: mass,
      revenue: actualRevenue,
      occupancyIssued: mass,
    });
    expect(actualRevenue / getMatchPlanRevenue(row)).toBeLessThanOrEqual(
      MAX_REGULAR_TICKET_PLAN_FULFILLMENT + 1e-9,
    );
  });

  it("uses fixed parking inventory, not 12% of sold tickets", () => {
    expect(PARKING_CAPACITY_MAIN).toBe(1440);
    expect(PARKING_CAPACITY_SECONDARY).toBe(800);
    expect(PARKING_CAPACITY_MHL).toBe(756);
    expect(SECONDARY_ARENA_CAPACITY).toBe(4000);
    expect(parkingCapacityForArenaSeats(12_000)).toBe(1440);
    expect(parkingCapacityForArenaSeats(4_000)).toBe(800);
    expect(parkingCapacityForArenaSeats(6_300)).toBe(756);
    expect(occupancyMassCapacity(12_000)).toBe(13_440);
    expect(occupancyMassCapacity(SECONDARY_ARENA_CAPACITY)).toBe(4800);
    expect(
      getMatchParkingCapacity({
        capacity: SECONDARY_ARENA_CAPACITY,
        arena: "secondary",
        league: "VHL",
      }),
    ).toBe(800);
  });

  it("computes occupancy from arena+parking issued vs fixed parking capacity", () => {
    expect(issuedOccupancyPercent(13_440, 12_000)).toBe(100);
    expect(issuedOccupancyPercent(12_000, 12_000)).toBeCloseTo(
      (12_000 / 13_440) * 100,
      10,
    );
    expect(issuedOccupancyPercent(15_000, 12_000)).toBe(100);
    expect(issuedOccupancyPercent(4_800, 4_000)).toBe(100);
    expect(issuedOccupancyPercent(12_000, 0)).toBeNull();
  });
});

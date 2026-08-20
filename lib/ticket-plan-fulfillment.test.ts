import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeMatchSalesTable, computeTicketsKpis } from "@/lib/filters";
import { getMatches } from "@/lib/mock/data-store";
import { DEFAULT_TICKET_FILTERS } from "@/lib/ticket-filter-options";
import {
  isSoldOutOccupancyMatch,
  HIGH_REVENUE_PLAN_THRESHOLD,
  MAX_REGULAR_TICKET_PLAN_FULFILLMENT,
  MAX_TICKET_PLAN_FULFILLMENT,
  MID_REVENUE_PLAN_MIN,
  MAX_MID_REVENUE_OCCUPANCY,
  MIN_HIGH_REVENUE_OCCUPANCY,
  MIN_OVER_PLAN_OCCUPANCY,
  MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT,
  OVER_PLAN_REVENUE_THRESHOLD,
  issuedOccupancyPercent,
  occupancyMassCapacity,
  PARKING_CAPACITY_MAIN,
  PARKING_CAPACITY_SECONDARY,
  SECONDARY_ARENA_CAPACITY,
} from "@/lib/ticket-plan";
import { percentOneDecimal } from "@/lib/format";

const epsilon = 1e-9;

function allMatchSalesRows() {
  return computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
    ...DEFAULT_TICKET_FILTERS,
    season: "all",
    league: "all",
  });
}

describe("ticket plan fulfillment cap (dashboard data)", () => {
  it("keeps every match issued occupancy % at most 100%", () => {
    const rows = allMatchSalesRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      if (!(row.capacity > 0)) continue;
      const pct = issuedOccupancyPercent(
        row.occupancyIssuedTickets,
        row.capacity,
      );
      expect(pct, `${row.matchId} ${row.eventLabel} occupancy`).not.toBeNull();
      expect(pct!).toBeLessThanOrEqual(100 + epsilon);
    }
  });

  it("keeps class_2 and class_3 revenue/plan at most 90%", () => {
    const rows = allMatchSalesRows();
    const matches = new Map(getMatches().map((match) => [match.id, match]));
    let regular = 0;
    for (const row of rows) {
      const match = matches.get(row.matchId);
      if (!match || isSoldOutOccupancyMatch(match)) continue;
      if (match.matchClass !== "class_2" && match.matchClass !== "class_3") {
        continue;
      }
      if (!(row.planRevenue > 0)) continue;
      regular += 1;
      expect(
        percentOneDecimal((row.revenue / row.planRevenue) * 100),
        `${row.matchId} ${row.eventLabel} ${match.matchClass}`,
      ).toBeLessThanOrEqual(90);
    }
    expect(regular).toBeGreaterThan(0);
  });

  it("keeps every match revenue/plan at most 105%", () => {
    const rows = allMatchSalesRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      if (!(row.planRevenue > 0)) continue;
      expect(
        percentOneDecimal((row.revenue / row.planRevenue) * 100),
        `${row.matchId} ${row.eventLabel}`,
      ).toBeLessThanOrEqual(105);
    }
  });

  it("keeps class_1 and playoff revenue/plan at least 99%", () => {
    const rows = allMatchSalesRows();
    const matches = new Map(getMatches().map((match) => [match.id, match]));
    let soldOut = 0;
    for (const row of rows) {
      const match = matches.get(row.matchId);
      if (!match || !isSoldOutOccupancyMatch(match) || !match.eventCompleted) continue;
      if (!(row.planRevenue > 0)) continue;
      soldOut += 1;
      const revUi = percentOneDecimal((row.revenue / row.planRevenue) * 100);
      expect(
        revUi,
        `${row.matchId} ${row.eventLabel} ${match.matchClass}`,
      ).toBeGreaterThanOrEqual(99);
      expect(revUi).toBeLessThanOrEqual(105);
    }
    expect(soldOut).toBeGreaterThan(0);
  });

  it("keeps occupancy at least 96% when revenue/plan is over 95% and under 100%", () => {
    const rows = allMatchSalesRows();
    expect(rows.length).toBeGreaterThan(0);
    let highRevenue = 0;
    for (const row of rows) {
      if (!(row.planRevenue > 0) || !(row.capacity > 0)) continue;
      const revUi = percentOneDecimal((row.revenue / row.planRevenue) * 100);
      if (revUi <= 95 || revUi >= 100) continue;
      highRevenue += 1;
      const pct = issuedOccupancyPercent(
        row.occupancyIssuedTickets,
        row.capacity,
      );
      expect(
        pct,
        `${row.matchId} ${row.eventLabel} occupancy with high revenue/plan`,
      ).not.toBeNull();
      expect(percentOneDecimal(pct!)).toBeGreaterThanOrEqual(96);
      expect(percentOneDecimal(pct!)).toBeLessThanOrEqual(100);
    }
    expect(highRevenue).toBeGreaterThan(0);
  });

  it("keeps issued occupancy in [89%, 96%] when revenue/plan is in [89%, 95%]", () => {
    const rows = allMatchSalesRows();
    expect(rows.length).toBeGreaterThan(0);
    let midRevenue = 0;
    for (const row of rows) {
      if (!(row.planRevenue > 0) || !(row.capacity > 0)) continue;
      const revUi = percentOneDecimal((row.revenue / row.planRevenue) * 100);
      if (revUi < 89 || revUi > 95) {
        continue;
      }
      midRevenue += 1;
      const pct = issuedOccupancyPercent(
        row.occupancyIssuedTickets,
        row.capacity,
      );
      expect(
        pct,
        `${row.matchId} ${row.eventLabel} occupancy with 89–95% revenue/plan`,
      ).not.toBeNull();
      expect(percentOneDecimal(pct!)).toBeGreaterThanOrEqual(89);
      expect(percentOneDecimal(pct!)).toBeLessThanOrEqual(96);
    }
    expect(midRevenue).toBeGreaterThan(0);
  });

  it("keeps issued occupancy at 100% when revenue/plan is at least 100%", () => {
    const rows = allMatchSalesRows();
    expect(rows.length).toBeGreaterThan(0);
    let overPlan = 0;
    for (const row of rows) {
      if (!(row.planRevenue > 0) || !(row.capacity > 0)) continue;
      if (percentOneDecimal((row.revenue / row.planRevenue) * 100) < 100) continue;
      overPlan += 1;
      const pct = issuedOccupancyPercent(
        row.occupancyIssuedTickets,
        row.capacity,
      );
      expect(
        pct,
        `${row.matchId} ${row.eventLabel} occupancy with revenue/plan ≥ 100%`,
      ).not.toBeNull();
      expect(percentOneDecimal(pct!)).toBe(100);
    }
    expect(overPlan).toBeGreaterThan(0);
  });

  it("sold-out main-arena occupancy is 100% of arena+parking, never 112%", () => {
    const rows = allMatchSalesRows();
    const matches = new Map(getMatches().map((match) => [match.id, match]));
    let soldOutMain = 0;
    for (const row of rows) {
      const match = matches.get(row.matchId);
      if (!match || !isSoldOutOccupancyMatch(match) || !match.eventCompleted) {
        continue;
      }
      if (match.capacity !== 12_000) continue;
      soldOutMain += 1;
      const mass = occupancyMassCapacity(row.capacity);
      expect(mass).toBe(12_000 + PARKING_CAPACITY_MAIN);
      const pct = issuedOccupancyPercent(
        row.occupancyIssuedTickets,
        row.capacity,
      );
      expect(pct, `${row.matchId} ${row.eventLabel}`).toBeCloseTo(100, 5);
      expect(pct!).toBeLessThanOrEqual(100 + epsilon);
      expect(pct!).not.toBeCloseTo(112, 0);
    }
    expect(soldOutMain).toBeGreaterThan(0);
  });

  it("locks secondary arena 4000 + parking 800 for VHL occupancy", () => {
    const rows = allMatchSalesRows();
    const matches = new Map(getMatches().map((match) => [match.id, match]));
    let vhl = 0;
    let soldOutSecondary = 0;
    for (const row of rows) {
      const match = matches.get(row.matchId);
      if (!match || match.league !== "VHL") continue;
      vhl += 1;
      expect(match.arena).toBe("secondary");
      expect(match.capacity).toBe(SECONDARY_ARENA_CAPACITY);
      expect(match.capacity).toBe(4000);
      expect(row.capacity).toBe(4000);
      const mass = occupancyMassCapacity(row.capacity);
      expect(mass).toBe(4000 + PARKING_CAPACITY_SECONDARY);
      expect(mass).toBe(4800);
      const pct = issuedOccupancyPercent(
        row.occupancyIssuedTickets,
        row.capacity,
      );
      expect(pct, `${row.matchId} ${row.eventLabel} occupancy`).not.toBeNull();
      expect(pct!).toBeLessThanOrEqual(100 + epsilon);
      if (
        isSoldOutOccupancyMatch(match) &&
        match.eventCompleted &&
        row.occupancyIssuedTickets > 0
      ) {
        soldOutSecondary += 1;
        expect(pct, `${row.matchId} sold-out secondary occupancy`).toBeCloseTo(
          100,
          5,
        );
      }
    }
    expect(vhl).toBeGreaterThan(0);
    expect(soldOutSecondary).toBeGreaterThan(0);
  });

  it("keeps tickets-tab KPI sold tickets and revenue at most +5% vs plan", () => {
    const kpis = computeTicketsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    expect(kpis.planTicketsSold).toBeGreaterThan(0);
    expect(kpis.planFactTicketsSold / kpis.planTicketsSold).toBeLessThanOrEqual(
      MAX_TICKET_PLAN_FULFILLMENT + epsilon,
    );
    expect(percentOneDecimal(kpis.planCompletionPct)).toBeLessThanOrEqual(105);
  });
});

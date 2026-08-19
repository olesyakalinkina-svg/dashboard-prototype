import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeMatchSalesTable, computeMerchMatchSalesTable } from "@/lib/filters";
import { percentOneDecimal } from "@/lib/format";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import {
  MERCH_PLAN_FULFILLMENT_BY_MATCH_ID,
  MAX_MERCH_PLAN_FULFILLMENT,
  MAX_MERCH_PLAN_WHEN_TICKETS_MET,
  MIN_MERCH_PLAN_WHEN_TICKETS_MET,
} from "@/lib/merch-plan";
import { DEFAULT_TICKET_FILTERS } from "@/lib/ticket-filter-options";
import { OVER_PLAN_REVENUE_THRESHOLD } from "@/lib/ticket-plan";

const epsilon = 1e-9;

function merchRowsAllSeasons() {
  return computeMerchMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
    ...DEFAULT_MERCH_FILTERS,
    season: "all",
    league: "all",
  });
}

function merchRowsCurrentKhl() {
  return computeMerchMatchSalesTable(
    DEFAULT_DASHBOARD_FILTERS,
    DEFAULT_MERCH_FILTERS,
  );
}

function ticketRowsAllSeasons() {
  return computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
    ...DEFAULT_TICKET_FILTERS,
    season: "all",
    league: "all",
  });
}

describe("merch plan fulfillment (dashboard data)", () => {
  it("keeps every match merch revenue/plan at most 103%", () => {
    const rows = merchRowsAllSeasons();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      if (!(row.planRevenue > 0)) continue;
      expect(
        row.revenue / row.planRevenue,
        `${row.matchId} ${row.eventLabel}`,
      ).toBeLessThanOrEqual(MAX_MERCH_PLAN_FULFILLMENT + epsilon);
    }
  });

  it("keeps Итого merch revenue/plan at most 103%", () => {
    const rows = merchRowsAllSeasons();
    const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const plan = rows.reduce((sum, row) => sum + row.planRevenue, 0);
    expect(plan).toBeGreaterThan(0);
    expect(revenue / plan).toBeLessThanOrEqual(MAX_MERCH_PLAN_FULFILLMENT + epsilon);
  });

  it("keeps merch at 75–100% of plan when the ticket revenue plan is met", () => {
    const merchRows = merchRowsAllSeasons();
    const ticketByMatch = new Map(
      ticketRowsAllSeasons().map((row) => [row.matchId, row]),
    );
    let ticketsMet = 0;
    for (const row of merchRows) {
      if (!(row.planRevenue > 0)) continue;
      if (row.matchId in MERCH_PLAN_FULFILLMENT_BY_MATCH_ID) continue;
      const ticket = ticketByMatch.get(row.matchId);
      if (!ticket || !(ticket.planRevenue > 0)) continue;
      if (ticket.revenue / ticket.planRevenue < OVER_PLAN_REVENUE_THRESHOLD) {
        continue;
      }
      ticketsMet += 1;
      const ratio = row.revenue / row.planRevenue;
      expect(
        ratio,
        `${row.matchId} ${row.eventLabel} merch with tickets on plan`,
      ).toBeGreaterThanOrEqual(MIN_MERCH_PLAN_WHEN_TICKETS_MET - epsilon);
      expect(ratio).toBeLessThanOrEqual(
        MAX_MERCH_PLAN_WHEN_TICKETS_MET + epsilon,
      );
    }
    expect(ticketsMet).toBeGreaterThan(0);
  });

  it("sets explicit KHL 2025/26 merch Продажи % within 0.5pp of the target list", () => {
    const byId = new Map(
      merchRowsCurrentKhl().map((row) => [row.matchId, row]),
    );
    const targets = Object.entries(MERCH_PLAN_FULFILLMENT_BY_MATCH_ID);
    expect(targets).toHaveLength(13);
    for (const [matchId, target] of targets) {
      const row = byId.get(matchId);
      expect(row, matchId).toBeDefined();
      const pct = (row!.revenue / row!.planRevenue) * 100;
      const shown = percentOneDecimal(pct);
      const targetPct = Math.round(target * 100);
      expect(
        Math.abs(shown - targetPct),
        `${matchId} ${row!.eventLabel} shown ${shown}% target ${targetPct}%`,
      ).toBeLessThanOrEqual(0.5);
    }
  });
});

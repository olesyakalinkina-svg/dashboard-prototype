import { describe, expect, it } from "vitest";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import {
  getMatchMerchPlanCrowd,
  getMatchMerchPlanRevenue,
  merchPlanScale,
  applyExplicitMatchMerchPlan,
  applyMatchMerchPlanFulfillmentBand,
  applyMatchMerchPlanFloorWhenTicketsMet,
  merchPlanRevenueForTarget,
  MAX_MERCH_PLAN_FULFILLMENT,
  MAX_MERCH_PLAN_WHEN_TICKETS_MET,
  MIN_MERCH_PLAN_WHEN_TICKETS_MET,
} from "@/lib/merch-plan";
import type { Match } from "@/types/dashboard";

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

describe("merch match sales plan", () => {
  it("is 0 when attendance and capacity are missing, not a fake 0% base", () => {
    expect(getMatchMerchPlanCrowd(match({ attendance: 0, capacity: 0 }))).toBe(0);
    expect(getMatchMerchPlanRevenue(match({ attendance: 0, capacity: 0 }))).toBe(
      0,
    );
  });

  it("falls back to 60% of capacity when attendance is 0", () => {
    expect(getMatchMerchPlanCrowd(match({ attendance: 0, capacity: 10_000 }))).toBe(
      6000,
    );
  });

  it("varies by league and class so fulfillment can differ across matches", () => {
    const khl = getMatchMerchPlanRevenue(match());
    const vhl = getMatchMerchPlanRevenue(
      match({ league: "VHL", attendance: 3300, capacity: 4000 }),
    );
    const playoff = getMatchMerchPlanRevenue(match({ matchClass: "playoff" }));
    expect(khl).toBeGreaterThan(0);
    expect(vhl).toBeGreaterThan(0);
    expect(khl).not.toBe(vhl);
    expect(playoff).toBeGreaterThan(khl);
  });

  it("does not scale the default merch filter set", () => {
    expect(merchPlanScale(DEFAULT_MERCH_FILTERS)).toBe(1);
  });

  it("scales down when fewer match-table channels or categories are selected", () => {
    expect(
      merchPlanScale({
        ...DEFAULT_MERCH_FILTERS,
        salesChannels: ["flagship"],
      }),
    ).toBeCloseTo(1 / 3, 8);
    expect(
      merchPlanScale({
        ...DEFAULT_MERCH_FILTERS,
        productCategories: ["jerseys"],
      }),
    ).toBeCloseTo(1 / 5, 8);
  });

  it("uses a stored merchPlanRevenue override when present", () => {
    const base = getMatchMerchPlanRevenue(match());
    expect(
      getMatchMerchPlanRevenue(match({ merchPlanRevenue: base * 2 })),
    ).toBe(base * 2);
  });

  it("raises stored plan so over-cap merch lands on 103%", () => {
    const row = match();
    const formula = getMatchMerchPlanRevenue(row);
    applyMatchMerchPlanFulfillmentBand(row, formula * 1.457, false);
    const plan = getMatchMerchPlanRevenue(row);
    expect(plan).toBe(Math.ceil((formula * 1.457) / MAX_MERCH_PLAN_FULFILLMENT));
    expect((formula * 1.457) / plan).toBeLessThanOrEqual(
      MAX_MERCH_PLAN_FULFILLMENT + 1e-9,
    );
  });

  it("caps at 100% when the ticket revenue plan is already met", () => {
    const row = match();
    const formula = getMatchMerchPlanRevenue(row);
    applyMatchMerchPlanFulfillmentBand(row, formula * 1.457, true);
    const plan = getMatchMerchPlanRevenue(row);
    expect((formula * 1.457) / plan).toBeLessThanOrEqual(
      MAX_MERCH_PLAN_WHEN_TICKETS_MET + 1e-9,
    );
  });

  it("lowers stored plan to 75% when tickets are met and merch is short", () => {
    const row = match();
    const formula = getMatchMerchPlanRevenue(row);
    applyMatchMerchPlanFloorWhenTicketsMet(row, formula * 0.5);
    const plan = getMatchMerchPlanRevenue(row);
    expect((formula * 0.5) / plan).toBeGreaterThanOrEqual(
      MIN_MERCH_PLAN_WHEN_TICKETS_MET - 1e-9,
    );
  });

  it("sets stored plan so actual/plan matches an explicit target", () => {
    const row = match({ id: "match-5" });
    const actual = 229_940;
    expect(applyExplicitMatchMerchPlan(row, actual)).toBe(true);
    expect(row.merchPlanRevenue).toBe(merchPlanRevenueForTarget(actual, 0.75));
    expect(actual / row.merchPlanRevenue!).toBeCloseTo(0.75, 5);
    applyMatchMerchPlanFloorWhenTicketsMet(row, actual);
    applyMatchMerchPlanFulfillmentBand(row, actual, true);
    expect(row.merchPlanRevenue).toBe(merchPlanRevenueForTarget(actual, 0.75));
  });
});

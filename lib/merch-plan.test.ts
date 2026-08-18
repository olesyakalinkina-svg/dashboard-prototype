import { describe, expect, it } from "vitest";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import {
  getMatchMerchPlanCrowd,
  getMatchMerchPlanRevenue,
  merchPlanScale,
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
      match({ league: "VHL", attendance: 2500, capacity: 3000 }),
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
});

import { describe, expect, it } from "vitest";
import {
  computeCombinedMatchSalesTable,
  computeMerchMatchSalesTable,
} from "@/lib/filters";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import {
  MATCH_COMPARISON_EMPTY,
  MATCH_COMPARISON_METRICS,
  computeMatchComparison,
  formatMatchComparisonDelta,
  formatMatchComparisonValue,
  listMatchComparisonMatches,
  listMatchComparisonOptions,
  matchComparisonDelta,
  pickDefaultMatchComparisonIds,
  subscriptionFiltersToMatchSalesFilters,
} from "@/lib/match-comparison";
import {
  matchSalesFiltersToMerchFilters,
} from "@/lib/match-sales-filter-options";
import { getMatches } from "@/lib/mock/hockey";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import { issuedOccupancyPercent } from "@/lib/ticket-plan";

describe("match comparison compute", () => {
  it("defaults to two different recent KHL 2025/26 home games", () => {
    const matches = listMatchComparisonMatches(DEFAULT_SUBSCRIPTION_FILTERS);
    const [idA, idB] = pickDefaultMatchComparisonIds(matches);
    const byId = new Map(getMatches().map((match) => [match.id, match]));

    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);

    const matchA = byId.get(idA!);
    const matchB = byId.get(idB!);
    expect(matchA?.season).toBe("2025/26");
    expect(matchB?.season).toBe("2025/26");
    expect(matchA?.league).toBe("KHL");
    expect(matchB?.league).toBe("KHL");
    expect(matchA?.eventCompleted).toBe(true);
    expect(matchB?.eventCompleted).toBe(true);

    const completedKhl = getMatches()
      .filter(
        (match) =>
          match.season === "2025/26" &&
          match.league === "KHL" &&
          match.eventCompleted,
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    expect(idA).toBe(completedKhl[0]?.id);
    expect(idB).toBe(completedKhl[1]?.id);
  });

  it("lists selector matches for the subscription season/league/arena", () => {
    const options = listMatchComparisonOptions(DEFAULT_SUBSCRIPTION_FILTERS);
    expect(options.length).toBeGreaterThan(1);
    expect(new Set(options.map((option) => option.value)).size).toBe(
      options.length,
    );

    const listed = listMatchComparisonMatches(DEFAULT_SUBSCRIPTION_FILTERS);
    expect(listed.every((match) => match.season === "2025/26")).toBe(true);
    expect(listed.every((match) => match.league === "KHL")).toBe(true);

    const vhl = listMatchComparisonMatches({
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      league: "VHL",
      arena: "secondary",
    });
    expect(vhl.length).toBeGreaterThan(0);
    expect(vhl.every((match) => match.league === "VHL")).toBe(true);
    expect(vhl.every((match) => match.arena === "secondary")).toBe(true);
  });

  it("produces A/B values from combined match sales and merch conversion", () => {
    const matches = listMatchComparisonMatches(DEFAULT_SUBSCRIPTION_FILTERS);
    const [idA, idB] = pickDefaultMatchComparisonIds(matches);
    expect(idA && idB).toBeTruthy();

    const comparison = computeMatchComparison(
      DEFAULT_SUBSCRIPTION_FILTERS,
      idA!,
      idB!,
    );
    const matchSalesFilters = subscriptionFiltersToMatchSalesFilters(
      DEFAULT_SUBSCRIPTION_FILTERS,
      [idA!, idB!],
    );
    const combined = computeCombinedMatchSalesTable(
      DEFAULT_DASHBOARD_FILTERS,
      matchSalesFilters,
    );
    const merchRows = computeMerchMatchSalesTable(
      DEFAULT_DASHBOARD_FILTERS,
      matchSalesFiltersToMerchFilters(matchSalesFilters),
    );

    const rowA = combined.find((row) => row.matchId === idA);
    const rowB = combined.find((row) => row.matchId === idB);
    const merchA = merchRows.find((row) => row.matchId === idA);
    const merchB = merchRows.find((row) => row.matchId === idB);
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();

    expect(comparison.a.revenue).toBe(rowA!.totalRevenue);
    expect(comparison.b.revenue).toBe(rowB!.totalRevenue);
    expect(comparison.a.merch).toBe(rowA!.merchRevenue);
    expect(comparison.b.merch).toBe(rowB!.merchRevenue);
    expect(comparison.a.occupancy).toBe(rowA!.fillRate);
    expect(comparison.a.occupancy).toBe(
      issuedOccupancyPercent(rowA!.issuedTickets, rowA!.capacity) ?? 0,
    );
    expect(comparison.a.avgCheck).toBeCloseTo(
      rowA!.ticketRevenue / rowA!.ticketsSold,
    );
    expect(comparison.b.avgCheck).toBeCloseTo(
      rowB!.ticketRevenue / rowB!.ticketsSold,
    );
    expect(comparison.a.conversion).toBe(merchA?.purchaseConversionPct ?? null);
    expect(comparison.b.conversion).toBe(merchB?.purchaseConversionPct ?? null);

    expect(comparison.a.revenue).not.toBe(comparison.b.revenue);
    expect(matchComparisonDelta("revenue", comparison.a, comparison.b)).toBe(
      rowB!.totalRevenue - rowA!.totalRevenue,
    );
  });

  it("includes upcoming home games in selectors and shows — without sales", () => {
    const listed = listMatchComparisonMatches(DEFAULT_SUBSCRIPTION_FILTERS);
    expect(listed.some((match) => !match.eventCompleted)).toBe(true);

    const completed = listed.find((match) => match.eventCompleted);
    expect(completed).toBeDefined();

    const comparison = computeMatchComparison(
      DEFAULT_SUBSCRIPTION_FILTERS,
      "match-not-in-sales-table",
      completed!.id,
    );

    expect(comparison.a.revenue).toBeNull();
    expect(comparison.a.occupancy).toBeNull();
    expect(comparison.a.avgCheck).toBeNull();
    expect(comparison.a.conversion).toBeNull();
    expect(comparison.a.merch).toBeNull();
    expect(formatMatchComparisonValue("revenue", comparison.a.revenue)).toBe(
      MATCH_COMPARISON_EMPTY,
    );
    expect(
      formatMatchComparisonDelta(
        "revenue",
        matchComparisonDelta("revenue", comparison.a, comparison.b),
      ),
    ).toBe(MATCH_COMPARISON_EMPTY);

    expect(comparison.b.revenue).not.toBeNull();
  });

  it("keeps the five comparison metrics in toggle order", () => {
    expect([...MATCH_COMPARISON_METRICS]).toEqual([
      "revenue",
      "occupancy",
      "avgCheck",
      "conversion",
      "merch",
    ]);
  });
});

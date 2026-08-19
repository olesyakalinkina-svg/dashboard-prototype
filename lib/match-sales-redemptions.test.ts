import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import {
  computeCombinedMatchSalesTable,
  computeMatchRevenueChart,
  computeMatchSalesKpis,
  computeMatchSalesTable,
} from "@/lib/filters";
import {
  DEFAULT_MATCH_SALES_FILTERS,
  matchSalesFiltersToTicketFilters,
} from "@/lib/match-sales-filter-options";
import {
  getMatchById,
  getSubscriptionRedemptions,
  getSubscriptions,
} from "@/lib/mock/hockey";
import { issuedOccupancyPercent } from "@/lib/ticket-plan";

describe("match sales subscription redemptions", () => {
  const filters = DEFAULT_DASHBOARD_FILTERS;
  const matchSalesFilters = DEFAULT_MATCH_SALES_FILTERS;
  const ticketFilters = matchSalesFiltersToTicketFilters(matchSalesFilters);

  it("stores redemptions without cancelled subscriptions or over-use", () => {
    const redemptions = getSubscriptionRedemptions();
    expect(redemptions.length).toBeGreaterThan(0);

    const cancelledIds = new Set(
      getSubscriptions()
        .filter((sub) => sub.status === "cancelled")
        .map((sub) => sub.id),
    );
    expect(cancelledIds.size).toBeGreaterThan(0);
    expect(
      redemptions.some((redemption) =>
        cancelledIds.has(redemption.subscriptionId),
      ),
    ).toBe(false);

    const usedBySub = new Map<string, number>();
    const seenPairs = new Set<string>();
    for (const redemption of redemptions) {
      const pair = `${redemption.subscriptionId}:${redemption.matchId}`;
      expect(seenPairs.has(pair)).toBe(false);
      seenPairs.add(pair);
      usedBySub.set(
        redemption.subscriptionId,
        (usedBySub.get(redemption.subscriptionId) ?? 0) + 1,
      );
    }

    const subsById = new Map(getSubscriptions().map((sub) => [sub.id, sub]));
    for (const [subscriptionId, used] of usedBySub) {
      const sub = subsById.get(subscriptionId);
      expect(sub).toBeDefined();
      expect(used).toBeLessThanOrEqual(
        Math.min(sub!.matchesUsed, sub!.matchesTotal),
      );
    }
  });

  it("adds abonement uses to issued/sold counts and occupancy, not ticket revenue", () => {
    const ticketRows = computeMatchSalesTable(filters, ticketFilters);
    const combined = computeCombinedMatchSalesTable(filters, matchSalesFilters);
    const kpis = computeMatchSalesKpis(filters, matchSalesFilters);

    const ticketIssued = ticketRows.reduce(
      (sum, row) => sum + row.issuedTickets,
      0,
    );
    const combinedIssued = combined.reduce(
      (sum, row) => sum + row.issuedTickets,
      0,
    );
    const ticketSold = ticketRows.reduce((sum, row) => sum + row.ticketsSold, 0);
    const combinedSold = combined.reduce((sum, row) => sum + row.ticketsSold, 0);
    const ticketRevenue = ticketRows.reduce((sum, row) => sum + row.revenue, 0);

    expect(combinedIssued).toBeGreaterThan(ticketIssued);
    expect(combinedSold).toBeGreaterThan(ticketSold);
    expect(kpis.ticketsSold).toBe(combinedSold);
    expect(kpis.ticketRevenue).toBe(ticketRevenue);

    const ticketByMatch = new Map(ticketRows.map((row) => [row.matchId, row]));
    for (const row of combined) {
      const ticket = ticketByMatch.get(row.matchId);
      expect(row.ticketRevenue).toBe(ticket?.revenue ?? 0);
      expect(row.issuedTickets).toBeGreaterThanOrEqual(
        ticket?.issuedTickets ?? 0,
      );
      expect(row.ticketsSold).toBeGreaterThanOrEqual(ticket?.ticketsSold ?? 0);
      expect(row.fillRate).toBe(
        issuedOccupancyPercent(row.issuedTickets, row.capacity) ?? 0,
      );
    }

    const chart = computeMatchRevenueChart(filters, matchSalesFilters);
    expect(chart.reduce((sum, point) => sum + point.tickets, 0)).toBe(
      kpis.ticketRevenue,
    );
  });

  it("still counts issued tickets when a match has only abonement uses", () => {
    const noPurchaseWindow = {
      ...matchSalesFilters,
      purchaseDateRange: { from: "2099-01-01", to: "2099-01-02" },
    };
    const ticketRows = computeMatchSalesTable(
      filters,
      matchSalesFiltersToTicketFilters(noPurchaseWindow),
    );
    const combined = computeCombinedMatchSalesTable(filters, noPurchaseWindow);
    const kpis = computeMatchSalesKpis(filters, noPurchaseWindow);

    expect(ticketRows).toHaveLength(0);
    expect(kpis.ticketRevenue).toBe(0);
    expect(combined.some((row) => row.issuedTickets > 0)).toBe(true);
    expect(kpis.ticketsSold).toBeGreaterThan(0);
    expect(kpis.fillRate).toBeGreaterThan(0);
    expect(combined.every((row) => row.ticketRevenue === 0)).toBe(true);
  });

  it("applies match filters to redemptions and ignores purchase date for uses", () => {
    const combined = computeCombinedMatchSalesTable(filters, matchSalesFilters);
    const sample = combined.find((row) => row.issuedTickets > 0);
    expect(sample).toBeDefined();

    const byMatch = computeCombinedMatchSalesTable(filters, {
      ...matchSalesFilters,
      matchId: [sample!.matchId],
    });
    expect(byMatch).toHaveLength(1);
    expect(byMatch[0]?.matchId).toBe(sample!.matchId);
    expect(byMatch[0]?.issuedTickets).toBe(sample!.issuedTickets);
    expect(byMatch[0]?.ticketRevenue).toBe(sample!.ticketRevenue);

    const khl = computeCombinedMatchSalesTable(filters, {
      ...matchSalesFilters,
      league: "KHL",
    });
    expect(khl.length).toBeGreaterThan(0);
    expect(
      khl.every((row) => getMatchById().get(row.matchId)?.league === "KHL"),
    ).toBe(true);

    const vhl = computeCombinedMatchSalesTable(filters, {
      ...matchSalesFilters,
      league: "VHL",
    });
    const khlIds = new Set(khl.map((row) => row.matchId));
    expect(vhl.every((row) => !khlIds.has(row.matchId))).toBe(true);
  });
});

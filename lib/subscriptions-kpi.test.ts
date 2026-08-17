import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeSubscriptionsKpis } from "@/lib/filters";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";

describe("subscriptions KPIs", () => {
  it("computes revenue, sold count, unique customers, and average check", () => {
    const kpis = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );

    expect(kpis.sold).toBe(65);
    expect(kpis.revenue).toBeGreaterThan(0);
    expect(kpis.uniqueCustomers).toBeGreaterThan(0);
    expect(kpis.uniqueCustomers).toBeLessThanOrEqual(kpis.sold);
    expect(kpis.avgCheck).toBeCloseTo(kpis.revenue / kpis.sold);

    const previousAvgCheck = 3_451_000 / 60;
    expect(kpis.avgCheck / previousAvgCheck).toBeGreaterThan(0.62 * 0.97);
    expect(kpis.avgCheck / previousAvgCheck).toBeLessThan(0.75 * 1.03);

    expect(kpis.seasonComparison).toBeDefined();
    expect(kpis.seasonComparison?.previousSeason).toBe("2024/25");
    expect(kpis.seasonComparison).toEqual(
      expect.objectContaining({
        revenueChange: expect.any(Number),
        soldChange: expect.any(Number),
        uniqueCustomersChange: expect.any(Number),
        avgCheckChange: expect.any(Number),
      }),
    );
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import {
  computeSubscriptionPriceCategoryShares,
  computeSubscriptionsKpis,
} from "@/lib/filters";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";

describe("subscriptions KPIs", () => {
  it("computes revenue, sold count, unique customers, and average check", () => {
    const kpis = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );

    expect(kpis.sold).toBeGreaterThan(0);
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

    expect(Math.abs(kpis.seasonComparison?.soldChange ?? 999)).toBeLessThan(80);
    expect(Math.abs(kpis.seasonComparison?.revenueChange ?? 999)).toBeLessThan(80);
    expect(
      Math.abs(kpis.seasonComparison?.uniqueCustomersChange ?? 999),
    ).toBeLessThan(80);
  });

  it("computes sold shares for all three price categories", () => {
    const shares = computeSubscriptionPriceCategoryShares(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );
    const kpis = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );

    expect(shares.map((row) => row.category)).toEqual([
      "Все включено",
      "Выходного дня",
      "Сезонный",
    ]);
    expect(shares.reduce((sum, row) => sum + row.sold, 0)).toBe(kpis.sold);
    expect(shares.some((row) => row.sold > 0)).toBe(true);

    const shareSum = shares.reduce((sum, row) => sum + row.share, 0);
    expect(shareSum).toBeCloseTo(kpis.sold > 0 ? 100 : 0);

    for (const row of shares) {
      expect(row.share).toBeCloseTo(
        kpis.sold > 0 ? (row.sold / kpis.sold) * 100 : 0,
      );
    }
  });

  it("keeps all price categories when a filter leaves some empty", () => {
    const shares = computeSubscriptionPriceCategoryShares(
      DEFAULT_DASHBOARD_FILTERS,
      { ...DEFAULT_SUBSCRIPTION_FILTERS, sector: "VIP" },
    );

    expect(shares).toHaveLength(3);
    expect(shares.every((row) => row.sold >= 0)).toBe(true);
    expect(shares.reduce((sum, row) => sum + row.sold, 0)).toBeGreaterThanOrEqual(
      0,
    );
  });
});

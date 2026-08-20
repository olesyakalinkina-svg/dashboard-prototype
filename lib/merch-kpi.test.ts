import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeMerchKpis } from "@/lib/filters";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";

const YOY_ABS_MAX = 10.5;

describe("merch KPIs", () => {
  it("keeps default KHL YoY within ±10% vs 2024/25", () => {
    const kpis = computeMerchKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
    );

    expect(kpis.revenue).toBeGreaterThan(0);
    expect(kpis.receipts).toBeGreaterThan(0);
    expect(kpis.avgCheck).toBeCloseTo(kpis.revenue / kpis.receipts);
    expect(kpis.seasonComparison).toBeDefined();
    expect(kpis.seasonComparison?.previousSeason).toBe("2024/25");

    const sc = kpis.seasonComparison!;
    expect(Math.abs(sc.revenueChange)).toBeLessThanOrEqual(YOY_ABS_MAX);
    expect(Math.abs(sc.avgCheckChange)).toBeLessThanOrEqual(YOY_ABS_MAX);
    expect(Math.abs(sc.receiptsChange)).toBeLessThanOrEqual(YOY_ABS_MAX);
    expect(Math.abs(sc.returnsPctChange)).toBeLessThanOrEqual(YOY_ABS_MAX);
  });

  it("shows a calm default returns % (~0.8–1.5)", () => {
    const kpis = computeMerchKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
    );

    expect(kpis.returnsPct).toBeGreaterThanOrEqual(0.8);
    expect(kpis.returnsPct).toBeLessThanOrEqual(1.5);
  });
});

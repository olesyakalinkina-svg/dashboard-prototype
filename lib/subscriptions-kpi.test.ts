import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import {
  computeSubscriptionPriceCategoryShares,
  computeSubscriptionsKpis,
  computeSubscriptionTariffStats,
  getTabSubscriptions,
} from "@/lib/filters";
import {
  applySubscriptionFilterPatch,
  DEFAULT_SUBSCRIPTION_FILTERS,
  getSubscriptionPriceCategory,
} from "@/lib/subscription-filter-options";
import { SUBSCRIPTION_LIST_PRICES } from "@/lib/mock/subscription-catalog";
import type { League, SubscriptionFilters } from "@/types/dashboard";

const expectedKhlPrices = new Set(
  Object.values(SUBSCRIPTION_LIST_PRICES.KHL).flatMap((prices) => prices ?? []),
);

describe("subscriptions KPIs", () => {
  it("locks default 2025/26 KHL sold counts at 4500 = 3500 regular + 1000 playoff", () => {
    const kpis = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );
    const regular = computeSubscriptionsKpis(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      tournamentStage: "regular",
    });
    const playoff = computeSubscriptionsKpis(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      tournamentStage: "playoff",
    });
    const stats = computeSubscriptionTariffStats(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );

    expect(kpis.sold).toBe(4500);
    expect(regular.sold).toBe(3500);
    expect(playoff.sold).toBe(1000);
    expect(regular.sold + playoff.sold).toBe(kpis.sold);

    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plan: "Регулярный чемпионат",
          sold: 3500,
        }),
        expect.objectContaining({
          plan: "Плей-офф",
          sold: 1000,
        }),
      ]),
    );
  });

  it("computes revenue, sold count, unique customers, and average check", () => {
    const kpis = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );

    expect(kpis.sold).toBe(4500);
    expect(kpis.revenue).toBeGreaterThan(0);
    expect(kpis.uniqueCustomers).toBeGreaterThan(0);
    expect(kpis.uniqueCustomers).toBeLessThanOrEqual(kpis.sold);
    expect(kpis.avgCheck).toBeCloseTo(kpis.revenue / kpis.sold);

    expect(kpis.avgCheck).toBeGreaterThan(19_000);
    expect(kpis.avgCheck).toBeLessThan(75_000);

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

    const sc = kpis.seasonComparison!;
    const yoyMin = 0.5;
    const yoyMax = 10;
    expect(sc.revenueChange).toBeGreaterThanOrEqual(yoyMin);
    expect(sc.revenueChange).toBeLessThanOrEqual(yoyMax);
    expect(sc.soldChange).toBeGreaterThanOrEqual(yoyMin);
    expect(sc.soldChange).toBeLessThanOrEqual(yoyMax);
    expect(sc.uniqueCustomersChange).toBeGreaterThanOrEqual(yoyMin);
    expect(sc.uniqueCustomersChange).toBeLessThanOrEqual(yoyMax);
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
      { ...DEFAULT_SUBSCRIPTION_FILTERS, priceCategory: "weekend" },
    );

    expect(shares).toHaveLength(3);
    expect(shares.every((row) => row.sold >= 0)).toBe(true);
    expect(shares.reduce((sum, row) => sum + row.sold, 0)).toBeGreaterThanOrEqual(
      0,
    );
  });

  it("filters sold counts by product type without changing the unfiltered total", () => {
    const all = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );
    const weekend = computeSubscriptionsKpis(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      priceCategory: "weekend",
    });
    const seasonal = computeSubscriptionsKpis(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      priceCategory: "seasonal",
    });
    const allInclusive = computeSubscriptionsKpis(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      priceCategory: "all_inclusive",
    });

    expect(all.sold).toBe(4500);
    expect(weekend.sold + seasonal.sold + allInclusive.sold).toBe(all.sold);
    expect(weekend.sold).toBeGreaterThan(0);
    expect(seasonal.sold).toBeGreaterThan(0);
    expect(allInclusive.sold).toBeGreaterThan(0);
  });

  function leagueFilters(league: League): SubscriptionFilters {
    return applySubscriptionFilterPatch(DEFAULT_SUBSCRIPTION_FILTERS, {
      league,
    });
  }

  function expectYoyInBand(
    kpis: ReturnType<typeof computeSubscriptionsKpis>,
  ) {
    const sc = kpis.seasonComparison;
    expect(sc).toBeDefined();
    expect(sc!.soldChange).toBeGreaterThanOrEqual(0.5);
    expect(sc!.soldChange).toBeLessThanOrEqual(10);
    expect(sc!.revenueChange).toBeGreaterThanOrEqual(0.5);
    expect(sc!.revenueChange).toBeLessThanOrEqual(10);
    expect(sc!.uniqueCustomersChange).toBeGreaterThanOrEqual(0.5);
    expect(sc!.uniqueCustomersChange).toBeLessThanOrEqual(10);
  }

  it("locks VHL at 1500 and MHL at 1000 with only two tariffs", () => {
    const vhlFilters = leagueFilters("VHL");
    const mhlFilters = leagueFilters("MHL");
    expect(vhlFilters.arena).toBe("secondary");
    expect(mhlFilters.arena).toBe("main");

    const vhl = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      vhlFilters,
    );
    const mhl = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      mhlFilters,
    );
    const khl = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );

    expect(khl.sold).toBe(4500);
    expect(vhl.sold).toBe(1500);
    expect(mhl.sold).toBe(1000);

    const vhlShares = computeSubscriptionPriceCategoryShares(
      DEFAULT_DASHBOARD_FILTERS,
      vhlFilters,
    );
    const mhlShares = computeSubscriptionPriceCategoryShares(
      DEFAULT_DASHBOARD_FILTERS,
      mhlFilters,
    );

    for (const shares of [vhlShares, mhlShares]) {
      const byKey = Object.fromEntries(
        shares.map((row) => [row.categoryKey, row.sold]),
      );
      expect(byKey.seasonal).toBe(0);
      expect(byKey.all_inclusive).toBeGreaterThan(0);
      expect(byKey.weekend).toBeGreaterThan(0);
    }

    expect(vhlShares.reduce((sum, row) => sum + row.sold, 0)).toBe(1500);
    expect(mhlShares.reduce((sum, row) => sum + row.sold, 0)).toBe(1000);

    expect(
      computeSubscriptionsKpis(
        DEFAULT_DASHBOARD_FILTERS,
        applySubscriptionFilterPatch(DEFAULT_SUBSCRIPTION_FILTERS, {
          league: "VHL",
          priceCategory: "seasonal",
        }),
      ).sold,
    ).toBe(0);
    expect(
      computeSubscriptionsKpis(
        DEFAULT_DASHBOARD_FILTERS,
        applySubscriptionFilterPatch(DEFAULT_SUBSCRIPTION_FILTERS, {
          league: "MHL",
          priceCategory: "seasonal",
        }),
      ).sold,
    ).toBe(0);

    expectYoyInBand(vhl);
    expectYoyInBand(mhl);
    expectYoyInBand(khl);
  });

  it("locks league × tariff catalog prices to three tiers each", () => {
    const cases: Array<{
      league: League;
      tariffs: Array<"all_inclusive" | "weekend" | "seasonal">;
    }> = [
      { league: "KHL", tariffs: ["all_inclusive", "weekend", "seasonal"] },
      { league: "VHL", tariffs: ["all_inclusive", "weekend"] },
      { league: "MHL", tariffs: ["all_inclusive", "weekend"] },
    ];

    for (const { league, tariffs } of cases) {
      const filters = leagueFilters(league);
      const rows = getTabSubscriptions(DEFAULT_DASHBOARD_FILTERS, filters);
      expect(rows.length).toBeGreaterThan(0);

      for (const tariff of tariffs) {
        const expected = SUBSCRIPTION_LIST_PRICES[league][tariff];
        expect(expected).toBeDefined();
        const sold = rows.filter(
          (sub) => getSubscriptionPriceCategory(sub) === tariff,
        );
        expect(sold.length).toBeGreaterThan(0);

        const prices = [...new Set(sold.map((sub) => sub.price))].sort(
          (left, right) => left - right,
        );
        expect(prices).toEqual([...expected!]);

        const byPrice = new Map<number, number>();
        for (const sub of sold) {
          byPrice.set(sub.price, (byPrice.get(sub.price) ?? 0) + 1);
        }
        for (const price of expected!) {
          expect(byPrice.get(price)).toBeGreaterThan(0);
        }

        const maxShare = Math.max(...byPrice.values()) / sold.length;
        expect(maxShare).toBeLessThan(0.5);
      }

      if (league === "VHL" || league === "MHL") {
        expect(
          rows.every(
            (sub) => getSubscriptionPriceCategory(sub) !== "seasonal",
          ),
        ).toBe(true);
        expect(
          rows.every((sub) => !expectedKhlPrices.has(sub.price)),
        ).toBe(true);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import type { Subscription } from "@/types/dashboard";
import {
  applyLeagueSubscriptionCatalogPrices,
  getSubscriptionListPrice,
  SUBSCRIPTION_LIST_PRICES,
  SUBSCRIPTION_TARIFF_TIER_PLAN_IDS,
} from "@/lib/mock/subscription-catalog";

describe("subscription catalog prices", () => {
  it("returns distinct league × tariff list prices", () => {
    expect(SUBSCRIPTION_LIST_PRICES.KHL.all_inclusive).toEqual([
      55_000, 65_000, 75_000,
    ]);
    expect(SUBSCRIPTION_LIST_PRICES.KHL.weekend).toEqual([
      19_000, 21_000, 23_000,
    ]);
    expect(SUBSCRIPTION_LIST_PRICES.KHL.seasonal).toEqual([
      25_000, 35_000, 45_000,
    ]);
    expect(SUBSCRIPTION_LIST_PRICES.VHL.all_inclusive).toEqual([
      10_000, 12_000, 14_000,
    ]);
    expect(SUBSCRIPTION_LIST_PRICES.VHL.weekend).toEqual([5_000, 7_000, 9_000]);
    expect(SUBSCRIPTION_LIST_PRICES.VHL.seasonal).toBeUndefined();
    expect(SUBSCRIPTION_LIST_PRICES.MHL.all_inclusive).toEqual([
      5_000, 6_000, 7_000,
    ]);
    expect(SUBSCRIPTION_LIST_PRICES.MHL.weekend).toEqual([2_000, 3_000, 4_000]);

    expect(getSubscriptionListPrice("KHL", "plan-5")).toBe(75_000);
    expect(getSubscriptionListPrice("VHL", "plan-5")).toBe(14_000);
    expect(getSubscriptionListPrice("MHL", "plan-1")).toBe(2_000);
    expect(getSubscriptionListPrice("KHL", "plan-1")).not.toBe(
      getSubscriptionListPrice("VHL", "plan-1"),
    );
  });

  it("splits a single-SKU tariff across all three catalog prices", () => {
    const rows: Subscription[] = Array.from({ length: 6 }, (_, index) => ({
      id: `sub-${index + 1}`,
      planId: "plan-5",
      planName: "Все включено",
      customerId: `cust-${index + 1}`,
      purchasedAt: new Date(2025, 7, 25),
      validTo: new Date(2025, 10, 25),
      price: 162_500,
      matchesTotal: 30,
      matchesUsed: 0,
      channel: "official_site",
      status: "active",
      season: "2025/26",
      league: "KHL",
      tournamentStage: "regular",
      arena: "main",
      ticketType: "arena",
      sector: "A",
    }));

    applyLeagueSubscriptionCatalogPrices(rows);

    expect(rows.every((sub) => sub.matchesUsed === 0)).toBe(true);
    expect(new Set(rows.map((sub) => sub.price))).toEqual(
      new Set(SUBSCRIPTION_LIST_PRICES.KHL.all_inclusive),
    );
    expect(new Set(rows.map((sub) => sub.planId))).toEqual(
      new Set(SUBSCRIPTION_TARIFF_TIER_PLAN_IDS.all_inclusive),
    );
    expect(rows.filter((sub) => sub.price === 65_000)).toHaveLength(2);
  });
});

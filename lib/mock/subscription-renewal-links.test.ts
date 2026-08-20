import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { applySeasonRenewalCustomerLinks } from "@/lib/mock/subscription-renewal-links";
import { getSubscriptions } from "@/lib/mock/hockey";
import {
  computeSubscriptionRenewal,
  RENEWAL_BASE_SEASON,
  RENEWAL_NEXT_SEASON,
} from "@/lib/subscription-renewal";
import { computeSubscriptionsKpis } from "@/lib/filters";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import {
  applySubscriptionFilterPatch,
  DEFAULT_SUBSCRIPTION_FILTERS,
} from "@/lib/subscription-filter-options";
import type {
  ArenaId,
  League,
  Sector,
  Subscription,
  TicketType,
  TournamentStage,
} from "@/types/dashboard";

function sub(
  partial: Partial<Subscription> &
    Pick<Subscription, "id" | "purchasedAt" | "season" | "customerId">,
): Subscription {
  return {
    planId: "plan-1",
    planName: "Абонемент на 5 матчей (сектор A)",
    validTo: addDays(partial.purchasedAt, 90),
    price: 19_000,
    matchesTotal: 5,
    matchesUsed: 1,
    channel: "official_site",
    status: "active",
    league: "KHL" as League,
    tournamentStage: "regular" as TournamentStage,
    arena: "main" as ArenaId,
    ticketType: "arena" as TicketType,
    sector: "A" as Sector,
    ...partial,
  };
}

describe("season renewal customer links", () => {
  it("relinks 2025/26 buyers onto 2024/25 owners 1:1 without dropping unique counts", () => {
    const rows = [
      sub({
        id: "p1",
        customerId: "prev-1",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
        planId: "plan-1",
      }),
      sub({
        id: "p2",
        customerId: "prev-2",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
        planId: "plan-2",
        planName: "Абонемент на 5 матчей (сектор B)",
      }),
      sub({
        id: "p3",
        customerId: "prev-3",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
        planId: "plan-4",
        planName: "Сезонный абонемент",
      }),
      sub({
        id: "p6",
        customerId: "prev-6",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
        planId: "plan-5",
        planName: "Все включено (VIP)",
      }),
      sub({
        id: "p4",
        customerId: "prev-4",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
        planId: "plan-1",
      }),
      sub({
        id: "p5",
        customerId: "prev-5",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
        planId: "plan-2",
        planName: "Абонемент на 5 матчей (сектор B)",
      }),
      sub({
        id: "n1",
        customerId: "next-1",
        season: RENEWAL_NEXT_SEASON,
        purchasedAt: new Date(2025, 8, 1),
      }),
      sub({
        id: "n2",
        customerId: "next-2",
        season: RENEWAL_NEXT_SEASON,
        purchasedAt: new Date(2025, 8, 1),
      }),
      sub({
        id: "n3",
        customerId: "next-3",
        season: RENEWAL_NEXT_SEASON,
        purchasedAt: new Date(2025, 8, 1),
      }),
      sub({
        id: "n4",
        customerId: "next-4",
        season: RENEWAL_NEXT_SEASON,
        purchasedAt: new Date(2025, 8, 1),
      }),
    ];

    const uniqueNextBefore = new Set(
      rows.filter((row) => row.season === RENEWAL_NEXT_SEASON).map((row) => row.customerId),
    ).size;

    applySeasonRenewalCustomerLinks(rows);

    const uniqueNextAfter = new Set(
      rows.filter((row) => row.season === RENEWAL_NEXT_SEASON).map((row) => row.customerId),
    ).size;
    expect(uniqueNextAfter).toBe(uniqueNextBefore);

    const result = computeSubscriptionRenewal({
      subscriptions: rows,
      filters: DEFAULT_SUBSCRIPTION_FILTERS,
    });
    expect(result.kpis.renewed).toBeGreaterThan(0);
    expect(result.kpis.notRenewed).toBeGreaterThan(0);
    expect(result.kpis.newClients).toBeGreaterThan(0);
    expect(result.products.map((row) => row.planName)).toEqual([
      "Все включено",
      "Выходного дня",
      "Сезонный",
    ]);
    expect(result.products.every((row) => row.renewed > 0 && row.base > 0)).toBe(
      true,
    );
  });

  it("leaves sold KPI locks intact on default KHL 2025/26", () => {
    const kpis = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );
    expect(kpis.sold).toBe(4500);

    const renewal = computeSubscriptionRenewal({
      subscriptions: getSubscriptions(),
      filters: DEFAULT_SUBSCRIPTION_FILTERS,
    });
    expect(renewal.kpis.renewed).toBeGreaterThan(0);
    expect(renewal.kpis.notRenewed).toBeGreaterThan(0);
    expect(renewal.kpis.newClients).toBeGreaterThan(0);
    expect(renewal.products.map((row) => row.planName)).toEqual([
      "Все включено",
      "Выходного дня",
      "Сезонный",
    ]);
    expect(renewal.products.every((row) => row.base > 0 && row.renewed > 0)).toBe(
      true,
    );

    for (const league of ["VHL", "MHL"] as const) {
      const leagueRenewal = computeSubscriptionRenewal({
        subscriptions: getSubscriptions(),
        filters: applySubscriptionFilterPatch(DEFAULT_SUBSCRIPTION_FILTERS, {
          league,
        }),
      });
      expect(leagueRenewal.kpis.renewed).toBeGreaterThan(0);
      expect(leagueRenewal.kpis.notRenewed).toBeGreaterThan(0);
      expect(leagueRenewal.kpis.newClients).toBeGreaterThan(0);
      expect(leagueRenewal.products).toHaveLength(3);
      expect(
        leagueRenewal.products
          .filter((row) => row.base > 0)
          .every((row) => row.renewed > 0),
      ).toBe(true);
    }
  });
});

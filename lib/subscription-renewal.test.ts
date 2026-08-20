import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  computeSubscriptionRenewal,
  getRenewalSectionTitle,
  RENEWAL_BASE_SEASON,
  RENEWAL_NEXT_SEASON,
} from "@/lib/subscription-renewal";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import type {
  ArenaId,
  League,
  Sector,
  Subscription,
  SubscriptionFilters,
  TicketType,
  TournamentStage,
} from "@/types/dashboard";

const FILTERS: SubscriptionFilters = {
  ...DEFAULT_SUBSCRIPTION_FILTERS,
  season: "2023/24",
};

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

describe("subscription renewal compute", () => {
  it("names the block for 24/25 → 25/26", () => {
    expect(getRenewalSectionTitle()).toBe("Продление 24/25 - 25/26");
  });

  it("counts unique renewed, not renewed, and new clients", () => {
    const result = computeSubscriptionRenewal({
      filters: FILTERS,
      subscriptions: [
        sub({
          id: "p1",
          customerId: "cust-keep",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
        }),
        sub({
          id: "p2",
          customerId: "cust-gone",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 2),
        }),
        sub({
          id: "n1",
          customerId: "cust-keep",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
          planId: "plan-4",
          planName: "Сезонный абонемент",
        }),
        sub({
          id: "n2",
          customerId: "cust-new",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 2),
        }),
        sub({
          id: "dup",
          customerId: "cust-keep",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 3),
        }),
      ],
    });

    expect(result.kpis.renewed).toBe(1);
    expect(result.kpis.notRenewed).toBe(1);
    expect(result.kpis.newClients).toBe(1);
    expect(result.kpis.previousUnique).toBe(2);
    expect(result.kpis.nextUnique).toBe(2);
    expect(result.kpis.renewedPct).toBeCloseTo(50);
    expect(result.kpis.notRenewedPct).toBeCloseTo(50);
    expect(result.kpis.newClientsPct).toBeCloseTo(50);
  });

  it("treats renewal as buying any 2025/26 subscription, not the same plan", () => {
    const result = computeSubscriptionRenewal({
      filters: FILTERS,
      subscriptions: [
        sub({
          id: "p1",
          customerId: "cust-a",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-1",
          planName: "Абонемент на 5 матчей (сектор A)",
        }),
        sub({
          id: "n1",
          customerId: "cust-a",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
          planId: "plan-5",
          planName: "Все включено (VIP)",
        }),
      ],
    });

    expect(result.kpis.renewed).toBe(1);
    expect(result.products.map((row) => row.planName)).toEqual([
      "Все включено",
      "Выходного дня",
      "Сезонный",
    ]);
    expect(result.products).toEqual([
      expect.objectContaining({
        categoryKey: "all_inclusive",
        planName: "Все включено",
        base: 0,
        renewed: 0,
        share: 0,
      }),
      expect.objectContaining({
        categoryKey: "weekend",
        planName: "Выходного дня",
        base: 1,
        renewed: 1,
        share: 100,
      }),
      expect.objectContaining({
        categoryKey: "seasonal",
        planName: "Сезонный",
        base: 0,
        renewed: 0,
        share: 0,
      }),
    ]);
  });

  it("excludes cancelled rows like campaign-pace sold counts", () => {
    const result = computeSubscriptionRenewal({
      filters: FILTERS,
      subscriptions: [
        sub({
          id: "p1",
          customerId: "cust-a",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
        }),
        sub({
          id: "p-cancel",
          customerId: "cust-cancel",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          status: "cancelled",
        }),
        sub({
          id: "n-cancel",
          customerId: "cust-a",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
          status: "cancelled",
        }),
      ],
    });

    expect(result.kpis.renewed).toBe(0);
    expect(result.kpis.notRenewed).toBe(1);
    expect(result.kpis.newClients).toBe(0);
  });

  it("ignores the season dropdown and honors league / arena / stage / price", () => {
    const rows = [
      sub({
        id: "khl-prev",
        customerId: "cust-khl",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
      }),
      sub({
        id: "khl-next",
        customerId: "cust-khl",
        season: RENEWAL_NEXT_SEASON,
        purchasedAt: new Date(2025, 8, 1),
      }),
      sub({
        id: "vhl-prev",
        customerId: "cust-vhl",
        season: RENEWAL_BASE_SEASON,
        purchasedAt: new Date(2024, 8, 1),
        league: "VHL",
        arena: "secondary",
      }),
      sub({
        id: "vhl-next",
        customerId: "cust-vhl",
        season: RENEWAL_NEXT_SEASON,
        purchasedAt: new Date(2025, 8, 1),
        league: "VHL",
        arena: "secondary",
      }),
    ];

    const khl = computeSubscriptionRenewal({
      subscriptions: rows,
      filters: { ...FILTERS, league: "KHL", arena: "main" },
    });
    expect(khl.kpis.renewed).toBe(1);
    expect(khl.kpis.newClients).toBe(0);

    const vhl = computeSubscriptionRenewal({
      subscriptions: rows,
      filters: { ...FILTERS, league: "VHL", arena: "secondary" },
    });
    expect(vhl.kpis.renewed).toBe(1);

    const weekendOnly = computeSubscriptionRenewal({
      subscriptions: [
        sub({
          id: "seasonal-prev",
          customerId: "cust-s",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-4",
          planName: "Сезонный абонемент",
        }),
        sub({
          id: "seasonal-next",
          customerId: "cust-s",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
          planId: "plan-4",
          planName: "Сезонный абонемент",
        }),
      ],
      filters: { ...FILTERS, priceCategory: "weekend" },
    });
    expect(weekendOnly.kpis.previousUnique).toBe(0);
    expect(weekendOnly.kpis.renewed).toBe(0);
  });

  it("breaks product share out of unique 2024/25 owners of that price category", () => {
    const result = computeSubscriptionRenewal({
      filters: FILTERS,
      subscriptions: [
        sub({
          id: "a1",
          customerId: "cust-1",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-1",
        }),
        sub({
          id: "a2",
          customerId: "cust-2",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-2",
          planName: "Абонемент на 5 матчей (сектор B)",
        }),
        sub({
          id: "b1",
          customerId: "cust-3",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-5",
          planName: "Все включено (VIP)",
        }),
        sub({
          id: "c1",
          customerId: "cust-4",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-4",
          planName: "Сезонный абонемент",
        }),
        sub({
          id: "n1",
          customerId: "cust-1",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
        }),
        sub({
          id: "n3",
          customerId: "cust-3",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
        }),
      ],
    });

    expect(result.products.map((row) => row.planName)).toEqual([
      "Все включено",
      "Выходного дня",
      "Сезонный",
    ]);
    const byCategory = Object.fromEntries(
      result.products.map((row) => [row.categoryKey, row]),
    );
    expect(byCategory.all_inclusive?.base).toBe(1);
    expect(byCategory.all_inclusive?.renewed).toBe(1);
    expect(byCategory.all_inclusive?.share).toBeCloseTo(100);
    expect(byCategory.weekend?.base).toBe(2);
    expect(byCategory.weekend?.renewed).toBe(1);
    expect(byCategory.weekend?.share).toBeCloseTo(50);
    expect(byCategory.seasonal?.base).toBe(1);
    expect(byCategory.seasonal?.renewed).toBe(0);
    expect(byCategory.seasonal?.share).toBeCloseTo(0);
  });

  it("counts an owner once per 2024/25 category even with two plans in it", () => {
    const result = computeSubscriptionRenewal({
      filters: FILTERS,
      subscriptions: [
        sub({
          id: "w1",
          customerId: "cust-multi",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-1",
        }),
        sub({
          id: "w2",
          customerId: "cust-multi",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 2),
          planId: "plan-2",
          planName: "Абонемент на 5 матчей (сектор B)",
        }),
        sub({
          id: "n1",
          customerId: "cust-multi",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
          planId: "plan-5",
          planName: "Все включено (VIP)",
        }),
      ],
    });

    const weekend = result.products.find((row) => row.categoryKey === "weekend");
    expect(weekend?.base).toBe(1);
    expect(weekend?.renewed).toBe(1);
    expect(weekend?.share).toBeCloseTo(100);
  });

  it("puts a 2024/25 owner into every category they bought", () => {
    const result = computeSubscriptionRenewal({
      filters: FILTERS,
      subscriptions: [
        sub({
          id: "w1",
          customerId: "cust-split",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 1),
          planId: "plan-1",
        }),
        sub({
          id: "s1",
          customerId: "cust-split",
          season: RENEWAL_BASE_SEASON,
          purchasedAt: new Date(2024, 8, 2),
          planId: "plan-4",
          planName: "Сезонный абонемент",
        }),
        sub({
          id: "n1",
          customerId: "cust-split",
          season: RENEWAL_NEXT_SEASON,
          purchasedAt: new Date(2025, 8, 1),
        }),
      ],
    });

    const byCategory = Object.fromEntries(
      result.products.map((row) => [row.categoryKey, row]),
    );
    expect(byCategory.weekend?.base).toBe(1);
    expect(byCategory.weekend?.renewed).toBe(1);
    expect(byCategory.seasonal?.base).toBe(1);
    expect(byCategory.seasonal?.renewed).toBe(1);
    expect(byCategory.all_inclusive?.base).toBe(0);
    expect(result.kpis.previousUnique).toBe(1);
    expect(result.kpis.renewed).toBe(1);
  });
});

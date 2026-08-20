import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { fillEmptyCampaignPaceDays } from "@/lib/mock/hockey-generator";
import { getSubscriptions } from "@/lib/mock/hockey";
import { MOCK_TODAY } from "@/lib/mock/constants";
import {
  computeCampaignBenchmark,
  getCampaignDayNumber,
  getSeasonTicketCampaignConfigs,
} from "@/lib/subscription-campaign";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import type {
  ArenaId,
  League,
  Sector,
  Subscription,
  TicketType,
  TournamentStage,
} from "@/types/dashboard";

function sub(
  partial: Partial<Subscription> & Pick<Subscription, "id" | "purchasedAt" | "season">,
): Subscription {
  return {
    planId: "plan-1",
    planName: "Сезонный",
    customerId: `cust-${partial.id}`,
    validTo: addDays(partial.purchasedAt, 90),
    price: 25_000,
    matchesTotal: 10,
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

function campaignDayCounts(
  subscriptions: readonly Subscription[],
  seasonId: string,
  startDate: Date,
  totalDays: number,
): number[] {
  const counts = Array.from({ length: totalDays }, () => 0);
  for (const row of subscriptions) {
    if (row.season !== seasonId || row.status === "cancelled") continue;
    if (row.league !== "KHL" || row.arena !== "main") continue;
    const day = getCampaignDayNumber(row.purchasedAt, startDate);
    if (day < 1 || day > totalDays) continue;
    counts[day - 1] += 1;
  }
  return counts;
}

describe("fillEmptyCampaignPaceDays", () => {
  it("moves 2025/26 surplus onto empty days without adding rows", () => {
    const start = new Date(2025, 7, 25);
    const subscriptions: Subscription[] = [];
    for (let index = 0; index < 44; index += 1) {
      subscriptions.push(
        sub({
          id: `cur-${index + 1}`,
          season: "2025/26",
          purchasedAt: addDays(start, 2 + (index % 20)),
        }),
      );
    }

    const before = subscriptions.length;
    fillEmptyCampaignPaceDays(subscriptions);
    expect(subscriptions.length).toBe(before);

    const counts = campaignDayCounts(subscriptions, "2025/26", start, 22);
    expect(counts.every((count) => count > 0)).toBe(true);
  });

  it("clones 2024/25 sales onto days before the KPI window", () => {
    const start = new Date(2024, 7, 20);
    const windowStart = new Date(2024, 7, 25);
    const subscriptions: Subscription[] = [];
    for (let index = 0; index < 54; index += 1) {
      subscriptions.push(
        sub({
          id: `prev-${index + 1}`,
          season: "2024/25",
          purchasedAt: addDays(windowStart, index % 21),
        }),
      );
    }

    fillEmptyCampaignPaceDays(subscriptions);

    const counts = campaignDayCounts(subscriptions, "2024/25", start, 27);
    expect(counts.slice(0, 5).every((count) => count > 0)).toBe(true);
    expect(counts.every((count) => count > 0)).toBe(true);
  });
});

describe("default campaign pace mock data", () => {
  it("has no zero counts for 2025/26 vs 2024/25", () => {
    const result = computeCampaignBenchmark({
      subscriptions: getSubscriptions(),
      filters: DEFAULT_SUBSCRIPTION_FILTERS,
      dataAsOfDate: MOCK_TODAY,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.points.length).toBeGreaterThan(0);
    for (const point of result.points) {
      expect(point.currentSeasonCount).toBeGreaterThan(0);
      if (point.benchmarkSeasonCount != null) {
        expect(point.benchmarkSeasonCount).toBeGreaterThan(0);
      }
    }

    const campaigns = getSeasonTicketCampaignConfigs();
    expect(campaigns.some((campaign) => campaign.seasonId === "2025/26")).toBe(
      true,
    );
  });
});

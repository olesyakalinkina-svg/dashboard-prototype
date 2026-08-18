import { describe, expect, it } from "vitest";
import {
  aggregateDailySales,
  alignCampaignSeries,
  computeAbsoluteGap,
  computeCampaignBenchmark,
  computePercentageGap,
  getCampaignAvailableDays,
  getCampaignDayNumber,
  getCampaignElapsedDays,
  getCampaignStatus,
  getDataAsOfDate,
  getDefaultBenchmarkCampaignConfig,
  getPointDate,
  getPreviousCampaignConfig,
  isValidSoldSubscription,
  listComparableCampaignConfigs,
  listSeasonTicketCampaigns,
  resolveBenchmarkCampaignConfig,
  toCalendarDateKey,
  toCumulativeSeries,
  type SeasonTicketCampaignConfig,
} from "@/lib/subscription-campaign";
import type {
  ArenaId,
  League,
  Sector,
  Subscription,
  SubscriptionFilters,
  TicketType,
  TournamentStage,
} from "@/types/dashboard";

const DEFAULT_FILTERS: SubscriptionFilters = {
  season: "2025/26",
  league: "all",
  tournamentStage: "all",
  arena: "all",
  ticketType: "all",
  timeGrouping: "week",
};

const CAMPAIGNS: SeasonTicketCampaignConfig[] = [
  {
    id: "c-a",
    seasonId: "2024/25",
    seasonName: "2024/25",
    startDate: "2024-08-20",
    endDate: "2024-09-15",
  },
  {
    id: "c-b",
    seasonId: "2025/26",
    seasonName: "2025/26",
    startDate: "2025-08-25",
    endDate: "2025-09-15",
  },
  {
    id: "c-d",
    seasonId: "2026/27",
    seasonName: "2026/27",
    startDate: "2026-08-25",
    endDate: "2026-09-15",
  },
];

function sub(partial: Partial<Subscription> & Pick<Subscription, "id" | "purchasedAt" | "season">): Subscription {
  return {
    planId: "plan-1",
    planName: "Сезонный",
    customerId: `cust-${partial.id}`,
    validTo: new Date(2026, 4, 31),
    price: 10_000,
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

describe("campaign day number", () => {
  it("treats the start date as day 1", () => {
    expect(getCampaignDayNumber("2025-08-25", "2025-08-25")).toBe(1);
    expect(getCampaignElapsedDays(new Date(2025, 7, 25), "2025-08-25")).toBe(1);
  });

  it("aligns the same day number across different calendar starts", () => {
    expect(getCampaignDayNumber("2025-09-08", "2025-08-25")).toBe(15);
    expect(getCampaignDayNumber("2024-09-03", "2024-08-20")).toBe(15);
    expect(toCalendarDateKey(getPointDate("2025-08-25", 15))).toBe("2025-09-08");
    expect(toCalendarDateKey(getPointDate("2024-08-20", 15))).toBe("2024-09-03");
  });

  it("includes the campaign end date", () => {
    expect(getCampaignDayNumber("2025-09-15", "2025-08-25")).toBe(22);
  });

  it("handles leap day on the campaign axis", () => {
    expect(getCampaignDayNumber("2024-02-29", "2024-02-28")).toBe(2);
    expect(getCampaignDayNumber("2023-03-01", "2023-02-28")).toBe(2);
    expect(toCalendarDateKey(getPointDate("2024-02-28", 2))).toBe("2024-02-29");
    expect(toCalendarDateKey(getPointDate("2023-02-28", 2))).toBe("2023-03-01");
  });
});

describe("campaign availability", () => {
  const campaign = CAMPAIGNS[1];

  it("returns 0 when dataAsOf is before start", () => {
    expect(getCampaignAvailableDays(campaign, new Date(2025, 7, 24))).toBe(0);
    expect(getCampaignStatus(campaign, new Date(2025, 7, 24))).toBe("upcoming");
  });

  it("returns 1 when the campaign starts today", () => {
    expect(getCampaignAvailableDays(campaign, new Date(2025, 7, 25))).toBe(1);
    expect(getCampaignStatus(campaign, new Date(2025, 7, 25))).toBe("active");
  });

  it("truncates an active campaign to elapsed days, not the full window", () => {
    expect(getCampaignAvailableDays(campaign, new Date(2025, 8, 5))).toBe(12);
    expect(getCampaignStatus(campaign, new Date(2025, 8, 5))).toBe("active");
  });

  it("uses the full window after the campaign ends", () => {
    expect(getCampaignAvailableDays(campaign, new Date(2026, 4, 15))).toBe(22);
    expect(getCampaignStatus(campaign, new Date(2026, 4, 15))).toBe("completed");
  });
});

describe("daily aggregation and cumulative totals", () => {
  it("keeps empty calendar days and carries the previous cumulative", () => {
    const daily = aggregateDailySales(
      [
        sub({ id: "s1", season: "2025/26", purchasedAt: new Date(2025, 7, 27), price: 1000 }),
        sub({ id: "s2", season: "2025/26", purchasedAt: new Date(2025, 7, 29), price: 2000 }),
      ],
      "2025-08-25",
      5,
    );

    expect(daily.map((row) => row.count)).toEqual([0, 0, 1, 0, 1]);
    const cumulative = toCumulativeSeries(daily);
    expect(cumulative.map((row) => row.count)).toEqual([0, 0, 1, 1, 2]);
    expect(cumulative.map((row) => row.revenue)).toEqual([0, 0, 1000, 1000, 3000]);
  });

  it("does not double-sum already cumulative values", () => {
    const daily = aggregateDailySales(
      [
        sub({ id: "s1", season: "2025/26", purchasedAt: new Date(2025, 7, 25), price: 100 }),
        sub({ id: "s2", season: "2025/26", purchasedAt: new Date(2025, 7, 25), price: 100 }),
        sub({ id: "s3", season: "2025/26", purchasedAt: new Date(2025, 7, 26), price: 50 }),
      ],
      "2025-08-25",
      2,
    );
    const cumulative = toCumulativeSeries(daily);
    expect(cumulative[0]).toMatchObject({ count: 2, revenue: 200 });
    expect(cumulative[1]).toMatchObject({ count: 3, revenue: 250 });
  });

  it("counts multiple subscriptions from one customer independently", () => {
    const daily = aggregateDailySales(
      [
        sub({
          id: "s1",
          season: "2025/26",
          customerId: "cust-same",
          purchasedAt: new Date(2025, 7, 25),
          price: 4000,
        }),
        sub({
          id: "s2",
          season: "2025/26",
          customerId: "cust-same",
          purchasedAt: new Date(2025, 7, 25),
          price: 6000,
        }),
      ],
      "2025-08-25",
      1,
    );
    expect(daily[0]).toMatchObject({ count: 2, revenue: 10_000 });
  });

  it("excludes cancelled subscriptions from count and revenue", () => {
    const cancelled = sub({
      id: "s-cancel",
      season: "2025/26",
      purchasedAt: new Date(2025, 7, 25),
      price: 50_000,
      status: "cancelled",
    });
    expect(isValidSoldSubscription(cancelled)).toBe(false);

    const daily = aggregateDailySales(
      [
        cancelled,
        sub({ id: "s-ok", season: "2025/26", purchasedAt: new Date(2025, 7, 25), price: 1000 }),
      ],
      "2025-08-25",
      1,
    );
    expect(daily[0]).toMatchObject({ count: 1, revenue: 1000 });
  });

  it("excludes purchases before start and after the cutoff day", () => {
    const daily = aggregateDailySales(
      [
        sub({ id: "before", season: "2025/26", purchasedAt: new Date(2025, 7, 24), price: 1000 }),
        sub({ id: "on-start", season: "2025/26", purchasedAt: new Date(2025, 7, 25), price: 2000 }),
        sub({ id: "after", season: "2025/26", purchasedAt: new Date(2025, 7, 27), price: 3000 }),
      ],
      "2025-08-25",
      2,
    );
    expect(daily.map((row) => row.revenue)).toEqual([2000, 0]);
  });
});

describe("gaps", () => {
  it("returns null percentage when the benchmark base is zero", () => {
    expect(computePercentageGap(170, 0)).toBeNull();
    expect(computePercentageGap(0, 0)).toBeNull();
    expect(computeAbsoluteGap(170, 0)).toBe(170);
    expect(computePercentageGap(2480, 2310)).toBeCloseTo((170 / 2310) * 100);
  });
});

describe("alignCampaignSeries", () => {
  it("does not connect a shorter benchmark with zeros", () => {
    const main = toCumulativeSeries(
      aggregateDailySales(
        [
          sub({ id: "a", season: "2025/26", purchasedAt: new Date(2025, 7, 25), price: 100 }),
          sub({ id: "b", season: "2025/26", purchasedAt: new Date(2025, 7, 27), price: 100 }),
        ],
        "2025-08-25",
        3,
      ),
    );
    const benchmark = toCumulativeSeries(
      aggregateDailySales(
        [sub({ id: "c", season: "2024/25", purchasedAt: new Date(2024, 7, 20), price: 50 })],
        "2024-08-20",
        1,
      ),
    );

    const points = alignCampaignSeries({
      mainCampaignStart: "2025-08-25",
      benchmarkCampaignStart: "2024-08-20",
      mainSeries: main,
      benchmarkSeries: benchmark,
      mainChartDays: 3,
      benchmarkChartDays: 1,
    });

    expect(points).toHaveLength(3);
    expect(points[0].benchmarkSeasonCount).toBe(1);
    expect(points[1].benchmarkSeasonCount).toBeNull();
    expect(points[2].benchmarkSeasonCount).toBeNull();
    expect(points[1].benchmarkSeasonRevenue).toBeNull();
  });
});

describe("computeCampaignBenchmark", () => {
  const subscriptions: Subscription[] = [
    sub({ id: "m1", season: "2025/26", purchasedAt: new Date(2025, 7, 27), price: 4000 }),
    sub({ id: "m2", season: "2025/26", purchasedAt: new Date(2025, 7, 28), price: 6000 }),
    sub({ id: "b1", season: "2024/25", purchasedAt: new Date(2024, 7, 22), price: 3000 }),
    sub({ id: "b2", season: "2024/25", purchasedAt: new Date(2024, 7, 23), price: 5000 }),
  ];

  it("returns campaign-not-started when dataAsOf is before start", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2025, 7, 24),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("campaign_not_started");
    if (result.kind !== "campaign_not_started") return;
    expect(result.message).toBe("Кампания ещё не началась");
  });

  it("shows day 1 when the campaign started today", () => {
    const result = computeCampaignBenchmark({
      subscriptions: [
        sub({ id: "today", season: "2025/26", purchasedAt: new Date(2025, 7, 25), price: 1000 }),
        sub({ id: "bench", season: "2024/25", purchasedAt: new Date(2024, 7, 20), price: 800 }),
      ],
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2025, 7, 25),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.points).toHaveLength(1);
    expect(result.points[0].campaignDay).toBe(1);
    expect(result.points[0].currentSeasonCount).toBe(1);
    expect(result.mainCampaign.status).toBe("active");
  });

  it("truncates a completed benchmark to the elapsed day of an active campaign", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2025, 8, 5),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.mainAvailableDays).toBe(12);
    expect(result.benchmarkAvailableDays).toBe(12);
    expect(result.commonComparisonDays).toBe(12);
    expect(result.points).toHaveLength(12);
    expect(result.points.at(-1)?.campaignDay).toBe(12);
  });

  it("does not extend an active campaign into the future", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2025, 8, 1),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.points.every((point) => point.campaignDay <= 8)).toBe(true);
    expect(
      result.points.every(
        (point) =>
          point.currentSeasonDate == null || point.currentSeasonDate <= "2025-09-01",
      ),
    ).toBe(true);
  });

  it("uses dataAsOf even when it is not today, and a completed main campaign uses the full window", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.dataAsOfDate).toBe("2026-05-15");
    expect(result.mainAvailableDays).toBe(22);
    expect(result.mainCampaign.status).toBe("completed");
    expect(result.points).toHaveLength(22);
  });

  it("stops the shorter benchmark line and warns instead of zero-filling", () => {
    const shortBenchmarkCampaigns: SeasonTicketCampaignConfig[] = [
      {
        id: "c-short",
        seasonId: "2024/25",
        seasonName: "2024/25",
        startDate: "2024-08-20",
        endDate: "2024-09-05",
      },
      {
        id: "c-main",
        seasonId: "2025/26",
        seasonName: "2025/26",
        startDate: "2025-08-25",
        endDate: "2025-09-15",
      },
    ];
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: shortBenchmarkCampaigns,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.mainCampaign.seasonId).toBe("2025/26");
    expect(result.benchmarkCampaign.seasonId).toBe("2024/25");
    expect(result.benchmarkRawAvailableDays).toBe(17);
    expect(result.mainAvailableDays).toBe(22);
    expect(result.commonComparisonDays).toBe(17);
    expect(result.points[16].benchmarkSeasonCount).not.toBeNull();
    expect(result.points[17].benchmarkSeasonCount).toBeNull();
    expect(
      result.warnings.some((warning) =>
        warning.includes("доступны данные только за 17 из 22 сравниваемых дней"),
      ),
    ).toBe(true);
    expect(result.latestCountGap.absolute).toBe(result.points[16].countAbsoluteGap);
  });

  it("returns no operations when filters exclude every sale", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: { ...DEFAULT_FILTERS, league: "MHL" },
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("no_operations");
  });

  it("applies attribute filters equally to both seasons", () => {
    const mixed: Subscription[] = [
      sub({
        id: "khl-main",
        season: "2025/26",
        league: "KHL",
        purchasedAt: new Date(2025, 7, 27),
        price: 1000,
      }),
      sub({
        id: "vhl-main",
        season: "2025/26",
        league: "VHL",
        purchasedAt: new Date(2025, 7, 27),
        price: 9000,
      }),
      sub({
        id: "khl-bench",
        season: "2024/25",
        league: "KHL",
        purchasedAt: new Date(2024, 7, 22),
        price: 2000,
      }),
      sub({
        id: "vhl-bench",
        season: "2024/25",
        league: "VHL",
        purchasedAt: new Date(2024, 7, 22),
        price: 8000,
      }),
    ];

    const result = computeCampaignBenchmark({
      subscriptions: mixed,
      filters: { ...DEFAULT_FILTERS, league: "KHL" },
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const last = result.points[result.commonComparisonDays - 1];
    expect(last.currentSeasonRevenue).toBe(1000);
    expect(last.benchmarkSeasonRevenue).toBe(2000);
  });

  it("returns no_comparison_season when only one campaign exists", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: { ...DEFAULT_FILTERS, season: "2024/25" },
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: [CAMPAIGNS[0]],
    });
    expect(result.kind).toBe("no_comparison_season");
    if (result.kind !== "no_comparison_season") return;
    expect(result.message).toBe("Нет другого сезона для сравнения.");
    expect(result.mainCampaign?.seasonId).toBe("2024/25");
    expect(result.benchmarkCampaign).toBeNull();
  });

  it("defaults the oldest season to the next campaign instead of leaving comparison empty", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: { ...DEFAULT_FILTERS, season: "2024/25" },
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.mainCampaign.seasonId).toBe("2024/25");
    expect(result.benchmarkCampaign.seasonId).toBe("2025/26");
  });

  it("returns no_main_season when the global season is all", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: { ...DEFAULT_FILTERS, season: "all" },
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("no_main_season");
  });

  it("marks zero-base percentage when benchmark revenue is 0", () => {
    const result = computeCampaignBenchmark({
      subscriptions: [
        sub({ id: "m", season: "2025/26", purchasedAt: new Date(2025, 7, 27), price: 1000 }),
      ],
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.latestRevenueGap.absolute).toBe(1000);
    expect(result.latestRevenueGap.percentage).toBeNull();
    expect(result.warnings).toContain("Нет базы для сравнения");
  });

  it("derives the previous season from the selected season using campaign order", () => {
    const current = computeCampaignBenchmark({
      subscriptions,
      filters: DEFAULT_FILTERS,
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(current.kind).toBe("ok");
    if (current.kind === "ok") {
      expect(current.mainCampaign.seasonId).toBe("2025/26");
      expect(current.benchmarkCampaign.seasonId).toBe("2024/25");
      expect(current.mainCampaign.seasonName).toBe("2025/26");
      expect(current.benchmarkCampaign.seasonName).toBe("2024/25");
    }

    const previous = computeCampaignBenchmark({
      subscriptions,
      filters: { ...DEFAULT_FILTERS, season: "2024/25" },
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(previous.kind).toBe("ok");
    if (previous.kind === "ok") {
      expect(previous.mainCampaign.seasonId).toBe("2024/25");
      expect(previous.benchmarkCampaign.seasonId).toBe("2025/26");
    }

    const latest = computeCampaignBenchmark({
      subscriptions: [
        sub({
          id: "latest",
          season: "2026/27",
          purchasedAt: new Date(2026, 7, 25),
          price: 1000,
        }),
        sub({
          id: "prev-latest",
          season: "2025/26",
          purchasedAt: new Date(2025, 7, 25),
          price: 800,
        }),
      ],
      filters: { ...DEFAULT_FILTERS, season: "2026/27" },
      dataAsOfDate: new Date(2026, 7, 25),
      campaigns: CAMPAIGNS,
    });
    expect(latest.kind).toBe("ok");
    if (latest.kind === "ok") {
      expect(latest.benchmarkCampaign.seasonId).toBe("2025/26");
    }
  });

  it("does not pick a previous season by hardcoded 2025/26 names", () => {
    expect(getPreviousCampaignConfig("2025/26", CAMPAIGNS)?.seasonId).toBe("2024/25");
    expect(getPreviousCampaignConfig("2024/25", CAMPAIGNS)).toBeNull();
    expect(getPreviousCampaignConfig("2026/27", CAMPAIGNS)?.seasonId).toBe("2025/26");
  });

  it("defaults the comparison season to the previous campaign by start date", () => {
    expect(getDefaultBenchmarkCampaignConfig("2025/26", CAMPAIGNS)?.seasonId).toBe(
      "2024/25",
    );
    expect(getDefaultBenchmarkCampaignConfig("2026/27", CAMPAIGNS)?.seasonId).toBe(
      "2025/26",
    );
    expect(getDefaultBenchmarkCampaignConfig("2024/25", CAMPAIGNS)?.seasonId).toBe(
      "2025/26",
    );
    expect(
      listComparableCampaignConfigs("2025/26", CAMPAIGNS).map((c) => c.seasonId),
    ).toEqual(["2024/25"]);
    expect(
      listComparableCampaignConfigs("2024/25", CAMPAIGNS).map((c) => c.seasonId),
    ).toEqual(["2025/26"]);
    expect(
      listComparableCampaignConfigs("2026/27", CAMPAIGNS).map((c) => c.seasonId),
    ).toEqual(["2024/25", "2025/26"]);
  });

  it("never offers 2026/27 in the compare selector", () => {
    expect(listComparableCampaignConfigs("2024/25").map((c) => c.seasonId)).toEqual([
      "2025/26",
    ]);
    expect(listComparableCampaignConfigs("2025/26").map((c) => c.seasonId)).toEqual([
      "2024/25",
    ]);
    expect(listComparableCampaignConfigs("2026/27").map((c) => c.seasonId)).toEqual([
      "2024/25",
      "2025/26",
    ]);
    expect(resolveBenchmarkCampaignConfig("2024/25", "2026/27", CAMPAIGNS)?.seasonId).toBe(
      "2025/26",
    );
  });

  it("uses the selector season when it is not the main campaign", () => {
    const result = computeCampaignBenchmark({
      subscriptions: [
        sub({ id: "m", season: "2026/27", purchasedAt: new Date(2026, 7, 25), price: 4000 }),
        sub({ id: "b", season: "2024/25", purchasedAt: new Date(2024, 7, 22), price: 1000 }),
      ],
      filters: { ...DEFAULT_FILTERS, season: "2026/27" },
      benchmarkSeasonId: "2024/25",
      dataAsOfDate: new Date(2026, 7, 25),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.mainCampaign.seasonId).toBe("2026/27");
    expect(result.benchmarkCampaign.seasonId).toBe("2024/25");
  });

  it("rejects the same season in the selector and falls back to previous", () => {
    const result = computeCampaignBenchmark({
      subscriptions,
      filters: DEFAULT_FILTERS,
      benchmarkSeasonId: "2025/26",
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: CAMPAIGNS,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.mainCampaign.seasonId).toBe("2025/26");
    expect(result.benchmarkCampaign.seasonId).toBe("2024/25");
    expect(resolveBenchmarkCampaignConfig("2025/26", "2025/26", CAMPAIGNS)?.seasonId).toBe(
      "2024/25",
    );
    expect(resolveBenchmarkCampaignConfig("2025/26", "missing", CAMPAIGNS)?.seasonId).toBe(
      "2024/25",
    );
  });

  it("truncates a completed benchmark to the elapsed days of an active selected campaign", () => {
    const liveCampaigns: SeasonTicketCampaignConfig[] = [
      {
        id: "c-prev",
        seasonId: "2024/25",
        seasonName: "2024/25",
        startDate: "2024-08-20",
        endDate: "2024-09-15",
      },
      {
        id: "c-live",
        seasonId: "2026/27",
        seasonName: "2026/27",
        startDate: "2026-04-01",
        endDate: "2026-06-15",
      },
    ];
    const result = computeCampaignBenchmark({
      subscriptions: [
        sub({ id: "live", season: "2026/27", purchasedAt: new Date(2026, 3, 3), price: 1000 }),
        sub({ id: "prev", season: "2024/25", purchasedAt: new Date(2024, 7, 22), price: 800 }),
      ],
      filters: { ...DEFAULT_FILTERS, season: "2026/27" },
      dataAsOfDate: new Date(2026, 4, 15),
      campaigns: liveCampaigns,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.mainCampaign.status).toBe("active");
    expect(result.benchmarkCampaign.status).toBe("completed");
    expect(result.mainAvailableDays).toBe(45);
    expect(result.benchmarkAvailableDays).toBe(27);
    expect(result.commonComparisonDays).toBe(27);
    expect(result.points).toHaveLength(45);
    expect(result.points[26].benchmarkSeasonCount).not.toBeNull();
    expect(result.points[27].benchmarkSeasonCount).toBeNull();
  });
});

describe("configured campaigns as of mock today", () => {
  it("has two completed campaigns and one active spring pre-sale", () => {
    const asOf = getDataAsOfDate();
    expect(toCalendarDateKey(asOf)).toBe("2026-05-15");
    const listed = listSeasonTicketCampaigns(asOf);
    expect(listed.filter((campaign) => campaign.status === "completed")).toHaveLength(2);
    expect(listed.filter((campaign) => campaign.status === "active")).toHaveLength(1);
    expect(listed.filter((campaign) => campaign.status === "upcoming")).toHaveLength(0);
    const active = listed.find((campaign) => campaign.status === "active");
    expect(active).toBeDefined();
    expect(active!.startDate < "2026-05-15").toBe(true);
    expect(active!.endDate == null || active!.endDate > "2026-05-15").toBe(true);
  });
});

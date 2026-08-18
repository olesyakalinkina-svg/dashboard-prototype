import type { Subscription, SubscriptionFilters } from "@/types/dashboard";
import {
  buildShortBenchmarkWarning,
  getCampaignAvailableDays,
  getSeasonTicketCampaignConfigs,
  resolveBenchmarkCampaignConfig,
  type SeasonTicketCampaignConfig,
  withCampaignStatus,
} from "@/lib/subscription-campaign/campaigns";
import {
  getCampaignDayNumber,
  getPointDate,
  parseCalendarDate,
  toCalendarDateKey,
} from "@/lib/subscription-campaign/dates";
import type {
  CampaignBenchmarkComputation,
  CampaignCountPoint,
  CampaignCumulativePoint,
  CampaignDailyTotals,
  CampaignPacePoint,
  CampaignRevenuePoint,
} from "@/lib/subscription-campaign/types";

export type SubscriptionCampaignAttributeFilters = Pick<
  SubscriptionFilters,
  "league" | "tournamentStage" | "arena" | "ticketType"
>;

export function isValidSoldSubscription(sub: Subscription): boolean {
  return sub.status !== "cancelled";
}

export function subscriptionMatchesCampaignFilters(
  sub: Subscription,
  filters: SubscriptionCampaignAttributeFilters,
): boolean {
  if (filters.league !== "all" && sub.league !== filters.league) return false;
  if (
    filters.tournamentStage !== "all" &&
    sub.tournamentStage !== filters.tournamentStage
  ) {
    return false;
  }
  if (filters.arena !== "all" && sub.arena !== filters.arena) return false;
  if (filters.ticketType !== "all" && sub.ticketType !== filters.ticketType) {
    return false;
  }
  return true;
}

export function computeAbsoluteGap(
  current: number | null,
  benchmark: number | null,
): number | null {
  if (current == null || benchmark == null) return null;
  return current - benchmark;
}

export function computePercentageGap(
  current: number | null,
  benchmark: number | null,
): number | null {
  if (current == null || benchmark == null) return null;
  if (benchmark === 0) return null;
  return ((current - benchmark) / benchmark) * 100;
}

export function filterCampaignSubscriptions(
  subscriptions: readonly Subscription[],
  campaign: Pick<SeasonTicketCampaignConfig, "seasonId" | "startDate" | "endDate">,
  filters: SubscriptionCampaignAttributeFilters,
  availableDays: number,
): Subscription[] {
  if (availableDays < 1) return [];

  const start = parseCalendarDate(campaign.startDate);
  const lastDay = getPointDate(campaign.startDate, availableDays);

  return subscriptions.filter((sub) => {
    if (sub.season !== campaign.seasonId) return false;
    if (!subscriptionMatchesCampaignFilters(sub, filters)) return false;
    const purchased = parseCalendarDate(sub.purchasedAt);
    if (purchased < start) return false;
    if (purchased > lastDay) return false;
    return true;
  });
}

export function aggregateDailySales(
  subscriptions: readonly Subscription[],
  campaignStart: string,
  availableDays: number,
): CampaignDailyTotals[] {
  const buckets = new Map<number, { count: number; revenue: number }>();
  for (let day = 1; day <= availableDays; day += 1) {
    buckets.set(day, { count: 0, revenue: 0 });
  }

  for (const sub of subscriptions) {
    if (!isValidSoldSubscription(sub)) continue;
    const day = getCampaignDayNumber(sub.purchasedAt, campaignStart);
    if (day < 1 || day > availableDays) continue;
    const bucket = buckets.get(day);
    if (!bucket) continue;
    buckets.set(day, {
      count: bucket.count + 1,
      revenue: bucket.revenue + sub.price,
    });
  }

  const rows: CampaignDailyTotals[] = [];
  for (let day = 1; day <= availableDays; day += 1) {
    const bucket = buckets.get(day) ?? { count: 0, revenue: 0 };
    rows.push({
      campaignDay: day,
      dateKey: toCalendarDateKey(getPointDate(campaignStart, day)),
      count: bucket.count,
      revenue: bucket.revenue,
    });
  }
  return rows;
}

export function toCumulativeSeries(
  daily: readonly CampaignDailyTotals[],
): CampaignCumulativePoint[] {
  let count = 0;
  let revenue = 0;
  return daily.map((row) => {
    count += row.count;
    revenue += row.revenue;
    return {
      campaignDay: row.campaignDay,
      dateKey: row.dateKey,
      count,
      revenue,
    };
  });
}

function seriesByDay(
  series: readonly CampaignCumulativePoint[],
): Map<number, CampaignCumulativePoint> {
  return new Map(series.map((point) => [point.campaignDay, point]));
}

export function alignCampaignSeries(input: {
  mainCampaignStart: string;
  benchmarkCampaignStart: string;
  mainSeries: readonly CampaignCumulativePoint[];
  benchmarkSeries: readonly CampaignCumulativePoint[];
  mainChartDays: number;
  benchmarkChartDays: number;
}): CampaignPacePoint[] {
  const mainByDay = seriesByDay(input.mainSeries);
  const benchmarkByDay = seriesByDay(input.benchmarkSeries);
  const axisDays = Math.max(input.mainChartDays, input.benchmarkChartDays);
  const points: CampaignPacePoint[] = [];

  for (let day = 1; day <= axisDays; day += 1) {
    const current = day <= input.mainChartDays ? mainByDay.get(day) ?? null : null;
    const benchmark =
      day <= input.benchmarkChartDays ? benchmarkByDay.get(day) ?? null : null;

    const currentCount = current ? current.count : null;
    const benchmarkCount = benchmark ? benchmark.count : null;
    const currentRevenue = current ? current.revenue : null;
    const benchmarkRevenue = benchmark ? benchmark.revenue : null;

    points.push({
      campaignDay: day,
      currentSeasonDate: current?.dateKey ?? null,
      benchmarkSeasonDate: benchmark?.dateKey ?? null,
      currentSeasonCount: currentCount,
      benchmarkSeasonCount: benchmarkCount,
      currentSeasonRevenue: currentRevenue,
      benchmarkSeasonRevenue: benchmarkRevenue,
      countAbsoluteGap: computeAbsoluteGap(currentCount, benchmarkCount),
      countPercentageGap: computePercentageGap(currentCount, benchmarkCount),
      revenueAbsoluteGap: computeAbsoluteGap(currentRevenue, benchmarkRevenue),
      revenuePercentageGap: computePercentageGap(
        currentRevenue,
        benchmarkRevenue,
      ),
    });
  }

  return points;
}

function toCountPoints(points: readonly CampaignPacePoint[]): CampaignCountPoint[] {
  return points.map((point) => ({
    campaignDay: point.campaignDay,
    currentSeasonDate: point.currentSeasonDate,
    benchmarkSeasonDate: point.benchmarkSeasonDate,
    currentSeasonCount: point.currentSeasonCount,
    benchmarkSeasonCount: point.benchmarkSeasonCount,
    absoluteGap: point.countAbsoluteGap,
    percentageGap: point.countPercentageGap,
  }));
}

function toRevenuePoints(
  points: readonly CampaignPacePoint[],
): CampaignRevenuePoint[] {
  return points.map((point) => ({
    campaignDay: point.campaignDay,
    currentSeasonDate: point.currentSeasonDate,
    benchmarkSeasonDate: point.benchmarkSeasonDate,
    currentSeasonRevenue: point.currentSeasonRevenue,
    benchmarkSeasonRevenue: point.benchmarkSeasonRevenue,
    absoluteGap: point.revenueAbsoluteGap,
    percentageGap: point.revenuePercentageGap,
  }));
}

export type ComputeCampaignBenchmarkInput = {
  subscriptions: readonly Subscription[];
  filters: SubscriptionFilters;
  dataAsOfDate: Date;
  /** Comparison season from the shared «Сравнить с» selector. */
  benchmarkSeasonId?: string | null;
  campaigns?: readonly SeasonTicketCampaignConfig[];
};

function emptyComputation(
  kind: Exclude<CampaignBenchmarkComputation["kind"], "ok">,
  message: string,
  input: {
    mainCampaign: CampaignBenchmarkComputation["mainCampaign"];
    benchmarkCampaign: CampaignBenchmarkComputation["benchmarkCampaign"];
    dataAsOfDate: string;
    warnings?: string[];
  },
): CampaignBenchmarkComputation {
  return {
    kind,
    message,
    mainCampaign: input.mainCampaign,
    benchmarkCampaign: input.benchmarkCampaign,
    dataAsOfDate: input.dataAsOfDate,
    warnings: input.warnings ?? [],
  };
}

export function computeCampaignBenchmark(
  input: ComputeCampaignBenchmarkInput,
): CampaignBenchmarkComputation {
  const campaigns = input.campaigns ?? getSeasonTicketCampaignConfigs();
  const dataAsOfKey = toCalendarDateKey(input.dataAsOfDate);
  const warnings: string[] = [];

  if (input.filters.season === "all") {
    return emptyComputation(
      "no_main_season",
      "Выберите сезон в фильтрах, чтобы сравнить кампании продаж абонементов.",
      {
        mainCampaign: null,
        benchmarkCampaign: null,
        dataAsOfDate: dataAsOfKey,
      },
    );
  }

  const mainConfig = campaigns.find(
    (campaign) => campaign.seasonId === input.filters.season,
  );
  if (!mainConfig) {
    return emptyComputation(
      "no_main_season",
      "Для выбранного сезона нет кампании продаж абонементов.",
      {
        mainCampaign: null,
        benchmarkCampaign: null,
        dataAsOfDate: dataAsOfKey,
      },
    );
  }

  const mainCampaign = withCampaignStatus(mainConfig, input.dataAsOfDate);
  const mainAvailableDays = getCampaignAvailableDays(
    mainCampaign,
    input.dataAsOfDate,
  );

  if (mainAvailableDays < 1 || mainCampaign.status === "upcoming") {
    return emptyComputation(
      "campaign_not_started",
      "Кампания ещё не началась",
      {
        mainCampaign,
        benchmarkCampaign: null,
        dataAsOfDate: dataAsOfKey,
      },
    );
  }

  const benchmarkConfig = resolveBenchmarkCampaignConfig(
    mainCampaign.seasonId,
    input.benchmarkSeasonId,
    campaigns,
  );
  if (!benchmarkConfig) {
    return emptyComputation(
      "no_comparison_season",
      "Нет другого сезона для сравнения.",
      {
        mainCampaign,
        benchmarkCampaign: null,
        dataAsOfDate: dataAsOfKey,
      },
    );
  }

  const benchmarkCampaign = withCampaignStatus(
    benchmarkConfig,
    input.dataAsOfDate,
  );

  const benchmarkRawAvailableDays = getCampaignAvailableDays(
    benchmarkCampaign,
    input.dataAsOfDate,
  );

  if (benchmarkRawAvailableDays < 1 || benchmarkCampaign.status === "upcoming") {
    return emptyComputation(
      "insufficient_benchmark",
      `Кампания сезона ${benchmarkCampaign.seasonName} ещё не началась`,
      {
        mainCampaign,
        benchmarkCampaign,
        dataAsOfDate: dataAsOfKey,
      },
    );
  }

  const attributeFilters: SubscriptionCampaignAttributeFilters = {
    league: input.filters.league,
    tournamentStage: input.filters.tournamentStage,
    arena: input.filters.arena,
    ticketType: input.filters.ticketType,
  };

  const mainChartDays = mainAvailableDays;
  const benchmarkChartDays = Math.min(
    benchmarkRawAvailableDays,
    mainAvailableDays,
  );
  const commonComparisonDays = Math.min(mainChartDays, benchmarkChartDays);

  if (benchmarkRawAvailableDays < mainAvailableDays) {
    warnings.push(
      buildShortBenchmarkWarning(
        benchmarkCampaign.seasonName,
        benchmarkRawAvailableDays,
        mainAvailableDays,
      ),
    );
  }

  const mainSubs = filterCampaignSubscriptions(
    input.subscriptions,
    mainCampaign,
    attributeFilters,
    mainChartDays,
  );
  const benchmarkSubs = filterCampaignSubscriptions(
    input.subscriptions,
    benchmarkCampaign,
    attributeFilters,
    benchmarkChartDays,
  );

  const mainValid = mainSubs.filter(isValidSoldSubscription);
  const benchmarkValid = benchmarkSubs.filter(isValidSoldSubscription);

  if (mainValid.length === 0 && benchmarkValid.length === 0) {
    return emptyComputation(
      "no_operations",
      "Нет продаж абонементов по выбранным фильтрам за период кампании.",
      {
        mainCampaign,
        benchmarkCampaign,
        dataAsOfDate: dataAsOfKey,
        warnings,
      },
    );
  }

  const mainSeries = toCumulativeSeries(
    aggregateDailySales(mainSubs, mainCampaign.startDate, mainChartDays),
  );
  const benchmarkSeries = toCumulativeSeries(
    aggregateDailySales(
      benchmarkSubs,
      benchmarkCampaign.startDate,
      benchmarkChartDays,
    ),
  );

  const points = alignCampaignSeries({
    mainCampaignStart: mainCampaign.startDate,
    benchmarkCampaignStart: benchmarkCampaign.startDate,
    mainSeries,
    benchmarkSeries,
    mainChartDays,
    benchmarkChartDays,
  });

  const latestCommon = points[commonComparisonDays - 1];
  const latestCountGap = {
    absolute: latestCommon?.countAbsoluteGap ?? null,
    percentage: latestCommon?.countPercentageGap ?? null,
  };
  const latestRevenueGap = {
    absolute: latestCommon?.revenueAbsoluteGap ?? null,
    percentage: latestCommon?.revenuePercentageGap ?? null,
  };

  if (
    latestCountGap.percentage == null ||
    latestRevenueGap.percentage == null
  ) {
    warnings.push("Нет базы для сравнения");
  }

  return {
    kind: "ok",
    mainCampaign,
    benchmarkCampaign,
    dataAsOfDate: dataAsOfKey,
    commonComparisonDays,
    mainAvailableDays: mainChartDays,
    benchmarkAvailableDays: benchmarkChartDays,
    benchmarkRawAvailableDays,
    points,
    countPoints: toCountPoints(points),
    revenuePoints: toRevenuePoints(points),
    latestCountGap,
    latestRevenueGap,
    warnings,
    dateRangeIgnored: false,
  };
}

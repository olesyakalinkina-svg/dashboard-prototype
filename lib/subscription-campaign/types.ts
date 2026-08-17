import type { SeasonTicketCampaign } from "@/types/dashboard";

export type CampaignCountPoint = {
  campaignDay: number;
  currentSeasonDate: string | null;
  benchmarkSeasonDate: string | null;
  currentSeasonCount: number | null;
  benchmarkSeasonCount: number | null;
  absoluteGap: number | null;
  percentageGap: number | null;
};

export type CampaignRevenuePoint = {
  campaignDay: number;
  currentSeasonDate: string | null;
  benchmarkSeasonDate: string | null;
  currentSeasonRevenue: number | null;
  benchmarkSeasonRevenue: number | null;
  absoluteGap: number | null;
  percentageGap: number | null;
};

export type CampaignPacePoint = {
  campaignDay: number;
  currentSeasonDate: string | null;
  benchmarkSeasonDate: string | null;
  currentSeasonCount: number | null;
  benchmarkSeasonCount: number | null;
  currentSeasonRevenue: number | null;
  benchmarkSeasonRevenue: number | null;
  countAbsoluteGap: number | null;
  countPercentageGap: number | null;
  revenueAbsoluteGap: number | null;
  revenuePercentageGap: number | null;
};

export type CampaignDailyTotals = {
  campaignDay: number;
  dateKey: string;
  count: number;
  revenue: number;
};

export type CampaignCumulativePoint = {
  campaignDay: number;
  dateKey: string;
  count: number;
  revenue: number;
};

export type CampaignBenchmarkWarning =
  | "short_benchmark"
  | "zero_base"
  | "stale_data"
  | "date_range_ignored";

export type CampaignBenchmarkStateKind =
  | "ok"
  | "campaign_not_started"
  | "no_main_season"
  | "no_comparison_season"
  | "no_operations"
  | "insufficient_benchmark";

export type CampaignBenchmarkResult = {
  kind: "ok";
  mainCampaign: SeasonTicketCampaign;
  benchmarkCampaign: SeasonTicketCampaign;
  dataAsOfDate: string;
  commonComparisonDays: number;
  mainAvailableDays: number;
  benchmarkAvailableDays: number;
  benchmarkRawAvailableDays: number;
  points: CampaignPacePoint[];
  countPoints: CampaignCountPoint[];
  revenuePoints: CampaignRevenuePoint[];
  latestCountGap: { absolute: number | null; percentage: number | null };
  latestRevenueGap: { absolute: number | null; percentage: number | null };
  warnings: string[];
  dateRangeIgnored: boolean;
};

export type CampaignBenchmarkComputation =
  | CampaignBenchmarkResult
  | {
      kind: Exclude<CampaignBenchmarkStateKind, "ok">;
      message: string;
      mainCampaign: SeasonTicketCampaign | null;
      benchmarkCampaign: SeasonTicketCampaign | null;
      dataAsOfDate: string;
      warnings: string[];
    };

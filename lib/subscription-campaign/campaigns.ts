import type {
  SeasonTicketCampaign,
  SeasonTicketCampaignStatus,
} from "@/types/dashboard";
import {
  getCampaignElapsedDays,
  getCampaignLengthDays,
  parseCalendarDate,
} from "@/lib/subscription-campaign/dates";

export type SeasonTicketCampaignConfig = Omit<SeasonTicketCampaign, "status">;

/**
 * Subscription sales campaigns by season. Dates are explicit sales windows,
 * not inferred from first purchase or hockey-season start. Status is computed
 * from dataAsOfDate (MOCK_TODAY ≈ 25.03.2026).
 *
 * 2024/25 and 2025/26: completed Aug–Sep windows with different calendar starts.
 * 2026/27: spring pre-sale starting 01.04.2026 — still upcoming at mock today.
 */
export const SEASON_TICKET_CAMPAIGN_CONFIGS: readonly SeasonTicketCampaignConfig[] =
  [
    {
      id: "campaign-2024-25",
      seasonId: "2024/25",
      seasonName: "2024/25",
      startDate: "2024-08-20",
      endDate: "2024-09-15",
    },
    {
      id: "campaign-2025-26",
      seasonId: "2025/26",
      seasonName: "2025/26",
      startDate: "2025-08-25",
      endDate: "2025-09-15",
    },
    {
      id: "campaign-2026-27",
      seasonId: "2026/27",
      seasonName: "2026/27",
      startDate: "2026-04-01",
      endDate: "2026-06-15",
    },
  ];

export function getSeasonTicketCampaignConfigs(): readonly SeasonTicketCampaignConfig[] {
  return SEASON_TICKET_CAMPAIGN_CONFIGS;
}

export function getCampaignStatus(
  campaign: Pick<SeasonTicketCampaignConfig, "startDate" | "endDate">,
  dataAsOfDate: Date,
): SeasonTicketCampaignStatus {
  const asOf = parseCalendarDate(dataAsOfDate);
  const start = parseCalendarDate(campaign.startDate);
  if (asOf < start) return "upcoming";
  if (!campaign.endDate) return "active";
  const end = parseCalendarDate(campaign.endDate);
  if (asOf > end) return "completed";
  return "active";
}

export function withCampaignStatus(
  config: SeasonTicketCampaignConfig,
  dataAsOfDate: Date,
): SeasonTicketCampaign {
  return {
    ...config,
    status: getCampaignStatus(config, dataAsOfDate),
  };
}

export function listSeasonTicketCampaigns(
  dataAsOfDate: Date,
): SeasonTicketCampaign[] {
  return SEASON_TICKET_CAMPAIGN_CONFIGS.map((config) =>
    withCampaignStatus(config, dataAsOfDate),
  );
}

export function findCampaignConfig(
  seasonId: string,
  campaigns: readonly SeasonTicketCampaignConfig[] = SEASON_TICKET_CAMPAIGN_CONFIGS,
): SeasonTicketCampaignConfig | null {
  return campaigns.find((campaign) => campaign.seasonId === seasonId) ?? null;
}

export function findCampaign(
  seasonId: string,
  dataAsOfDate: Date,
  campaigns: readonly SeasonTicketCampaignConfig[] = SEASON_TICKET_CAMPAIGN_CONFIGS,
): SeasonTicketCampaign | null {
  const config = findCampaignConfig(seasonId, campaigns);
  return config ? withCampaignStatus(config, dataAsOfDate) : null;
}

function sortCampaignsByStart(
  campaigns: readonly SeasonTicketCampaignConfig[],
): SeasonTicketCampaignConfig[] {
  return [...campaigns].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
}

/** Chronologically previous campaign; does not depend on season name literals. */
export function getPreviousCampaignConfig(
  seasonId: string,
  campaigns: readonly SeasonTicketCampaignConfig[] = SEASON_TICKET_CAMPAIGN_CONFIGS,
): SeasonTicketCampaignConfig | null {
  const sorted = sortCampaignsByStart(campaigns);
  const index = sorted.findIndex((campaign) => campaign.seasonId === seasonId);
  if (index <= 0) return null;
  return sorted[index - 1];
}

/** Active season: can be the main campaign, never a «Сравнить с» option. */
const EXCLUDED_COMPARE_SEASON_ID = "2026/27";

/** Other campaigns the selector may use; never includes the main or 2026/27 season. */
export function listComparableCampaignConfigs(
  mainSeasonId: string,
  campaigns: readonly SeasonTicketCampaignConfig[] = SEASON_TICKET_CAMPAIGN_CONFIGS,
): SeasonTicketCampaignConfig[] {
  return sortCampaignsByStart(campaigns).filter(
    (campaign) =>
      campaign.seasonId !== mainSeasonId &&
      campaign.seasonId !== EXCLUDED_COMPARE_SEASON_ID,
  );
}

/**
 * Default comparison season: immediately previous by start date.
 * If the main campaign is the oldest, fall back to the next available one.
 */
export function getDefaultBenchmarkCampaignConfig(
  mainSeasonId: string,
  campaigns: readonly SeasonTicketCampaignConfig[] = SEASON_TICKET_CAMPAIGN_CONFIGS,
): SeasonTicketCampaignConfig | null {
  const comparable = listComparableCampaignConfigs(mainSeasonId, campaigns);
  const previous = getPreviousCampaignConfig(mainSeasonId, campaigns);
  if (previous && comparable.some((campaign) => campaign.seasonId === previous.seasonId)) {
    return previous;
  }
  return comparable[0] ?? null;
}

/**
 * Honours an explicit selector value when it is a comparable campaign.
 * Same-season, 2026/27, and unknown ids fall back to the previous-season default.
 */
export function resolveBenchmarkCampaignConfig(
  mainSeasonId: string,
  requestedSeasonId: string | null | undefined,
  campaigns: readonly SeasonTicketCampaignConfig[] = SEASON_TICKET_CAMPAIGN_CONFIGS,
): SeasonTicketCampaignConfig | null {
  if (requestedSeasonId && requestedSeasonId !== mainSeasonId) {
    const requested = listComparableCampaignConfigs(mainSeasonId, campaigns).find(
      (campaign) => campaign.seasonId === requestedSeasonId,
    );
    if (requested) return requested;
  }
  return getDefaultBenchmarkCampaignConfig(mainSeasonId, campaigns);
}

/**
 * Inclusive campaign days available as of dataAsOfDate.
 * Upcoming campaigns return 0. Does not extend past today or past endDate.
 */
export function getCampaignAvailableDays(
  campaign: Pick<SeasonTicketCampaignConfig, "startDate" | "endDate">,
  dataAsOfDate: Date,
): number {
  const elapsed = getCampaignElapsedDays(dataAsOfDate, campaign.startDate);
  if (elapsed < 1) return 0;

  const length = getCampaignLengthDays(campaign.startDate, campaign.endDate);
  if (length == null) return elapsed;
  return Math.min(elapsed, length);
}

export function buildShortBenchmarkWarning(
  benchmarkSeasonName: string,
  benchmarkAvailableDays: number,
  comparedDays: number,
): string {
  return `В сезоне ${benchmarkSeasonName} доступны данные только за ${benchmarkAvailableDays} из ${comparedDays} сравниваемых дней.`;
}

import { format, isAfter, isBefore, parseISO, startOfDay, subDays } from "date-fns";
import {
  PREV_SEASON_END,
  PREV_SEASON_START,
  MOCK_TODAY,
  SEASON_END,
  SEASON_START,
} from "@/lib/mock/hockey";
import { getPlayoffWindowStart } from "@/lib/mock/hockey-generator";
import type { MerchOrderDateRange, TournamentStage } from "@/types/dashboard";

const SEASON_DATE_BOUNDS: Record<string, { min: Date; max: Date }> = {
  "2024/25": { min: PREV_SEASON_START, max: PREV_SEASON_END },
  "2025/26": { min: SEASON_START, max: SEASON_END },
};

/** Min/max calendar dates for the selected season filter value. */
export function getSeasonDateBounds(season: string): { min: Date; max: Date } {
  if (season === "all") {
    return { min: PREV_SEASON_START, max: SEASON_END };
  }

  const bounds = SEASON_DATE_BOUNDS[season];
  if (bounds) return bounds;

  return { min: PREV_SEASON_START, max: SEASON_END };
}

/** Calendar bounds for purchase-date filters (capped at mock today). */
export function getPurchaseDateBounds(season: string): { min: Date; max: Date } {
  const bounds = getSeasonDateBounds(season);
  const max = bounds.max > MOCK_TODAY ? MOCK_TODAY : bounds.max;
  return { min: bounds.min, max };
}

function toIsoDate(date: Date): string {
  return format(startOfDay(date), "yyyy-MM-dd");
}

function clampIsoToBounds(
  iso: string | null,
  min: Date,
  max: Date,
): string | null {
  if (!iso) return null;
  const date = startOfDay(parseISO(iso));
  if (isBefore(date, min)) return toIsoDate(min);
  if (isAfter(date, max)) return toIsoDate(max);
  return iso;
}

/** Calendar bounds for a tournament stage within a season. */
export function getTournamentStageDateBounds(
  season: string,
  stage: TournamentStage,
): { min: Date; max: Date } | null {
  const seasonBounds = SEASON_DATE_BOUNDS[season];
  if (!seasonBounds) return null;

  const seasonStart = startOfDay(seasonBounds.min);
  const seasonEnd = startOfDay(seasonBounds.max);
  const playoffStart = getPlayoffWindowStart(seasonEnd);

  if (stage === "playoff") {
    return { min: playoffStart, max: seasonEnd };
  }

  const regularEnd =
    playoffStart > seasonStart ? subDays(playoffStart, 1) : seasonEnd;

  return { min: seasonStart, max: regularEnd };
}

/** Whether a calendar date falls within the selected tournament stage. */
export function isDateInTournamentStage(
  date: Date,
  season: string | "all",
  stage: TournamentStage | "all",
): boolean {
  if (stage === "all") return true;

  const day = startOfDay(date);
  const seasonsToCheck =
    season === "all" ? Object.keys(SEASON_DATE_BOUNDS) : [season];

  return seasonsToCheck.some((seasonKey) => {
    const bounds = getTournamentStageDateBounds(seasonKey, stage);
    if (!bounds) return false;
    return day >= startOfDay(bounds.min) && day <= startOfDay(bounds.max);
  });
}

/** Whether a transaction date falls within an order/transaction date range. */
export function passesOrderDateRange(
  date: Date,
  range: MerchOrderDateRange,
): boolean {
  const { from, to } = range;
  if (!from && !to) return true;

  const day = format(startOfDay(date), "yyyy-MM-dd");
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Clamp an order/transaction date range to season calendar bounds. */
export function clampDateRangeToBounds(
  range: MerchOrderDateRange,
  bounds: { min: Date; max: Date },
): MerchOrderDateRange {
  const min = startOfDay(bounds.min);
  const max = startOfDay(bounds.max);
  let from = clampIsoToBounds(range.from, min, max);
  let to = clampIsoToBounds(range.to, min, max);

  if (from && to && from > to) {
    to = from;
  }

  return { from, to };
}

import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

const KHL_MATCH_COUNT = 34;

export const PREV_SEASON_START = new Date(2024, 8, 1);
export const PREV_SEASON_END = new Date(2025, 4, 31);
export const SEASON_START = new Date(2025, 8, 1);
export const SEASON_END = new Date(2026, 4, 31);
export const MOCK_TODAY = new Date(2026, 2, 25);
export const SUBSCRIPTIONS_PERIOD_START = new Date(2025, 7, 25);
export const SUBSCRIPTIONS_PERIOD_END = new Date(2025, 8, 15);

function getMatchDate(
  index: number,
  matchCount: number,
  seasonStart: Date,
  seasonEnd: Date,
): Date {
  const seasonSpanDays = differenceInCalendarDays(seasonEnd, seasonStart);
  if (matchCount <= 1) return startOfDay(seasonStart);
  const offset = Math.round((index / (matchCount - 1)) * seasonSpanDays);
  return startOfDay(addDays(seasonStart, offset));
}

function getCurrentSeasonMatchDate(index: number): Date {
  return getMatchDate(index, KHL_MATCH_COUNT, SEASON_START, SEASON_END);
}

export function getPromotionMatchDate(index: number): Date {
  return getCurrentSeasonMatchDate(index);
}

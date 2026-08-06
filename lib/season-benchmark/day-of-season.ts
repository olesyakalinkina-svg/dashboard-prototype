import { differenceInCalendarDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/season-benchmark/parse-local-date";

/** Day 1 = season start date. */
export function getElapsedSeasonDays(
  seasonStartDate: string,
  dataAsOfDate: Date,
): number {
  const start = parseLocalDate(seasonStartDate);
  const asOf = startOfDay(dataAsOfDate);
  return differenceInCalendarDays(asOf, start) + 1;
}

export function getDayOfSeasonForDate(
  seasonStartDate: string,
  date: Date,
): number {
  const start = parseLocalDate(seasonStartDate);
  const day = startOfDay(date);
  return differenceInCalendarDays(day, start) + 1;
}

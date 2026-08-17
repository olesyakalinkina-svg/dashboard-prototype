import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { MOCK_TODAY } from "@/lib/mock/constants";

const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dashboard as-of date: mock store clock, never `new Date()` in the browser. */
export function getDataAsOfDate(): Date {
  return startOfDay(MOCK_TODAY);
}

export function toCalendarDateKey(date: Date): string {
  const day = startOfDay(date);
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

export function parseCalendarDate(value: string | Date): Date {
  if (value instanceof Date) {
    return startOfDay(value);
  }

  const match = CALENDAR_DATE_RE.exec(value);
  if (!match) {
    return startOfDay(new Date(value));
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

export function addCalendarDays(start: string | Date, amount: number): Date {
  return addDays(parseCalendarDate(start), amount);
}

/** Day 1 is the campaign start date. */
export function getCampaignDayNumber(
  date: string | Date,
  campaignStart: string | Date,
): number {
  return (
    differenceInCalendarDays(
      parseCalendarDate(date),
      parseCalendarDate(campaignStart),
    ) + 1
  );
}

export function getCampaignElapsedDays(
  dataAsOfDate: string | Date,
  campaignStart: string | Date,
): number {
  return getCampaignDayNumber(dataAsOfDate, campaignStart);
}

export function getCampaignLengthDays(
  startDate: string,
  endDate: string | null,
): number | null {
  if (!endDate) return null;
  return getCampaignDayNumber(endDate, startDate);
}

export function getPointDate(
  campaignStart: string,
  campaignDay: number,
): Date {
  return addCalendarDays(campaignStart, campaignDay - 1);
}

export function isSameCalendarDay(
  left: string | Date,
  right: string | Date,
): boolean {
  return toCalendarDateKey(parseCalendarDate(left)) ===
    toCalendarDateKey(parseCalendarDate(right));
}

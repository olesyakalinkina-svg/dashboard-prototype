import { startOfDay } from "date-fns";

/** Parse yyyy-MM-dd as a local calendar date (no UTC day-shift). */
export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

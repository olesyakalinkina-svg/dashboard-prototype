import { startOfDay } from "date-fns";
import { MOCK_TODAY } from "@/lib/mock/constants";

/** Dashboard data ceiling — not the browser clock. */
export function getDataAsOfDate(): Date {
  return startOfDay(MOCK_TODAY);
}

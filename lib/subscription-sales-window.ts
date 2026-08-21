import { endOfDay, startOfDay, subYears } from "date-fns";
import type { Subscription, SubscriptionFilters } from "@/types/dashboard";
import {
  SUBSCRIPTIONS_PERIOD_END,
  SUBSCRIPTIONS_PERIOD_START,
} from "@/lib/mock/constants";
import { getMatches } from "@/lib/mock/data-store";
import {
  getFirstPlayoffMatchDate,
  getPlayoffSubscriptionSalesWindow,
} from "@/lib/mock/hockey-generator";

export type SubscriptionDateRange = { start: Date; end: Date };

const CURRENT_SEASON = "2025/26";

export type SubscriptionSalesWindowFilters = Pick<
  SubscriptionFilters,
  "season" | "tournamentStage"
>;

function regularSalesWindowOffsetYears(season?: string): number {
  if (!season || season === "all") return 0;
  const currentYear = Number.parseInt(CURRENT_SEASON.slice(0, 4), 10);
  const seasonYear = Number.parseInt(season.slice(0, 4), 10);
  if (!Number.isFinite(currentYear) || !Number.isFinite(seasonYear)) return 0;
  return Math.max(0, currentYear - seasonYear);
}

export function getRegularSubscriptionPeriod(
  season?: string,
): SubscriptionDateRange {
  const yearsBack = regularSalesWindowOffsetYears(season);
  return {
    start: startOfDay(subYears(SUBSCRIPTIONS_PERIOD_START, yearsBack)),
    end: endOfDay(subYears(SUBSCRIPTIONS_PERIOD_END, yearsBack)),
  };
}

export function getPlayoffSubscriptionPeriod(
  season: string,
): SubscriptionDateRange | null {
  const firstPlayoffMatch = getFirstPlayoffMatchDate(getMatches(), season);
  if (!firstPlayoffMatch) return null;

  const window = getPlayoffSubscriptionSalesWindow(firstPlayoffMatch);
  return {
    start: startOfDay(window.start),
    end: endOfDay(window.end),
  };
}

function isDateInSubscriptionPeriod(
  date: Date,
  range: SubscriptionDateRange,
): boolean {
  return date >= range.start && date <= range.end;
}

/** Same purchase-date window as `filterSubscriptions` / sold KPI 4500. */
export function subscriptionMatchesSalesWindow(
  sub: Subscription,
  subscriptionFilters?: Partial<SubscriptionSalesWindowFilters>,
): boolean {
  if (subscriptionFilters?.tournamentStage === "playoff") {
    const season =
      subscriptionFilters.season !== "all"
        ? subscriptionFilters.season
        : sub.season;
    if (!season) return false;
    const playoffPeriod = getPlayoffSubscriptionPeriod(season);
    if (!playoffPeriod) return false;
    return isDateInSubscriptionPeriod(sub.purchasedAt, playoffPeriod);
  }

  if (subscriptionFilters?.tournamentStage === "regular") {
    return isDateInSubscriptionPeriod(
      sub.purchasedAt,
      getRegularSubscriptionPeriod(
        subscriptionFilters.season !== "all"
          ? subscriptionFilters.season
          : sub.season,
      ),
    );
  }

  if (sub.tournamentStage === "playoff") {
    const playoffPeriod = getPlayoffSubscriptionPeriod(sub.season);
    if (!playoffPeriod) return false;
    return isDateInSubscriptionPeriod(sub.purchasedAt, playoffPeriod);
  }

  return isDateInSubscriptionPeriod(
    sub.purchasedAt,
    getRegularSubscriptionPeriod(sub.season),
  );
}

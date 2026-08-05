import {
  differenceInCalendarDays,
  startOfDay,
  subDays,
} from "date-fns";

export const TICKET_SALES_WINDOW_MIN_DAYS = 10;
export const TICKET_SALES_WINDOW_MAX_DAYS = 16;

/** Nearest upcoming matches that may open ticket sales on the same calendar day. */
export const NEAREST_UPCOMING_MATCH_OVERLAP_COUNT = 3;

/** Completed matches per league/season that may share a ticket sales start date. */
export const COMPLETED_MATCH_OVERLAP_COUNT = 3;

export function getMatchTicketSalesWindowDays(match: {
  ticketSalesWindowDays?: number;
}): number {
  const days = match.ticketSalesWindowDays;
  if (
    days != null &&
    days >= TICKET_SALES_WINDOW_MIN_DAYS &&
    days <= TICKET_SALES_WINDOW_MAX_DAYS
  ) {
    return days;
  }
  return TICKET_SALES_WINDOW_MAX_DAYS;
}

export function getMatchTicketSalesStartDate(match: {
  date: Date;
  ticketSalesWindowDays?: number;
}): Date {
  return subDays(startOfDay(match.date), getMatchTicketSalesWindowDays(match));
}

function maxDate(dates: Date[]): Date {
  return dates.reduce((max, date) => (date > max ? date : max));
}

function minDate(dates: Date[]): Date {
  return dates.reduce((min, date) => (date < min ? date : min));
}

function clampWindowDays(days: number): number {
  return Math.min(
    TICKET_SALES_WINDOW_MAX_DAYS,
    Math.max(TICKET_SALES_WINDOW_MIN_DAYS, days),
  );
}

type AlignableMatch = {
  date: Date;
  eventCompleted: boolean;
  ticketSalesWindowDays: number;
};

/**
 * Aligns ticket sales windows for a group of upcoming matches so they can
 * start on the same calendar day (overlapping sales periods are allowed).
 */
function alignUpcomingMatchSalesWindowGroup(upcoming: AlignableMatch[]): void {
  if (upcoming.length < 2) return;

  const matchDays = upcoming.map((match) => startOfDay(match.date));

  const earliestAllowedStarts = matchDays.map((matchDay) =>
    subDays(matchDay, TICKET_SALES_WINDOW_MAX_DAYS),
  );
  const latestAllowedStarts = matchDays.map((matchDay) =>
    subDays(matchDay, TICKET_SALES_WINDOW_MIN_DAYS),
  );

  const sharedStartFloor = maxDate(earliestAllowedStarts);
  const sharedStartCeiling = minDate(latestAllowedStarts);

  if (sharedStartFloor > sharedStartCeiling) return;

  const naturalStarts = upcoming.map((match) =>
    getMatchTicketSalesStartDate(match),
  );
  let sharedStart = minDate(naturalStarts);
  if (sharedStart < sharedStartFloor) sharedStart = sharedStartFloor;
  if (sharedStart > sharedStartCeiling) sharedStart = sharedStartCeiling;

  for (const match of upcoming) {
    const matchDay = startOfDay(match.date);
    const windowDays = differenceInCalendarDays(matchDay, sharedStart);
    match.ticketSalesWindowDays = clampWindowDays(windowDays);
  }
}

/**
 * For each league separately, aligns ticket sales windows for the nearest
 * upcoming matches so they can start on the same calendar day (overlapping
 * sales periods are allowed).
 */
export function alignNearestUpcomingMatchSalesWindows(
  matches: Array<AlignableMatch & { league: string }>,
): void {
  const byLeague = new Map<string, AlignableMatch[]>();

  for (const match of matches) {
    const leagueMatches = byLeague.get(match.league);
    if (leagueMatches) {
      leagueMatches.push(match);
    } else {
      byLeague.set(match.league, [match]);
    }
  }

  for (const leagueMatches of byLeague.values()) {
    const upcoming = leagueMatches
      .filter((match) => !match.eventCompleted)
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(0, NEAREST_UPCOMING_MATCH_OVERLAP_COUNT);

    alignUpcomingMatchSalesWindowGroup(upcoming);
  }
}

export type CompletedSalesWindowAlignmentOptions = {
  league?: string;
  season?: string;
  count?: number;
};

/**
 * Aligns ticket sales windows for a cluster of completed matches in the same
 * league and season so they start on the same calendar day.
 */
export function alignCompletedMatchSalesWindows(
  matches: Array<AlignableMatch & { league: string; season: string }>,
  options: CompletedSalesWindowAlignmentOptions = {},
): void {
  const {
    league = "KHL",
    season = "2025/26",
    count = COMPLETED_MATCH_OVERLAP_COUNT,
  } = options;

  const completed = matches
    .filter(
      (match) =>
        match.eventCompleted &&
        match.league === league &&
        match.season === season,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (completed.length < 2) return;

  alignUpcomingMatchSalesWindowGroup(completed.slice(0, count));
}

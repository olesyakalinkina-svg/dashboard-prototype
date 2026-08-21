import { describe, expect, it } from "vitest";
import { startOfDay } from "date-fns";
import {
  analogPreviousSeasonDate,
  pairPreviousSeasonMatchesByLeagueOrder,
} from "@/lib/mock/hockey-generator";
import { getMatches, getTransactions } from "@/lib/mock/data-store";
import type { League, Match } from "@/types/dashboard";

function calendarDay(year: number, month: number, day: number): Date {
  return startOfDay(new Date(year, month - 1, day));
}

function stubMatch(
  id: string,
  season: string,
  league: League,
  date: Date,
  opponent = id,
): Match {
  return {
    id,
    date,
    opponent,
    attendance: 0,
    capacity: 12000,
    season,
    league,
    tournamentStage: "regular",
    matchClass: "class_1",
    arena: "main",
    eventCompleted: true,
    ticketSalesWindowDays: 12,
  };
}

describe("analogPreviousSeasonDate", () => {
  it("keeps month/day and shifts the year back one", () => {
    expect(analogPreviousSeasonDate(calendarDay(2025, 9, 18))).toEqual(
      calendarDay(2024, 9, 18),
    );
    expect(analogPreviousSeasonDate(calendarDay(2026, 1, 6))).toEqual(
      calendarDay(2025, 1, 6),
    );
    expect(analogPreviousSeasonDate(calendarDay(2026, 5, 31))).toEqual(
      calendarDay(2025, 5, 31),
    );
  });
});

describe("pairPreviousSeasonMatchesByLeagueOrder", () => {
  it("zips by league, stage, and season order when counts differ", () => {
    const matches = [
      stubMatch("c0", "2025/26", "KHL", calendarDay(2025, 9, 15)),
      stubMatch("c1", "2025/26", "KHL", calendarDay(2025, 9, 18)),
      stubMatch("c2", "2025/26", "KHL", calendarDay(2025, 10, 6)),
      stubMatch("cP", "2025/26", "KHL", calendarDay(2026, 3, 27), "Ак Барс"),
      stubMatch("p0", "2024/25", "KHL", calendarDay(2024, 9, 1)),
      stubMatch("p1", "2024/25", "KHL", calendarDay(2024, 10, 1)),
      stubMatch("pP", "2024/25", "KHL", calendarDay(2025, 5, 13), "Трактор"),
      stubMatch("v0", "2025/26", "VHL", calendarDay(2025, 9, 1)),
      stubMatch("v1", "2024/25", "VHL", calendarDay(2024, 9, 1)),
    ];
    matches.find((match) => match.id === "cP")!.matchClass = "playoff";
    matches.find((match) => match.id === "cP")!.tournamentStage = "playoff";
    matches.find((match) => match.id === "pP")!.matchClass = "playoff";
    matches.find((match) => match.id === "pP")!.tournamentStage = "playoff";

    const pairs = pairPreviousSeasonMatchesByLeagueOrder(matches);
    expect(
      pairs.map((pair) => [pair.prev.id, pair.current.id]),
    ).toEqual([
      ["p0", "c0"],
      ["p1", "c1"],
      ["pP", "cP"],
      ["v1", "v0"],
    ]);
  });
});

describe("hockey-mock 2024/25 analog calendar", () => {
  it("uses the same month/day as 2025/26 analogs, year shifted back", () => {
    const matches = getMatches();
    const currentKhlFirst = matches.find(
      (match) => match.id === "match-1",
    );
    expect(currentKhlFirst?.date.getFullYear()).toBe(2025);
    expect(currentKhlFirst?.date.getMonth()).toBe(8);
    expect(currentKhlFirst?.date.getDate()).toBe(15);

    for (const { prev, current } of pairPreviousSeasonMatchesByLeagueOrder(
      matches,
    )) {
      const analog = analogPreviousSeasonDate(current.date);
      expect(prev.date.getFullYear(), prev.id).toBe(analog.getFullYear());
      expect(prev.date.getMonth(), prev.id).toBe(analog.getMonth());
      expect(prev.date.getDate(), prev.id).toBe(analog.getDate());
    }
  });

  it("keeps ticket/merch txs for shifted 2024/25 matches on or before match day", () => {
    const matches = getMatches();
    const transactions = getTransactions();
    const prev = matches.filter((match) => match.season === "2024/25");
    const byMatch = new Map<string, Date>();
    for (const match of prev) {
      byMatch.set(match.id, startOfDay(match.date));
    }

    for (const tx of transactions) {
      if (!tx.matchId || tx.isReturn) continue;
      const matchDay = byMatch.get(tx.matchId);
      if (!matchDay) continue;
      expect(
        startOfDay(tx.date) <= matchDay,
        `${tx.id} after ${tx.matchId}`,
      ).toBe(true);
    }
  });

  it("has 36 KHL matches in both seasons (34 regular + 2 playoff)", () => {
    const matches = getMatches();
    const count = (season: string, league: League, playoff: boolean) =>
      matches.filter(
        (match) =>
          match.season === season &&
          match.league === league &&
          (match.matchClass === "playoff" ||
            match.tournamentStage === "playoff") === playoff,
      ).length;

    expect(count("2025/26", "KHL", false)).toBe(34);
    expect(count("2025/26", "KHL", true)).toBe(2);
    expect(count("2024/25", "KHL", false)).toBe(34);
    expect(count("2024/25", "KHL", true)).toBe(2);
    expect(count("2025/26", "VHL", false)).toBe(count("2024/25", "VHL", false));
    expect(count("2025/26", "VHL", true)).toBe(count("2024/25", "VHL", true));
    expect(count("2025/26", "MHL", false)).toBe(count("2024/25", "MHL", false));
    expect(count("2025/26", "MHL", true)).toBe(count("2024/25", "MHL", true));

    const khlPairs = pairPreviousSeasonMatchesByLeagueOrder(matches).filter(
      ({ current }) => current.league === "KHL",
    );
    expect(khlPairs).toHaveLength(36);
  });

  it("gives every 2024/25 KHL match ticket (and completed regular merch) txs", () => {
    const matches = getMatches();
    const transactions = getTransactions();
    const prevKhl = matches.filter(
      (match) => match.season === "2024/25" && match.league === "KHL",
    );
    expect(prevKhl).toHaveLength(36);

    for (const match of prevKhl) {
      const tickets = transactions.filter(
        (tx) => tx.stream === "tickets" && tx.matchId === match.id,
      );
      expect(tickets.length, `${match.id} tickets`).toBeGreaterThan(0);
      if (match.tournamentStage === "regular") {
        const merch = transactions.filter(
          (tx) => tx.stream === "merch" && tx.matchId === match.id,
        );
        expect(merch.length, `${match.id} merch`).toBeGreaterThan(0);
      }
    }
  });
});

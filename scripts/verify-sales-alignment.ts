import { addDays, format } from "date-fns";
import { generateMockData, MOCK_TODAY } from "../lib/mock/hockey-generator";
import {
  alignCompletedMatchSalesWindows,
  alignNearestUpcomingMatchSalesWindows,
  getMatchTicketSalesStartDate,
  getMatchTicketSalesWindowDays,
} from "../lib/ticket-sales-window";

const { matches, transactions } = generateMockData();

console.log("MOCK_TODAY:", format(MOCK_TODAY, "yyyy-MM-dd"));

for (const league of ["KHL", "VHL", "MHL"]) {
  const upcoming = matches
    .filter((m) => m.league === league && !m.eventCompleted)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log(`\n${league} upcoming (${upcoming.length}):`);
  for (const m of upcoming) {
    const start = getMatchTicketSalesStartDate(m);
    console.log(
      `  ${m.opponent} ${format(m.date, "yyyy-MM-dd")} window=${getMatchTicketSalesWindowDays(m)} start=${format(start, "yyyy-MM-dd")}`,
    );
  }

  const nearest = upcoming.slice(0, 3);
  const starts = nearest.map((m) =>
    format(getMatchTicketSalesStartDate(m), "yyyy-MM-dd"),
  );
  if (nearest.length >= 2) {
    const aligned = new Set(starts).size === 1;
    console.log(
      `  Nearest ${nearest.length} same-day start: ${aligned ? "YES" : "NO"} (${starts.join(", ")})`,
    );
  }
}

const khlCompletedCurrent = matches
  .filter(
    (m) =>
      m.league === "KHL" && m.season === "2025/26" && m.eventCompleted,
  )
  .sort((a, b) => a.date.getTime() - b.date.getTime())
  .slice(0, 3);

console.log("\nKHL 2025/26 completed cluster (first 3):");
for (const m of khlCompletedCurrent) {
  const start = getMatchTicketSalesStartDate(m);
  const factSales = transactions.filter(
    (tx) =>
      tx.stream === "tickets" && tx.matchId === m.id && (tx.amount ?? 0) > 0,
  ).length;
  console.log(
    `  ${m.opponent} ${format(m.date, "yyyy-MM-dd")} window=${getMatchTicketSalesWindowDays(m)} start=${format(start, "yyyy-MM-dd")} factTxs=${factSales}`,
  );
}

if (khlCompletedCurrent.length >= 3) {
  const completedStarts = khlCompletedCurrent.map((m) =>
    format(getMatchTicketSalesStartDate(m), "yyyy-MM-dd"),
  );
  const completedAligned = new Set(completedStarts).size === 1;
  const allHaveFactSales = khlCompletedCurrent.every((m) =>
    transactions.some(
      (tx) =>
        tx.stream === "tickets" && tx.matchId === m.id && (tx.amount ?? 0) > 0,
    ),
  );
  console.log(
    `  Completed cluster same-day start: ${completedAligned ? "YES" : "NO"} (${completedStarts.join(", ")})`,
  );
  console.log(`  All have fact ticket sales: ${allHaveFactSales ? "YES" : "NO"}`);
  if (!completedAligned || !allHaveFactSales) {
    process.exitCode = 1;
  }
}

// Also show last 5 KHL matches regardless of completion
const khlCurrent = matches
  .filter((m) => m.league === "KHL" && m.season === "2025/26")
  .sort((a, b) => a.date.getTime() - b.date.getTime())
  .slice(-5);
console.log("\nKHL 2025/26 last 5 matches:");
for (const m of khlCurrent) {
  const start = getMatchTicketSalesStartDate(m);
  console.log(
    `  ${m.opponent} ${format(m.date, "yyyy-MM-dd")} completed=${m.eventCompleted} window=${getMatchTicketSalesWindowDays(m)} start=${format(start, "yyyy-MM-dd")}`,
  );
}

// Synthetic smoke test: per-league alignment for 3 upcoming matches
type TestMatch = {
  date: Date;
  eventCompleted: boolean;
  ticketSalesWindowDays: number;
  league: string;
  season: string;
};

function runSyntheticAlignmentTest() {
  const base = new Date(2026, 5, 1);
  const makeMatch = (offset: number, league: string): TestMatch => ({
    date: addDays(base, offset * 7),
    eventCompleted: false,
    ticketSalesWindowDays: 14,
    league,
    season: "2025/26",
  });

  for (const league of ["KHL", "VHL"]) {
    const group = [makeMatch(0, league), makeMatch(1, league), makeMatch(2, league)];
    // Matches 3 days apart — within alignable range for 10–16 day sales windows.
    group.forEach((match, index) => {
      match.date = addDays(base, index * 3);
    });
    alignNearestUpcomingMatchSalesWindows(group);
    const starts = group.map((m) => format(getMatchTicketSalesStartDate(m), "yyyy-MM-dd"));
    const aligned = new Set(starts).size === 1;
    console.log(`\nSynthetic ${league} upcoming (3 matches): same-day start = ${aligned ? "YES" : "NO"} (${starts.join(", ")})`);
    if (!aligned) process.exitCode = 1;
  }

  const completedGroup: TestMatch[] = [
    {
      date: addDays(base, 0),
      eventCompleted: true,
      ticketSalesWindowDays: 14,
      league: "KHL",
      season: "2025/26",
    },
    {
      date: addDays(base, 2),
      eventCompleted: true,
      ticketSalesWindowDays: 12,
      league: "KHL",
      season: "2025/26",
    },
    {
      date: addDays(base, 4),
      eventCompleted: true,
      ticketSalesWindowDays: 11,
      league: "KHL",
      season: "2025/26",
    },
  ];
  alignCompletedMatchSalesWindows(completedGroup);
  const completedStarts = completedGroup.map((m) =>
    format(getMatchTicketSalesStartDate(m), "yyyy-MM-dd"),
  );
  const completedAligned = new Set(completedStarts).size === 1;
  console.log(
    `\nSynthetic KHL completed (3 matches): same-day start = ${completedAligned ? "YES" : "NO"} (${completedStarts.join(", ")})`,
  );
  if (!completedAligned) process.exitCode = 1;
}

runSyntheticAlignmentTest();

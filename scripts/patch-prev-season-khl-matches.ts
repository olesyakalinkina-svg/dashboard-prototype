/**
 * Adds missing 2024/25 KHL regular home games so the previous season also
 * has 36 matches (34 regular + 2 playoff), matching 2025/26. New rows clone
 * ticket/merch txs from the unpaired 2025/26 analog, dates shifted −1 year.
 * Existing 2025/26 matches/txs and already-paired 2024/25 rows stay put.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import {
  analogPreviousSeasonDate,
  getBaseMatchClass,
  pairPreviousSeasonMatchesByLeagueOrder,
  PREV_SEASON_KHL_REGULAR_OPPONENTS,
} from "../lib/mock/hockey-generator";
import type { RawMockData } from "../lib/mock/revive-dates";
import type { Match, Transaction } from "../types/dashboard";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

function toLocalCalendarIso(date: Date): string {
  return format(date, "yyyy-MM-dd'T'12:00:00");
}

function txNumericId(id: string): number {
  const parsed = Number.parseInt(String(id).replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextMatchNumericId(matches: { id: string }[]): number {
  let max = 0;
  for (const match of matches) {
    const parsed = Number.parseInt(String(match.id).replace(/\D/g, ""), 10);
    if (parsed > max) max = parsed;
  }
  return max + 1;
}

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
const originalMatches = new Map(raw.matches.map((match) => [match.id, match]));

const revivedMatches = raw.matches.map((match) => ({
  ...match,
  date: new Date(match.date),
})) as unknown as Match[];
const pairedIds = new Set(
  pairPreviousSeasonMatchesByLeagueOrder(revivedMatches).map(
    ({ prev }) => prev.id,
  ),
);

const currentRegular = revivedMatches
  .filter(
    (match) =>
      match.season === "2025/26" &&
      match.league === "KHL" &&
      match.tournamentStage !== "playoff" &&
      match.matchClass !== "playoff",
  )
  .sort((left, right) => {
    const byDate = left.date.getTime() - right.date.getTime();
    if (byDate !== 0) return byDate;
    return left.id.localeCompare(right.id);
  });

const pairedCurrentIds = new Set(
  pairPreviousSeasonMatchesByLeagueOrder(revivedMatches)
    .filter(({ current }) => current.league === "KHL")
    .map(({ current }) => current.id),
);

const unpairedCurrent = currentRegular.filter(
  (match) => !pairedCurrentIds.has(match.id),
);

if (unpairedCurrent.length === 0) {
  console.log("2024/25 KHL already matches 2025/26 count; nothing to patch.");
  process.exit(0);
}

const existingPrevRegular = revivedMatches.filter(
  (match) =>
    match.season === "2024/25" &&
    match.league === "KHL" &&
    match.tournamentStage !== "playoff" &&
    match.matchClass !== "playoff",
).length;

const newOpponents = PREV_SEASON_KHL_REGULAR_OPPONENTS.slice(
  existingPrevRegular,
  existingPrevRegular + unpairedCurrent.length,
);

if (newOpponents.length !== unpairedCurrent.length) {
  throw new Error(
    `Need ${unpairedCurrent.length} extra 2024/25 opponents, got ${newOpponents.length}`,
  );
}

let nextMatchId = nextMatchNumericId(raw.matches);
let nextTxId = 0;
for (const tx of raw.transactions) {
  const numeric = txNumericId(tx.id);
  if (numeric > nextTxId) nextTxId = numeric;
}
nextTxId += 1;

const newMatches: RawMockData["matches"][number][] = [];
const newTxs: RawMockData["transactions"][number][] = [];
const analogTxsByMatch = new Map<string, RawMockData["transactions"][number][]>();
for (const tx of raw.transactions) {
  if (!tx.matchId) continue;
  const list = analogTxsByMatch.get(tx.matchId);
  if (list) list.push(tx);
  else analogTxsByMatch.set(tx.matchId, [tx]);
}

for (let index = 0; index < unpairedCurrent.length; index += 1) {
  const analog = unpairedCurrent[index]!;
  const opponent = newOpponents[index]!;
  const newDate = analogPreviousSeasonDate(analog.date);
  const matchId = `match-${nextMatchId++}`;
  const matchClass = getBaseMatchClass(opponent, "KHL");
  const analogRaw = raw.matches.find((match) => match.id === analog.id)!;

  newMatches.push({
    id: matchId,
    date: toLocalCalendarIso(newDate),
    opponent,
    attendance: analog.attendance,
    capacity: analog.capacity,
    eventCompleted: true,
    season: "2024/25",
    league: "KHL",
    tournamentStage: "regular",
    matchClass,
    series: analog.series,
    arena: analog.arena,
    ticketSalesWindowDays: analog.ticketSalesWindowDays,
    ticketPlanTickets: analogRaw.ticketPlanTickets,
    ticketPlanRevenue: analogRaw.ticketPlanRevenue,
    merchPlanRevenue: analogRaw.merchPlanRevenue,
  });

  const analogTxs = analogTxsByMatch.get(analog.id) ?? [];
  const delta = differenceInCalendarDays(
    startOfDay(newDate),
    startOfDay(analog.date),
  );
  const matchDay = startOfDay(newDate);

  for (const analogTx of analogTxs) {
    const shifted = addDays(new Date(analogTx.date), delta);
    const nextDate =
      !analogTx.isReturn && startOfDay(shifted) > matchDay
        ? new Date(
            matchDay.getTime() +
              (shifted.getTime() - startOfDay(shifted).getTime()),
          )
        : shifted;
    const cloned: Transaction = {
      ...(analogTx as unknown as Transaction),
      id: `tx-${nextTxId++}`,
      matchId,
      date: nextDate,
    };
    newTxs.push({
      ...cloned,
      date: cloned.date.toISOString(),
    } as RawMockData["transactions"][number]);
  }
}

const serialized: RawMockData = {
  ...raw,
  matches: [
    ...raw.matches.map((match) => originalMatches.get(match.id)!),
    ...newMatches,
  ],
  transactions: [...raw.transactions, ...newTxs],
};

writeFileSync(mockPath, JSON.stringify(serialized));
console.log(`Patched extra 2024/25 KHL matches in ${mockPath}`);
console.log(
  `  added matches=${newMatches.length} txs=${newTxs.length} (skipped paired=${pairedIds.size})`,
);
for (let index = 0; index < newMatches.length; index += 1) {
  const created = newMatches[index]!;
  const analog = unpairedCurrent[index]!;
  console.log(
    `  ${created.id} ${created.opponent} ${String(created.date).slice(0, 10)} ← ${analog.id} ${analog.opponent}`,
  );
}

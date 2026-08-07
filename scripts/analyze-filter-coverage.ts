/**
 * Analyzes mock data coverage for all filter select options.
 * Usage: npx tsx scripts/analyze-filter-coverage.ts
 */

import { getMatches, getSubscriptions, getTransactions } from "../lib/mock/hockey";
import { initMockDataSync } from "../lib/mock/data-store";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raw = JSON.parse(
  readFileSync(join(process.cwd(), "lib/mock/data/hockey-mock.json"), "utf-8"),
);
initMockDataSync(raw);

const matches = getMatches();
const transactions = getTransactions();
const subscriptions = getSubscriptions();
import {
  buildCriticalComboCases,
  buildMatchSalesFilterCases,
  buildMerchFilterCases,
  buildSubscriptionsFilterCases,
  buildTicketsFilterCases,
  getAllFilterCases,
} from "../lib/filter-coverage";

type CoverageRow = {
  filter: string;
  option: string;
  hasData: boolean;
  count: number;
  note: string;
};

function countUnique<T>(items: T[], getKey: (item: T) => string | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function toRows(tabLabel: string, cases: ReturnType<typeof buildTicketsFilterCases>): CoverageRow[] {
  return cases.map((testCase) => ({
    filter: testCase.filter,
    option: testCase.option,
    hasData: testCase.excluded ? false : testCase.hasData(),
    count: 0,
    note: testCase.excluded ?? (testCase.hasData() ? "есть данные" : "нет данных"),
  }));
}

function printSection(title: string, rows: CoverageRow[]) {
  console.log(`\n=== ${title} ===\n`);
  console.log("| Фильтр | Опции | Есть данные? | Примечание |");
  console.log("|--------|-------|--------------|------------|");
  for (const row of rows) {
    const has = row.hasData ? "Да" : "Нет";
    console.log(`| ${row.filter} | ${row.option} | ${has} | ${row.note} |`);
  }
  const gaps = rows.filter((r) => !r.hasData && !r.note.includes("Ожидаемо") && !r.note.includes("intentional"));
  if (gaps.length > 0) {
    console.log(`\nПробелы (${gaps.length}):`);
    for (const g of gaps) {
      console.log(`  - ${g.filter} / ${g.option}`);
    }
  } else {
    console.log("\nКритических пробелов не обнаружено.");
  }
}

console.log("Mock summary:");
console.log(`  Matches: ${matches.length}`);
console.log(`  Transactions: ${transactions.length} (tickets: ${transactions.filter((t) => t.stream === "tickets").length}, merch: ${transactions.filter((t) => t.stream === "merch").length})`);
console.log(`  Subscriptions: ${subscriptions.length}`);

const matchDims = {
  seasons: countUnique(matches, (m) => m.season),
  leagues: countUnique(matches, (m) => m.league),
  stages: countUnique(matches, (m) => m.tournamentStage),
  classes: countUnique(matches, (m) => m.matchClass),
  arenas: countUnique(matches, (m) => m.arena),
  completed: {
    yes: matches.filter((m) => m.eventCompleted).length,
    no: matches.filter((m) => !m.eventCompleted).length,
  },
};
console.log("\nRaw match dimensions:", Object.fromEntries(
  Object.entries(matchDims).map(([k, v]) => [k, v instanceof Map ? Object.fromEntries(v) : v]),
));

printSection("Билеты (Tickets)", toRows("tickets", buildTicketsFilterCases()));
printSection("Мерч (Merch)", toRows("merch", buildMerchFilterCases()));
printSection("Абонементы (Subscriptions)", toRows("subscriptions", buildSubscriptionsFilterCases()));
printSection("Продажи матчей (Match Sales)", toRows("matches", buildMatchSalesFilterCases()));

console.log("\n=== Критические комбинации ===\n");
for (const combo of buildCriticalComboCases()) {
  const ok = combo.excluded ? false : combo.check();
  const status = combo.excluded ? "SKIP" : ok ? "OK" : "GAP";
  const note = combo.excluded ? ` (${combo.excluded})` : "";
  console.log(`${status}: ${combo.name}${note}`);
}

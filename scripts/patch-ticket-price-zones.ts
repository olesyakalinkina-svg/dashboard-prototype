/**
 * Remap hockey-mock.json ticket priceZone fields onto the six remaining
 * buckets (500…3000). Dropped 3500/4000/4500 (and the old 4-zone catalog)
 * fold into 3000. Amounts/qty stay put so ticket KPIs do not reshuffle.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawMockData } from "../lib/mock/revive-dates";
import type { PriceZone } from "../types/dashboard";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

const FINAL_ZONES: PriceZone[] = [
  "up_to_500",
  "from_500_to_1000",
  "from_1000_to_1500",
  "from_1500_to_2000",
  "from_2000_to_2500",
  "from_2500_to_3000",
];

const TOP_ZONE: PriceZone = "from_2500_to_3000";

const REMAP: Record<string, PriceZone[]> = {
  up_to_1500: ["up_to_500", "from_500_to_1000", "from_1000_to_1500"],
  from_1500_to_2500: ["from_1500_to_2000", "from_2000_to_2500"],
  from_2500_to_4000: [TOP_ZONE],
  from_4000_to_6000: [TOP_ZONE],
  from_3000_to_3500: [TOP_ZONE],
  from_3500_to_4000: [TOP_ZONE],
  from_4000_to_4500: [TOP_ZONE],
  up_to_500: ["up_to_500"],
  from_500_to_1000: ["from_500_to_1000"],
  from_1000_to_1500: ["from_1000_to_1500"],
  from_1500_to_2000: ["from_1500_to_2000"],
  from_2000_to_2500: ["from_2000_to_2500"],
  from_2500_to_3000: [TOP_ZONE],
};

const counters = new Map<string, number>();

function nextZone(key: string, targets: PriceZone[]): PriceZone {
  const i = counters.get(key) ?? 0;
  counters.set(key, i + 1);
  return targets[i % targets.length]!;
}

const raw = JSON.parse(readFileSync(mockPath, "utf8")) as RawMockData;
const counts: Record<string, number> = {};
let remapped = 0;
let untouched = 0;

for (const tx of raw.transactions) {
  if (!tx.priceZone) continue;
  const old = String(tx.priceZone);
  if (tx.sector === "VIP") {
    if (old !== TOP_ZONE) remapped += 1;
    tx.priceZone = TOP_ZONE;
    counts[TOP_ZONE] = (counts[TOP_ZONE] ?? 0) + 1;
    continue;
  }
  const targets = REMAP[old];
  if (!targets) {
    tx.priceZone = TOP_ZONE;
    remapped += 1;
    counts[TOP_ZONE] = (counts[TOP_ZONE] ?? 0) + 1;
    continue;
  }
  const next = nextZone(old, targets);
  if (next !== old) remapped += 1;
  else untouched += 1;
  tx.priceZone = next;
  counts[next] = (counts[next] ?? 0) + 1;
}

writeFileSync(mockPath, JSON.stringify(raw));
console.log(`Patched ticket priceZone fields in ${mockPath}`);
console.log(`  remapped=${remapped} unchanged=${untouched}`);
for (const zone of FINAL_ZONES) {
  console.log(`  ${zone}: ${counts[zone] ?? 0}`);
}

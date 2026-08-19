/**
 * Scales 2025/26 and 2024/25 subscription sold counts in hockey-mock.json
 * without regenerating ticket/merch transactions. KHL stays 3500+1000;
 * VHL/MHL are regular-only. Previous season is cloned up toward current so
 * default YoY stays in +0.5%…+10%.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expandSeasonSubscriptionSoldTargets } from "../lib/mock/hockey-generator";
import { reviveMockData, type RawMockData } from "../lib/mock/revive-dates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
const revived = reviveMockData(raw);

expandSeasonSubscriptionSoldTargets(revived.subscriptions, revived.matches);

const serialized = {
  ...raw,
  subscriptions: revived.subscriptions.map((sub) => ({
    ...sub,
    purchasedAt: sub.purchasedAt.toISOString(),
    validTo: sub.validTo.toISOString(),
  })),
};

writeFileSync(mockPath, JSON.stringify(serialized));
console.log(
  `Patched subscription sold counts in ${mockPath} (${revived.subscriptions.length} total subs)`,
);

/**
 * Realigns 2024/25 subscription purchase dates in hockey-mock.json
 * without regenerating ticket/merch transactions.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { realignPreviousSeasonSubscriptionPurchases } from "../lib/mock/hockey-generator";
import { reviveMockData, type RawMockData } from "../lib/mock/revive-dates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
const revived = reviveMockData(raw);

realignPreviousSeasonSubscriptionPurchases(
  revived.subscriptions,
  revived.matches,
);

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
  `Patched 2024/25 subscriptions in ${mockPath} (${revived.subscriptions.length} total subs)`,
);

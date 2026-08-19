/**
 * Applies league × tariff catalog prices to hockey-mock.json subscriptions
 * without regenerating ticket/merch transactions. Clones keep matchesUsed=0.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyLeagueSubscriptionCatalogPrices } from "../lib/mock/subscription-catalog";
import type { RawMockData } from "../lib/mock/revive-dates";
import type { Subscription } from "../types/dashboard";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;

for (const sub of raw.subscriptions) {
  const revived = sub as unknown as Subscription;
  revived.purchasedAt = new Date(sub.purchasedAt);
  revived.validTo = new Date(sub.validTo);
}

applyLeagueSubscriptionCatalogPrices(
  raw.subscriptions as unknown as Subscription[],
);

for (const sub of raw.subscriptions) {
  const revived = sub as unknown as Subscription;
  (sub as { purchasedAt: string }).purchasedAt = revived.purchasedAt.toISOString();
  (sub as { validTo: string }).validTo = revived.validTo.toISOString();
}

writeFileSync(mockPath, JSON.stringify(raw));

const priceCounts = new Map<string, number>();
for (const sub of raw.subscriptions) {
  const key = `${sub.league}|${sub.planId}|${sub.price}`;
  priceCounts.set(key, (priceCounts.get(key) ?? 0) + 1);
}

console.log(
  `Patched subscription catalog prices in ${mockPath} (${raw.subscriptions.length} rows)`,
);
for (const [key, count] of [...priceCounts.entries()].sort()) {
  console.log(`  ${count} ${key}`);
}

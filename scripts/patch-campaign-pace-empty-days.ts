/**
 * Fills empty season-ticket campaign days in hockey-mock.json without
 * regenerating ticket/merch transactions. Default KHL / main pace has no zeros.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fillEmptyCampaignPaceDays } from "../lib/mock/hockey-generator";
import { reviveMockData, type RawMockData } from "../lib/mock/revive-dates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
const revived = reviveMockData(raw);
const before = revived.subscriptions.length;

fillEmptyCampaignPaceDays(revived.subscriptions);

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
  `Patched campaign pace days in ${mockPath} (${before} → ${revived.subscriptions.length} subs)`,
);

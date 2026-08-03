/**
 * Generates static mock data JSON from hockey-generator logic.
 * Usage: npx tsx scripts/generate-mock-json.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMockData } from "../lib/mock/hockey-generator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../lib/mock/data");
const outPath = join(outDir, "hockey-mock.json");

const { matches, transactions, subscriptions } = generateMockData();

const serialized = {
  matches: matches.map((match) => ({
    ...match,
    date: match.date.toISOString(),
  })),
  transactions: transactions.map((tx) => ({
    ...tx,
    date: tx.date.toISOString(),
  })),
  subscriptions: subscriptions.map((sub) => ({
    ...sub,
    purchasedAt: sub.purchasedAt.toISOString(),
    validTo: sub.validTo.toISOString(),
  })),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(serialized));

console.log(`Generated ${outPath}`);
console.log(
  `  Matches: ${matches.length}, Transactions: ${transactions.length}, Subscriptions: ${subscriptions.length}`,
);

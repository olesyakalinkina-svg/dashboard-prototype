/**
 * Generates sale + subscription fact data from the same logic as lib/mock/hockey.ts
 * Output: database/seed-facts.sql
 *
 * Usage: node database/generate-seed.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ARENA_CAPACITY = 12000;
const OPPONENTS = [
  "СКА", "ЦСКА", "Авангард", "Ак Барс", "Локомотив", "Трактор",
  "Металлург", "Салават Юлаев", "Динамо Минск", "Спартак", "Сибирь",
  "Амур", "Сочи", "Торпедо", "Шанхай",
];

const TICKET_PRODUCTS = [
  { productId: 1, sectorId: 1, price: 2500 },
  { productId: 2, sectorId: 2, price: 1800 },
  { productId: 3, sectorId: 3, price: 1200 },
  { productId: 4, sectorId: 4, price: 8500 },
  { productId: 5, sectorId: 2, price: 6000, family: true },
];

const MERCH_PRODUCTS = [
  { productId: 10, price: 3500 },
  { productId: 11, price: 3500 },
  { productId: 12, price: 1500 },
  { productId: 13, price: 2200 },
  { productId: 14, price: 2800 },
  { productId: 15, price: 4000 },
  { productId: 16, price: 1200 },
];

const STREAM_IDS = { tickets: 1, merch: 2 };

const SUBSCRIPTION_PLANS = [
  { planId: 1, price: 10000, matches: 5 },
  { planId: 2, price: 7500, matches: 5 },
  { planId: 3, price: 18000, matches: 10 },
  { planId: 4, price: 85000, matches: 30 },
  { planId: 6, price: 6000, matches: 10 },
];

const CHANNEL_IDS = { online: 1, arena: 2, kiosk: 3 };

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function randomInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomPick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subDays(date, days) {
  return addDays(date, -days);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function toIsoTimestamp(date) {
  return date.toISOString();
}

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullable(value) {
  return value == null ? "NULL" : sqlStr(value);
}

const today = new Date();
today.setHours(12, 0, 0, 0);

const matches = OPPONENTS.map((opponent, i) => {
  const date = subDays(today, 90 - i * 6);
  const fillFactor = 0.55 + rand() * 0.4;
  const attendance = Math.round(ARENA_CAPACITY * fillFactor);
  return {
    id: `match-${i + 1}`,
    date,
    opponent,
    attendance,
  };
});

const sales = [];
let saleId = 1;

function applyLoyaltyDiscount(grossAmount) {
  if (rand() > 0.32) {
    return { amount: grossAmount, loyaltyDiscount: 0 };
  }
  const discountPct = [5, 10, 15][randomInt(0, 2)];
  const loyaltyDiscount = Math.round(grossAmount * (discountPct / 100));
  return { amount: grossAmount - loyaltyDiscount, loyaltyDiscount };
}

for (const match of matches) {
  const ticketCount = randomInt(80, 120);
  for (let t = 0; t < ticketCount; t++) {
    const item = randomPick(TICKET_PRODUCTS);
    const qty = item.family ? 1 : randomInt(1, 4);
    const soldAt = addDays(match.date, randomInt(-2, 0));
    const gross = item.price * qty;
    const { amount, loyaltyDiscount } = applyLoyaltyDiscount(gross);
    sales.push({
      id: `tx-${saleId++}`,
      soldAt,
      streamId: STREAM_IDS.tickets,
      channelId: rand() > 0.35 ? CHANNEL_IDS.online : CHANNEL_IDS.arena,
      productId: item.productId,
      matchId: match.id,
      sectorId: item.sectorId,
      quantity: qty,
      unitPrice: item.price,
      amount,
      loyaltyDiscount,
    });
  }

  const merchCount = randomInt(40, 70);
  for (let m = 0; m < merchCount; m++) {
    const item = randomPick(MERCH_PRODUCTS);
    const qty = randomInt(1, 3);
    sales.push({
      id: `tx-${saleId++}`,
      soldAt: match.date,
      streamId: STREAM_IDS.merch,
      channelId: rand() > 0.5 ? CHANNEL_IDS.kiosk : CHANNEL_IDS.arena,
      productId: item.productId,
      matchId: match.id,
      sectorId: null,
      quantity: qty,
      unitPrice: item.price,
      amount: item.price * qty,
      loyaltyDiscount: 0,
    });
  }
}

for (let o = 0; o < 25; o++) {
  const item = randomPick(MERCH_PRODUCTS);
  const qty = randomInt(1, 2);
  sales.push({
    id: `tx-${saleId++}`,
    soldAt: subDays(today, randomInt(1, 90)),
    streamId: STREAM_IDS.merch,
    channelId: CHANNEL_IDS.online,
    productId: item.productId,
    matchId: null,
    sectorId: null,
    quantity: qty,
    unitPrice: item.price,
    amount: item.price * qty,
    loyaltyDiscount: 0,
  });
}

const todayTicketCount = randomInt(20, 45);
for (let i = 0; i < todayTicketCount; i++) {
  const match = randomPick(matches);
  const item = randomPick(TICKET_PRODUCTS);
  const qty = randomInt(1, 3);
  const gross = item.price * qty;
  const { amount, loyaltyDiscount } = applyLoyaltyDiscount(gross);
  sales.push({
    id: `tx-${saleId++}`,
    soldAt: today,
    streamId: STREAM_IDS.tickets,
    channelId: rand() > 0.35 ? CHANNEL_IDS.online : CHANNEL_IDS.arena,
    productId: item.productId,
    matchId: match.id,
    sectorId: item.sectorId,
    quantity: qty,
    unitPrice: item.price,
    amount,
    loyaltyDiscount,
  });
}

const subscriptions = [];
const redemptions = [];
let subIndex = 1;
let redemptionIndex = 1;

for (let i = 0; i < 128; i++) {
  const plan = randomPick(SUBSCRIPTION_PLANS);
  const purchasedAt = subDays(today, randomInt(5, 85));
  const validFrom = purchasedAt;
  const validTo = addDays(purchasedAt, 90);
  const subId = `00000000-0000-4000-8000-${String(subIndex++).padStart(12, "0")}`;
  const channelId = rand() > 0.4 ? CHANNEL_IDS.online : CHANNEL_IDS.arena;

  const eligibleMatches = matches.filter((m) => m.date >= validFrom && m.date <= validTo);
  const usedCount = Math.min(
    randomInt(1, plan.matches),
    eligibleMatches.length,
  );
  const usedMatches = eligibleMatches.slice(0, usedCount);

  subscriptions.push({
    id: subId,
    planId: plan.planId,
    purchasedAt,
    validFrom,
    validTo,
    price: plan.price,
    matchesTotal: plan.matches,
    matchesUsed: usedCount,
    channelId,
    status: usedCount >= plan.matches ? "fully_used" : "active",
  });

  for (const m of usedMatches) {
    redemptions.push({
      id: `00000000-0000-4001-9000-${String(redemptionIndex++).padStart(12, "0")}`,
      subscriptionId: subId,
      matchId: m.id,
      redeemedAt: m.date,
    });
  }
}

const saleRows = sales.map((s) => {
  return `(${sqlStr(s.id)}, ${sqlStr(toIsoTimestamp(s.soldAt))}, ${toDateKey(s.soldAt)}, ${s.streamId}, ${s.channelId}, ${s.productId}, ${sqlNullable(s.matchId)}, NULL, NULL, ${s.sectorId ?? "NULL"}, ${s.quantity}, ${s.unitPrice.toFixed(2)}, ${s.amount.toFixed(2)}, 0, ${(s.loyaltyDiscount ?? 0).toFixed(2)})`;
});

const subRows = subscriptions.map((s) => {
  const validFromStr = s.validFrom.toISOString().slice(0, 10);
  const validToStr = s.validTo.toISOString().slice(0, 10);
  return `(${sqlStr(s.id)}, ${s.planId}, NULL, ${sqlStr(toIsoTimestamp(s.purchasedAt))}, ${toDateKey(s.purchasedAt)}, ${sqlStr(validFromStr)}, ${sqlStr(validToStr)}, ${s.price.toFixed(2)}, ${s.matchesTotal}, ${s.matchesUsed}, ${s.channelId}, ${sqlStr(s.status)})`;
});

const redemptionRows = redemptions.map((r) => {
  return `(${sqlStr(r.id)}, ${sqlStr(r.subscriptionId)}, ${sqlStr(r.matchId)}, ${sqlStr(toIsoTimestamp(r.redeemedAt))}, NULL)`;
});

const sql = `-- Auto-generated by database/generate-seed.mjs — do not edit manually
SET search_path TO bi, public;

INSERT INTO sale (id, sold_at, date_key, stream_id, channel_id, product_id, match_id, customer_id, promotion_id, sector_id, quantity, unit_price, amount, discount_amount, loyalty_discount_amount) VALUES
${saleRows.join(",\n")};

INSERT INTO subscription (id, plan_id, customer_id, purchased_at, date_key, valid_from, valid_to, price, matches_total, matches_used, channel_id, status) VALUES
${subRows.join(",\n")};

INSERT INTO subscription_redemption (id, subscription_id, match_id, redeemed_at, sector_id) VALUES
${redemptionRows.join(",\n")};
`;

const outPath = join(__dirname, "03_seed_facts.sql");
writeFileSync(outPath, sql, "utf8");
console.log(`Generated ${outPath}`);
console.log(`  Sales: ${sales.length}, Subscriptions: ${subscriptions.length}, Redemptions: ${redemptions.length}`);

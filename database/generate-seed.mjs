/**
 * Generates matches + sale/subscription facts from hockey-mock.json
 * Output: database/03_seed_facts.sql
 *
 * Matches, seasons, leagues, and subscription dimensions come from the mock.
 * Ticket/merch sale rows are a compact sample across all 14 price zones + parking
 * (full mock has ~148k transactions — too large for SQL seed).
 *
 * Usage: node database/generate-seed.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OPPONENTS = [
  "СКА",
  "ЦСКА",
  "Авангард",
  "Ак Барс",
  "Локомотив",
  "Трактор",
  "Металлург",
  "Салават Юлаев",
  "Динамо Минск",
  "Спартак",
  "Сибирь",
  "Амур",
  "Сочи",
  "Торпедо",
  "Динамо Мск",
  "Шанхай",
  "Торос",
  "Нефтяник",
  "Рубин",
  "Ижсталь",
  "Химик",
  "Звезда",
  "СКА-ВМФ",
  "Дизель",
  "Красная Армия",
  "Алмаз",
  "Чайка",
  "СКА-1946",
  "МХК Спартак",
  "Капитан",
  "Локо",
  "Молот",
];

const opponentIdByName = Object.fromEntries(
  OPPONENTS.map((name, i) => [name, i + 1]),
);

const ARENA_ID = { main: 1, secondary: 2 };

const PRICE_ZONES = [
  { id: 1, code: "A", price: 443 },
  { id: 2, code: "B1", price: 390 },
  { id: 3, code: "B2", price: 372 },
  { id: 4, code: "B3", price: 354 },
  { id: 5, code: "B4", price: 337 },
  { id: 6, code: "C1", price: 283 },
  { id: 7, code: "C2", price: 266 },
  { id: 8, code: "C3", price: 248 },
  { id: 9, code: "C4", price: 230 },
  { id: 10, code: "D1", price: 195 },
  { id: 11, code: "D2", price: 177 },
  { id: 12, code: "D3", price: 159 },
  { id: 13, code: "D4", price: 142 },
  { id: 14, code: "VIP", price: 1506 },
];

const sectorIdByCode = Object.fromEntries(
  PRICE_ZONES.map((zone) => [zone.code, zone.id]),
);

const PARKING_PRODUCT = { productId: 15, price: 500 };

const MERCH_PRODUCTS = [
  { productId: 20, price: 3500 },
  { productId: 21, price: 3500 },
  { productId: 22, price: 1500 },
  { productId: 23, price: 2200 },
  { productId: 24, price: 2800 },
  { productId: 25, price: 4000 },
  { productId: 26, price: 1200 },
];

const STREAM_IDS = { tickets: 1, merch: 2 };
const CHANNEL_IDS = { online: 1, arena: 2, kiosk: 3 };
const SUB_CHANNEL_IDS = { official_site: 1, box_office: 2 };

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

function toSqlDate(value) {
  return String(value).slice(0, 10);
}

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullable(value) {
  return value == null ? "NULL" : sqlStr(value);
}

function parseMockDate(value) {
  return new Date(value);
}

function uuidFromSubId(id) {
  const n = String(id).replace(/\D/g, "") || "1";
  return `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
}

function planIdFromMock(planId) {
  const n = Number(String(planId).replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 4;
}

const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");
const mock = JSON.parse(readFileSync(mockPath, "utf8"));

const matches = mock.matches.map((match) => {
  const opponentId = opponentIdByName[match.opponent];
  if (!opponentId) {
    throw new Error(`Unknown opponent in mock: ${match.opponent}`);
  }
  const arenaId = ARENA_ID[match.arena];
  if (!arenaId) {
    throw new Error(`Unknown arena in mock: ${match.arena}`);
  }
  return {
    id: match.id,
    arenaId,
    opponentId,
    date: parseMockDate(match.date),
    dateSql: toSqlDate(match.date),
    attendance: match.attendance,
    status: match.eventCompleted ? "completed" : "scheduled",
    season: match.season,
    league: match.league,
    tournamentStage: match.tournamentStage,
    matchClass: match.matchClass,
    ticketSalesWindowDays: match.ticketSalesWindowDays,
    capacity: match.capacity,
  };
});

const matchRows = matches.map(
  (m) =>
    `(${sqlStr(m.id)}, ${m.arenaId}, ${m.opponentId}, ${sqlStr(m.dateSql)}, ${m.attendance}, ${sqlStr(m.status)}, ${sqlStr(m.season)}, ${sqlStr(m.league)}, ${sqlStr(m.tournamentStage)}, ${sqlStr(m.matchClass)}, ${m.ticketSalesWindowDays}, ${m.capacity})`,
);

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
  const windowDays = match.ticketSalesWindowDays || 14;
  const ticketCount = randomInt(80, 120);
  for (let t = 0; t < ticketCount; t++) {
    const isParking = rand() < 0.12;
    const soldAt = subDays(match.date, randomInt(0, windowDays - 1));
    if (isParking) {
      const qty = randomInt(1, 2);
      const gross = PARKING_PRODUCT.price * qty;
      const { amount, loyaltyDiscount } = applyLoyaltyDiscount(gross);
      sales.push({
        id: `tx-${saleId++}`,
        soldAt,
        streamId: STREAM_IDS.tickets,
        channelId: rand() > 0.35 ? CHANNEL_IDS.online : CHANNEL_IDS.arena,
        productId: PARKING_PRODUCT.productId,
        matchId: match.id,
        sectorId: null,
        ticketType: "parking",
        quantity: qty,
        unitPrice: PARKING_PRODUCT.price,
        amount,
        loyaltyDiscount,
      });
      continue;
    }
    const zone = randomPick(PRICE_ZONES);
    const qty = randomInt(1, 4);
    const gross = zone.price * qty;
    const { amount, loyaltyDiscount } = applyLoyaltyDiscount(gross);
    sales.push({
      id: `tx-${saleId++}`,
      soldAt,
      streamId: STREAM_IDS.tickets,
      channelId: rand() > 0.35 ? CHANNEL_IDS.online : CHANNEL_IDS.arena,
      productId: zone.id,
      matchId: match.id,
      sectorId: zone.id,
      ticketType: "arena",
      quantity: qty,
      unitPrice: zone.price,
      amount,
      loyaltyDiscount,
    });
  }

  if (match.status !== "completed") continue;

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
      ticketType: null,
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
    soldAt: subDays(matches[0].date, randomInt(1, 30)),
    streamId: STREAM_IDS.merch,
    channelId: CHANNEL_IDS.online,
    productId: item.productId,
    matchId: null,
    sectorId: null,
    ticketType: null,
    quantity: qty,
    unitPrice: item.price,
    amount: item.price * qty,
    loyaltyDiscount: 0,
  });
}

const subscriptions = mock.subscriptions.map((sub) => {
  const purchasedAt = parseMockDate(sub.purchasedAt);
  const validTo = parseMockDate(sub.validTo);
  const arenaId = ARENA_ID[sub.arena] ?? null;
  const ticketType = sub.ticketType === "parking" ? "parking" : "arena";
  const sectorId =
    ticketType === "parking" ? null : (sectorIdByCode[sub.priceZone] ?? null);
  return {
    id: uuidFromSubId(sub.id),
    planId: planIdFromMock(sub.planId),
    purchasedAt,
    validFrom: purchasedAt,
    validTo,
    price: sub.price,
    matchesTotal: sub.matchesTotal,
    matchesUsed: sub.matchesUsed,
    channelId: SUB_CHANNEL_IDS[sub.channel] ?? CHANNEL_IDS.online,
    status: sub.status,
    season: sub.season,
    league: sub.league,
    tournamentStage: sub.tournamentStage,
    arenaId,
    ticketType,
    sectorId,
  };
});

const redemptions = [];
let redemptionIndex = 1;

for (const sub of subscriptions) {
  const eligible = matches.filter(
    (m) =>
      m.season === sub.season &&
      m.league === sub.league &&
      m.date >= sub.validFrom &&
      m.date <= sub.validTo,
  );
  const usedCount = Math.min(sub.matchesUsed, eligible.length);
  for (const m of eligible.slice(0, usedCount)) {
    redemptions.push({
      id: `00000000-0000-4001-9000-${String(redemptionIndex++).padStart(12, "0")}`,
      subscriptionId: sub.id,
      matchId: m.id,
      redeemedAt: m.date,
      sectorId: sub.sectorId,
    });
  }
}

const saleRows = sales.map((s) => {
  return `(${sqlStr(s.id)}, ${sqlStr(toIsoTimestamp(s.soldAt))}, ${toDateKey(s.soldAt)}, ${s.streamId}, ${s.channelId}, ${s.productId}, ${sqlNullable(s.matchId)}, NULL, NULL, ${s.sectorId ?? "NULL"}, ${sqlNullable(s.ticketType)}, ${s.quantity}, ${s.unitPrice.toFixed(2)}, ${s.amount.toFixed(2)}, 0, ${(s.loyaltyDiscount ?? 0).toFixed(2)})`;
});

const subRows = subscriptions.map((s) => {
  const validFromStr = s.validFrom.toISOString().slice(0, 10);
  const validToStr = s.validTo.toISOString().slice(0, 10);
  return `(${sqlStr(s.id)}, ${s.planId}, NULL, ${sqlStr(toIsoTimestamp(s.purchasedAt))}, ${toDateKey(s.purchasedAt)}, ${sqlStr(validFromStr)}, ${sqlStr(validToStr)}, ${s.price.toFixed(2)}, ${s.matchesTotal}, ${s.matchesUsed}, ${s.channelId}, ${sqlStr(s.status)}, ${sqlStr(s.season)}, ${sqlStr(s.league)}, ${sqlStr(s.tournamentStage)}, ${s.arenaId ?? "NULL"}, ${sqlStr(s.ticketType)}, ${s.sectorId ?? "NULL"})`;
});

const redemptionRows = redemptions.map((r) => {
  return `(${sqlStr(r.id)}, ${sqlStr(r.subscriptionId)}, ${sqlStr(r.matchId)}, ${sqlStr(toIsoTimestamp(r.redeemedAt))}, ${r.sectorId ?? "NULL"})`;
});

const sql = `-- Auto-generated by database/generate-seed.mjs — do not edit manually
-- Matches and subscription dimensions from lib/mock/data/hockey-mock.json
SET search_path TO bi, public;

INSERT INTO match (id, arena_id, opponent_id, match_date, attendance, status, season, league, tournament_stage, match_class, ticket_sales_window_days, capacity) VALUES
${matchRows.join(",\n")};

INSERT INTO promotion_match (promotion_id, match_id) VALUES
    ('promo-1', 'match-1'), ('promo-1', 'match-2'),
    ('promo-2', 'match-3'), ('promo-2', 'match-4'), ('promo-2', 'match-5'),
    ('promo-3', 'match-6'), ('promo-3', 'match-7'),
    ('promo-4', 'match-8'), ('promo-4', 'match-9'), ('promo-4', 'match-10'),
    ('promo-6', 'match-11'), ('promo-6', 'match-12'),
    ('promo-7', 'match-13'), ('promo-7', 'match-14'),
    ('promo-8', 'match-14'), ('promo-8', 'match-15'),
    ('promo-9', 'match-1'), ('promo-9', 'match-2'), ('promo-9', 'match-3'),
    ('promo-9', 'match-4'), ('promo-9', 'match-5');

INSERT INTO sale (id, sold_at, date_key, stream_id, channel_id, product_id, match_id, customer_id, promotion_id, sector_id, ticket_type, quantity, unit_price, amount, discount_amount, loyalty_discount_amount) VALUES
${saleRows.join(",\n")};

INSERT INTO subscription (id, plan_id, customer_id, purchased_at, date_key, valid_from, valid_to, price, matches_total, matches_used, channel_id, status, season, league, tournament_stage, arena_id, ticket_type, sector_id) VALUES
${subRows.join(",\n")};

INSERT INTO subscription_redemption (id, subscription_id, match_id, redeemed_at, sector_id) VALUES
${redemptionRows.join(",\n")};
`;

const outPath = join(__dirname, "03_seed_facts.sql");
writeFileSync(outPath, sql, "utf8");
console.log(`Generated ${outPath}`);
console.log(
  `  Matches: ${matches.length}, Sales: ${sales.length}, Subscriptions: ${subscriptions.length}, Redemptions: ${redemptions.length}`,
);

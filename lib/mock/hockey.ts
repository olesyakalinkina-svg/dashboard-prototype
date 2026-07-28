import { addDays, differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import type {
  ArenaId,
  Match,
  MerchSalesPoint,
  OrderSource,
  PriceZone,
  Promotion,
  SalesChannel,
  Subscription,
  SubscriptionPlan,
  TicketType,
  Transaction,
} from "@/types/dashboard";
import { ALL_PRICE_ZONES } from "@/lib/ticket-filter-options";

const ARENA_CAPACITY = 10500;
const HOME_ARENA: ArenaId = "main";
const MATCH_COUNT = 15;

export const SEASON_START = new Date(2025, 8, 1);
export const SEASON_END = new Date(2026, 4, 31);
export const MOCK_TODAY = new Date(2026, 4, 15);
export const SUBSCRIPTIONS_PERIOD_START = new Date(2025, 7, 25);
export const SUBSCRIPTIONS_PERIOD_END = new Date(2025, 8, 14);

const SEASON_SPAN_DAYS = differenceInCalendarDays(SEASON_END, SEASON_START);

function getMatchDate(index: number): Date {
  if (MATCH_COUNT <= 1) return startOfDay(SEASON_START);
  const offset = Math.round((index / (MATCH_COUNT - 1)) * SEASON_SPAN_DAYS);
  return startOfDay(addDays(SEASON_START, offset));
}

function isEventCompleted(matchDate: Date): boolean {
  return startOfDay(matchDate) < startOfDay(MOCK_TODAY);
}

function randomDateInSeasonRange(from: Date, to: Date): Date {
  const span = Math.max(0, differenceInCalendarDays(to, from));
  return addDays(from, randomInt(0, span));
}

const OPPONENTS = [
  "СКА",
  "ЦСКА",
  "Авангард",
  "Ак Барс",
  "Локомотив",
  "Трактор",
  "Металлург",
  "Салават Юлаев",
  "Динамо М",
  "Спартак",
  "Сибирь",
  "Амур",
  "Сочи",
  "Torpedo",
  "Шанхай",
];

const ZONE_PRICES: Record<PriceZone, number> = {
  A: 2500,
  B1: 2200,
  B2: 2100,
  B3: 2000,
  B4: 1900,
  C1: 1600,
  C2: 1500,
  C3: 1400,
  C4: 1300,
  D1: 1100,
  D2: 1000,
  D3: 900,
  D4: 800,
  VIP: 8500,
};

const ORDER_SOURCES: OrderSource[] = [
  "box_office",
  "official_site",
  "yandex_afisha",
];

const MATCH_MERCH_POINTS: MerchSalesPoint[] = [
  "flagship",
  "arena_north",
  "arena_south",
  "mall_raduga",
  "mall_continent",
];

function pickMerchSalesPoint(atMatch: boolean): MerchSalesPoint {
  if (!atMatch) return "online_store";
  return randomPick(MATCH_MERCH_POINTS);
}

function pickMerchQuantity(): number {
  return rand() < 0.34 ? 1 : 2;
}

const MERCH_ITEMS = [
  { desc: "Футболка домашняя", price: 3500 },
  { desc: "Футболка гостевая", price: 3500 },
  { desc: "Шарф клубный", price: 1500 },
  { desc: "Кепка с логотипом", price: 2200 },
  { desc: "Хоккейная клюшка mini", price: 2800 },
  { desc: "Детская форма", price: 4000 },
  { desc: "Термокружка", price: 1200 },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function randomInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function buildMatchMeta(index: number): Pick<
  Match,
  "season" | "league" | "tournamentStage" | "arena"
> {
  if (index >= 10 && index < 13) {
    return {
      season: "2025/26",
      league: "KHL",
      tournamentStage: "playoff",
      arena: HOME_ARENA,
    };
  }

  if (index === 9) {
    return {
      season: "2025/26",
      league: "KHL",
      tournamentStage: "playoff",
      arena: HOME_ARENA,
    };
  }

  if (index === 8) {
    return {
      season: "2025/26",
      league: "VHL",
      tournamentStage: "regular",
      arena: "secondary",
    };
  }

  if (index === 6) {
    return {
      season: "2025/26",
      league: "MHL",
      tournamentStage: "regular",
      arena: HOME_ARENA,
    };
  }

  if (index === 7) {
    return {
      season: "2025/26",
      league: "MHL",
      tournamentStage: "regular",
      arena: HOME_ARENA,
    };
  }

  return {
    season: "2025/26",
    league: "KHL",
    tournamentStage: "regular",
    arena: HOME_ARENA,
  };
}

export const matches: Match[] = OPPONENTS.map((opponent, i) => {
  const date = getMatchDate(i);
  const eventCompleted = isEventCompleted(date);
  const fillFactor = 0.55 + rand() * 0.4;
  const attendance = eventCompleted
    ? Math.round(ARENA_CAPACITY * fillFactor)
    : 0;

  return {
    id: `match-${i + 1}`,
    date,
    opponent,
    attendance,
    capacity: ARENA_CAPACITY,
    eventCompleted,
    ...buildMatchMeta(i),
  };
});

function pickOrderSource(): OrderSource {
  const roll = rand();
  if (roll < 0.4) return "official_site";
  if (roll < 0.65) return "box_office";
  return "yandex_afisha";
}

const TICKET_SALES_WINDOW_DAYS = 21;
const TICKET_PLAN_FILL_RATE = 0.82;
const TICKET_PLAN_AVG_PRICE = 1750;

function closestPriceZone(targetPrice: number): PriceZone {
  return ALL_PRICE_ZONES.reduce((best, zone) =>
    Math.abs(ZONE_PRICES[zone] - targetPrice) <
    Math.abs(ZONE_PRICES[best] - targetPrice)
      ? zone
      : best,
  ALL_PRICE_ZONES[0]);
}

function randomSaleDate(matchDate: Date, explicit?: Date): Date {
  if (explicit) return explicit;

  const saleEnd = matchDate > MOCK_TODAY ? MOCK_TODAY : matchDate;
  const saleStart = subDays(saleEnd, TICKET_SALES_WINDOW_DAYS - 1);
  const span = Math.max(0, differenceInCalendarDays(saleEnd, saleStart));
  return subDays(saleEnd, randomInt(0, span));
}

function buildDayTicketSales(
  matchId: string,
  saleDate: Date,
  startId: number,
  ticketTarget: number,
  revenueTarget: number,
): Transaction[] {
  const txs: Transaction[] = [];
  let id = startId;
  let ticketsLeft = ticketTarget;
  let revenueLeft = revenueTarget;

  while (ticketsLeft > 0 && revenueLeft > 0) {
    const isLast = ticketsLeft <= 4;
    const isParking = !isLast && rand() < 0.12;

    if (isParking) {
      const qty = isLast
        ? ticketsLeft
        : Math.min(randomInt(1, 2), ticketsLeft, Math.floor(revenueLeft / 500) || 1);
      const gross = 500 * qty;
      const orderSource = pickOrderSource();
      txs.push({
        id: `tx-${id++}`,
        date: saleDate,
        stream: "tickets",
        description: "Парковка",
        matchId,
        channel: orderSource === "box_office" ? "arena" : "online",
        amount: gross,
        quantity: qty,
        ticketType: "parking",
        orderSource,
      });
      ticketsLeft -= qty;
      revenueLeft -= gross;
      continue;
    }

    if (isLast) {
      const priceZone = closestPriceZone(Math.round(revenueLeft / ticketsLeft));
      const unitPrice = ZONE_PRICES[priceZone];
      const qty = ticketsLeft;
      const gross = unitPrice * qty;
      const amount = Math.min(gross, revenueLeft);
      const orderSource = pickOrderSource();
      txs.push({
        id: `tx-${id++}`,
        date: saleDate,
        stream: "tickets",
        description: `Билет на арену, сектор ${priceZone}`,
        matchId,
        channel: orderSource === "box_office" ? "arena" : "online",
        amount,
        quantity: qty,
        sector: priceZone,
        ticketType: "arena",
        priceZone,
        orderSource,
      });
      break;
    }

    const priceZone = randomPick(ALL_PRICE_ZONES);
    const unitPrice = ZONE_PRICES[priceZone];
    const qty = Math.min(randomInt(1, 4), ticketsLeft);
    const gross = unitPrice * qty;
    const amount = Math.min(gross, revenueLeft);
    const orderSource = pickOrderSource();
    txs.push({
      id: `tx-${id++}`,
      date: saleDate,
      stream: "tickets",
      description: `Билет на арену, сектор ${priceZone}`,
      matchId,
      channel: orderSource === "box_office" ? "arena" : "online",
      amount,
      quantity: qty,
      sector: priceZone,
      ticketType: "arena",
      priceZone,
      orderSource,
    });
    ticketsLeft -= qty;
    revenueLeft -= amount;
  }

  return txs;
}

function generateMatchTicketSales(
  match: Match,
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const matchVariance = 0.9 + rand() * 0.12;
  const revenueVariance = 0.92 + rand() * 0.1;
  const targetTickets = Math.round(
    match.capacity * TICKET_PLAN_FILL_RATE * matchVariance,
  );
  const targetRevenue = Math.round(
    targetTickets * TICKET_PLAN_AVG_PRICE * revenueVariance,
  );

  const dailyWeights = Array.from(
    { length: TICKET_SALES_WINDOW_DAYS },
    () => 0.8 + rand() * 0.4,
  );
  const weightSum = dailyWeights.reduce((sum, weight) => sum + weight, 0);

  const txs: Transaction[] = [];
  let id = startId;
  let allocatedTickets = 0;
  let allocatedRevenue = 0;
  let dayIndex = 0;

  for (let offset = TICKET_SALES_WINDOW_DAYS; offset >= 1; offset -= 1) {
    const saleDay = subDays(match.date, offset);
    if (saleDay > MOCK_TODAY) {
      dayIndex += 1;
      continue;
    }

    const isLastDay = offset === 1;
    const dayTickets = isLastDay
      ? targetTickets - allocatedTickets
      : Math.round((targetTickets * dailyWeights[dayIndex]) / weightSum);
    const dayRevenue = isLastDay
      ? targetRevenue - allocatedRevenue
      : Math.round((targetRevenue * dailyWeights[dayIndex]) / weightSum);

    if (dayTickets > 0 && dayRevenue > 0) {
      const dayTxs = buildDayTicketSales(
        match.id,
        saleDay,
        id,
        dayTickets,
        dayRevenue,
      );
      id += dayTxs.length;
      txs.push(...dayTxs);
      allocatedTickets += dayTxs.reduce((sum, tx) => sum + tx.quantity, 0);
      allocatedRevenue += dayTxs.reduce((sum, tx) => sum + tx.amount, 0);
    }
    dayIndex += 1;
  }

  return { txs, nextId: id };
}

function generateTransactions(): Transaction[] {
  const transactions: Transaction[] = [];
  let id = 1;

  for (const match of matches) {
    const ticketSales = generateMatchTicketSales(match, id);
    transactions.push(...ticketSales.txs);
    id = ticketSales.nextId;

    if (!match.eventCompleted) continue;

    const freeTicketCount = randomInt(0, 2);
    for (let f = 0; f < freeTicketCount; f++) {
      const qty = pickMerchQuantity();
      const orderSource = pickOrderSource();
      const channel: SalesChannel =
        orderSource === "box_office" ? "arena" : "online";
      transactions.push({
        id: `tx-${id++}`,
        date: randomSaleDate(match.date),
        stream: "tickets",
        description: "Бесплатный билет",
        matchId: match.id,
        channel,
        amount: 0,
        quantity: qty,
        freeQuantity: qty,
        ticketType: "arena",
        priceZone: randomPick(ALL_PRICE_ZONES),
        orderSource,
      });
    }

    const merchCount = randomInt(40, 70);
    for (let m = 0; m < merchCount; m++) {
      const item = randomPick(MERCH_ITEMS);
      const qty = pickMerchQuantity();
      const merchSalesPoint = pickMerchSalesPoint(true);
      const amount = item.price * qty;
      const costAmount = Math.round(amount * (0.35 + rand() * 0.2));
      transactions.push({
        id: `tx-${id++}`,
        date: match.date,
        stream: "merch",
        description: item.desc,
        matchId: match.id,
        channel: "kiosk",
        amount,
        quantity: qty,
        merchSalesPoint,
        costAmount,
      });

      if (rand() < 0.035) {
        const returnQty = randomInt(1, qty);
        const returnAmount = Math.round(item.price * returnQty);
        transactions.push({
          id: `tx-${id++}`,
          date: addDays(match.date, randomInt(1, 5)),
          stream: "merch",
          description: `Возврат: ${item.desc}`,
          matchId: match.id,
          channel: "kiosk",
          amount: returnAmount,
          quantity: returnQty,
          merchSalesPoint,
          isReturn: true,
        });
      }
    }

  }

  for (let o = 0; o < 25; o++) {
    const item = randomPick(MERCH_ITEMS);
    const qty = pickMerchQuantity();
    const amount = item.price * qty;
    const costAmount = Math.round(amount * (0.35 + rand() * 0.2));
    transactions.push({
      id: `tx-${id++}`,
      date: randomDateInSeasonRange(SEASON_START, MOCK_TODAY),
      stream: "merch",
      description: item.desc,
      matchId: null,
      channel: "online",
      amount,
      quantity: qty,
      merchSalesPoint: "online_store",
      costAmount,
    });
  }

  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export const transactions = generateTransactions();

export const promotions: Promotion[] = [
  {
    id: "promo-1",
    name: "Семейный матч −20%",
    startDate: subDays(getMatchDate(0), 18),
    endDate: addDays(getMatchDate(1), 1),
    matchIds: ["match-1", "match-2"],
    reach: 45000,
    conversions: 820,
    revenueLift: 1250000,
    targetStream: "tickets",
  },
  {
    id: "promo-2",
    name: "Первый гол — скидка на мерч",
    startDate: subDays(getMatchDate(2), 14),
    endDate: addDays(getMatchDate(4), 2),
    matchIds: ["match-3", "match-4", "match-5"],
    reach: 62000,
    conversions: 1340,
    revenueLift: 890000,
    targetStream: "merch",
  },
  {
    id: "promo-3",
    name: "День болельщика",
    startDate: subDays(getMatchDate(5), 10),
    endDate: addDays(getMatchDate(6), 1),
    matchIds: ["match-6", "match-7"],
    reach: 38000,
    conversions: 2100,
    revenueLift: 560000,
    targetStream: "all",
  },
  {
    id: "promo-4",
    name: "Спонсор X2 баллы",
    startDate: subDays(getMatchDate(7), 12),
    endDate: addDays(getMatchDate(9), 1),
    matchIds: ["match-8", "match-9", "match-10"],
    reach: 71000,
    conversions: 980,
    revenueLift: 720000,
    targetStream: "merch",
  },
  {
    id: "promo-6",
    name: "VIP-ложа: гость бесплатно",
    startDate: subDays(getMatchDate(10), 7),
    endDate: addDays(getMatchDate(11), 1),
    matchIds: ["match-11", "match-12"],
    reach: 12000,
    conversions: 145,
    revenueLift: 2100000,
    targetStream: "tickets",
  },
  {
    id: "promo-7",
    name: "Новогодний хоккейный вечер",
    startDate: subDays(getMatchDate(12), 10),
    endDate: addDays(getMatchDate(13), 1),
    matchIds: ["match-13", "match-14"],
    reach: 55000,
    conversions: 1680,
    revenueLift: 980000,
    targetStream: "all",
  },
  {
    id: "promo-8",
    name: "Студенческий билет −30%",
    startDate: subDays(getMatchDate(13), 14),
    endDate: MOCK_TODAY,
    matchIds: ["match-14", "match-15"],
    reach: 33000,
    conversions: 890,
    revenueLift: 420000,
    targetStream: "tickets",
  },
];

export function getMatchLabel(matchId: string): string {
  const match = matches.find((m) => m.id === matchId);
  if (!match) return "—";
  return `vs ${match.opponent}`;
}

export const subscriptionPlans: SubscriptionPlan[] = [
  { id: "plan-1", code: "SUB-5-A", name: "Абонемент на 5 матчей (сектор A)", matchCount: 5, price: 10000 },
  { id: "plan-2", code: "SUB-5-B", name: "Абонемент на 5 матчей (сектор B)", matchCount: 5, price: 7500 },
  { id: "plan-3", code: "SUB-10-A", name: "Абонемент на 10 матчей", matchCount: 10, price: 18000 },
  { id: "plan-4", code: "SUB-SEASON", name: "Сезонный абонемент", matchCount: 30, price: 85000 },
  { id: "plan-5", code: "SUB-VIP", name: "VIP-сезонный абонемент", matchCount: 30, price: 250000 },
  { id: "plan-6", code: "SUB-STUD", name: "Студенческий абонемент", matchCount: 10, price: 6000 },
];

function generateSubscriptions(): Subscription[] {
  const subs: Subscription[] = [];
  let id = 1;

  for (let i = 0; i < 85; i++) {
    const plan = randomPick(subscriptionPlans);
    const tournamentStage: Subscription["tournamentStage"] =
      rand() > 0.45 ? "regular" : "playoff";
    const stageMatches = matches.filter(
      (m) => m.tournamentStage === tournamentStage,
    );
    const match = randomPick(stageMatches.length > 0 ? stageMatches : matches);
    const purchasedAt = randomDateInSeasonRange(
      SUBSCRIPTIONS_PERIOD_START,
      SUBSCRIPTIONS_PERIOD_END,
    );
    const validTo = addDays(purchasedAt, 90);
    const usedCount = Math.min(randomInt(1, plan.matchCount), randomInt(1, 8));
    const channel = rand() > 0.4 ? "official_site" : "box_office";
    const status =
      usedCount >= plan.matchCount
        ? "fully_used"
        : validTo < SUBSCRIPTIONS_PERIOD_END
          ? "expired"
          : "active";
    const priceZone =
      plan.code.includes("VIP")
        ? "VIP"
        : plan.code.includes("-A")
          ? "A"
          : plan.code.includes("-B")
            ? randomPick(["B1", "B2", "B3", "B4"] as PriceZone[])
            : randomPick(ALL_PRICE_ZONES);

    subs.push({
      id: `sub-${id++}`,
      planId: plan.id,
      planName: plan.name,
      purchasedAt,
      validTo,
      price: plan.price,
      matchesTotal: plan.matchCount,
      matchesUsed: usedCount,
      channel,
      status,
      season: match.season,
      league: match.league,
      tournamentStage,
      arena: match.arena,
      ticketType: rand() > 0.08 ? "arena" : "parking",
      priceZone,
    });
  }

  return subs.sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
}

export const subscriptions = generateSubscriptions();

export const matchById = new Map(matches.map((m) => [m.id, m]));

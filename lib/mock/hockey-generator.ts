import { addDays, differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import type {
  ArenaId,
  League,
  Match,
  MatchClass,
  MerchProductCategory,
  MerchSalesPoint,
  OrderSource,
  PriceZone,
  SalesChannel,
  Subscription,
  SubscriptionPlan,
  TicketType,
  Transaction,
} from "@/types/dashboard";
import { ALL_PRICE_ZONES } from "@/lib/ticket-filter-options";

const MAIN_ARENA_CAPACITY = 10500;
const SECONDARY_ARENA_CAPACITY = 3200;
const MHL_ARENA_CAPACITY = 5500;
const HOME_ARENA: ArenaId = "main";
const KHL_MATCH_COUNT = 15;
const VHL_MATCH_COUNT = 8;
const MHL_MATCH_COUNT = 8;

export const PREV_SEASON_START = new Date(2024, 8, 1);
export const PREV_SEASON_END = new Date(2025, 4, 31);
export const SEASON_START = new Date(2025, 8, 1);
export const SEASON_END = new Date(2026, 4, 31);
export const MOCK_TODAY = new Date(2026, 4, 15);
export const SUBSCRIPTIONS_PERIOD_START = new Date(2025, 7, 25);
export const SUBSCRIPTIONS_PERIOD_END = new Date(2025, 8, 14);

function getMatchDate(
  index: number,
  matchCount: number,
  seasonStart: Date,
  seasonEnd: Date,
): Date {
  const seasonSpanDays = differenceInCalendarDays(seasonEnd, seasonStart);
  if (matchCount <= 1) return startOfDay(seasonStart);
  const offset = Math.round((index / (matchCount - 1)) * seasonSpanDays);
  return startOfDay(addDays(seasonStart, offset));
}

function getCurrentSeasonMatchDate(index: number): Date {
  return getMatchDate(index, KHL_MATCH_COUNT, SEASON_START, SEASON_END);
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
  "Торпедо",
  "Шанхай",
];

const PREV_SEASON_OPPONENTS = [
  ...OPPONENTS.slice(7),
  ...OPPONENTS.slice(0, 7),
];

const VHL_OPPONENTS = [
  "Торос",
  "Нефтяник",
  "Рубин",
  "Ижсталь",
  "Химик",
  "Звезда",
  "СКА-ВМФ",
  "Дизель",
];

const MHL_OPPONENTS = [
  "Красная Армия",
  "Алмаз",
  "Чайка",
  "СКА-1946",
  "МХК Спартак",
  "Капитан",
  "Локо",
  "Молот",
];

type LeagueSchedule = {
  league: League;
  arena: ArenaId;
  capacity: number;
  opponents: string[];
  getTournamentStage: (index: number, total: number) => Match["tournamentStage"];
};

function getKhlTournamentStage(index: number): Match["tournamentStage"] {
  if (index >= 9 && index <= 12) return "playoff";
  return "regular";
}

const DERBY_OPPONENTS = new Set(["СКА", "ЦСКА", "Спартак", "Динамо М"]);

const CURRENT_SEASON_SCHEDULES: LeagueSchedule[] = [
  {
    league: "KHL",
    arena: HOME_ARENA,
    capacity: MAIN_ARENA_CAPACITY,
    opponents: OPPONENTS,
    getTournamentStage: (index) => getKhlTournamentStage(index),
  },
  {
    league: "VHL",
    arena: "secondary",
    capacity: SECONDARY_ARENA_CAPACITY,
    opponents: VHL_OPPONENTS,
    getTournamentStage: () => "regular",
  },
  {
    league: "MHL",
    arena: HOME_ARENA,
    capacity: MHL_ARENA_CAPACITY,
    opponents: MHL_OPPONENTS,
    getTournamentStage: () => "regular",
  },
];

const PREV_SEASON_SCHEDULES: LeagueSchedule[] = [
  {
    league: "KHL",
    arena: HOME_ARENA,
    capacity: MAIN_ARENA_CAPACITY,
    opponents: PREV_SEASON_OPPONENTS,
    getTournamentStage: (index) => getKhlTournamentStage(index),
  },
  {
    league: "VHL",
    arena: "secondary",
    capacity: SECONDARY_ARENA_CAPACITY,
    opponents: VHL_OPPONENTS,
    getTournamentStage: () => "regular",
  },
  {
    league: "MHL",
    arena: HOME_ARENA,
    capacity: MHL_ARENA_CAPACITY,
    opponents: MHL_OPPONENTS,
    getTournamentStage: () => "regular",
  },
];

type SeasonDefinition = {
  season: string;
  start: Date;
  end: Date;
  idOffset: number;
  schedules: LeagueSchedule[];
};

const SEASON_DEFINITIONS: SeasonDefinition[] = [
  {
    season: "2025/26",
    start: SEASON_START,
    end: SEASON_END,
    idOffset: 1,
    schedules: CURRENT_SEASON_SCHEDULES,
  },
  {
    season: "2024/25",
    start: PREV_SEASON_START,
    end: PREV_SEASON_END,
    idOffset: 1 + KHL_MATCH_COUNT + VHL_MATCH_COUNT + MHL_MATCH_COUNT,
    schedules: PREV_SEASON_SCHEDULES,
  },
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

const MATCH_MERCH_POINT_WEIGHTS: { point: MerchSalesPoint; weight: number }[] = [
  { point: "flagship", weight: 50 },
  { point: "arena_north", weight: 16 },
  { point: "arena_south", weight: 16 },
  { point: "mall_raduga", weight: 2 },
  { point: "mall_continent", weight: 2 },
];

const OFF_MATCH_MERCH_CHANNELS: {
  point: MerchSalesPoint;
  minCount: number;
  maxCount: number;
}[] = [
  { point: "flagship", minCount: 130, maxCount: 170 },
  { point: "online_store", minCount: 300, maxCount: 380 },
  { point: "mall_raduga", minCount: 22, maxCount: 35 },
  { point: "mall_continent", minCount: 22, maxCount: 35 },
];

function pickWeightedMerchSalesPoint(
  options: { point: MerchSalesPoint; weight: number }[],
): MerchSalesPoint {
  const total = options.reduce((sum, item) => sum + item.weight, 0);
  let roll = rand() * total;

  for (const item of options) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.point;
    }
  }

  return options[options.length - 1].point;
}

function pickMerchSalesPoint(): MerchSalesPoint {
  return pickWeightedMerchSalesPoint(MATCH_MERCH_POINT_WEIGHTS);
}

function generateOffMatchMerchSales(
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;

  for (const channel of OFF_MATCH_MERCH_CHANNELS) {
    const txCount = randomInt(channel.minCount, channel.maxCount);

    for (let i = 0; i < txCount; i += 1) {
      const item = pickMerchItem();
      const qty = pickMerchQuantity();
      const amount = item.price * qty;
      const costAmount = Math.round(amount * (0.35 + rand() * 0.2));
      txs.push({
        id: `tx-${id++}`,
        date: randomDateInSeasonRange(PREV_SEASON_START, MOCK_TODAY),
        stream: "merch",
        description: item.desc,
        matchId: null,
        channel: channel.point === "online_store" ? "online" : "kiosk",
        amount,
        quantity: qty,
        merchSalesPoint: channel.point,
        productCategory: item.category,
        costAmount,
      });
    }
  }

  return { txs, nextId: id };
}

function pickMerchQuantity(): number {
  return rand() < 0.34 ? 1 : 2;
}

const MERCH_ITEMS: {
  desc: string;
  price: number;
  weight: number;
  category: MerchProductCategory;
}[] = [
  { desc: "Футболка домашняя", price: 3500, weight: 14, category: "jerseys" },
  { desc: "Футболка гостевая", price: 3500, weight: 12, category: "jerseys" },
  { desc: "Шарф клубный", price: 1500, weight: 18, category: "accessories" },
  { desc: "Кепка с логотипом", price: 2200, weight: 11, category: "accessories" },
  { desc: "Хоккейная клюшка mini", price: 2800, weight: 5, category: "jerseys" },
  { desc: "Детская форма", price: 4000, weight: 9, category: "jerseys" },
  { desc: "Термокружка", price: 1200, weight: 13, category: "drinkware" },
  { desc: "Свитшот с капюшоном", price: 5500, weight: 10, category: "apparel" },
  { desc: "Джерси игровое", price: 8500, weight: 6, category: "jerseys" },
  { desc: "Шапка зимняя", price: 1800, weight: 12, category: "accessories" },
  { desc: "Брелок клубный", price: 450, weight: 8, category: "souvenirs" },
  { desc: "Значок клубный", price: 350, weight: 7, category: "souvenirs" },
  { desc: "Носки хоккейные", price: 900, weight: 10, category: "jerseys" },
  { desc: "Рюкзак клубный", price: 4200, weight: 7, category: "accessories" },
  { desc: "Плед с эмблемой", price: 3200, weight: 6, category: "accessories" },
  { desc: "Кружка керамическая", price: 800, weight: 9, category: "drinkware" },
  { desc: "Автошторка", price: 1100, weight: 5, category: "accessories" },
  { desc: "Варежки детские", price: 1400, weight: 8, category: "apparel" },
  { desc: "Футболка поло", price: 3800, weight: 8, category: "jerseys" },
  { desc: "Шорты тренировочные", price: 2600, weight: 6, category: "jerseys" },
];

function pickMerchItem(): (typeof MERCH_ITEMS)[number] {
  const total = MERCH_ITEMS.reduce((sum, item) => sum + item.weight, 0);
  let roll = rand() * total;

  for (const item of MERCH_ITEMS) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }

  return MERCH_ITEMS[MERCH_ITEMS.length - 1];
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function getMatchClass(
  opponent: string,
  tournamentStage: Match["tournamentStage"],
  league: League,
): MatchClass {
  if (DERBY_OPPONENTS.has(opponent)) return "derby";
  if (tournamentStage === "playoff" || opponent === "Шанхай") return "special";
  if (league === "KHL" && rand() < 0.12) return "special";
  if (league !== "KHL" && rand() < 0.08) return "special";
  return "regular";
}

function randomInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function buildSeasonMatches({
  season,
  start,
  end,
  idOffset,
  schedules,
}: SeasonDefinition): Match[] {
  const seasonMatches: Match[] = [];
  let nextId = idOffset;

  for (const schedule of schedules) {
    const matchCount = schedule.opponents.length;

    for (let i = 0; i < schedule.opponents.length; i += 1) {
      const opponent = schedule.opponents[i];
      const date = getMatchDate(i, matchCount, start, end);
      const eventCompleted = isEventCompleted(date);
      const fillFactor = 0.55 + rand() * 0.4;
      const attendance = eventCompleted
        ? Math.round(schedule.capacity * fillFactor)
        : 0;

      const tournamentStage = schedule.getTournamentStage(i, matchCount);

      seasonMatches.push({
        id: `match-${nextId++}`,
        date,
        opponent,
        attendance,
        capacity: schedule.capacity,
        eventCompleted,
        season,
        league: schedule.league,
        tournamentStage,
        matchClass: getMatchClass(opponent, tournamentStage, schedule.league),
        arena: schedule.arena,
      });
    }
  }

  return seasonMatches;
}

function generateMatches(): Match[] {
  return SEASON_DEFINITIONS.flatMap(buildSeasonMatches);
}

function pickOrderSource(): OrderSource {
  const roll = rand();
  if (roll < 0.4) return "official_site";
  if (roll < 0.65) return "box_office";
  return "yandex_afisha";
}

function applyLoyaltyDiscount(grossAmount: number): {
  amount: number;
  loyaltyDiscount: number;
} {
  if (grossAmount <= 0) {
    return { amount: 0, loyaltyDiscount: 0 };
  }
  if (rand() > 0.32) {
    return { amount: grossAmount, loyaltyDiscount: 0 };
  }
  const discountPct = [5, 10, 15][randomInt(0, 2)];
  const loyaltyDiscount = Math.round(grossAmount * (discountPct / 100));
  return {
    amount: grossAmount - loyaltyDiscount,
    loyaltyDiscount,
  };
}

function resolveTicketPayment(
  grossAmount: number,
  revenueLeft: number,
): { amount: number; loyaltyDiscount: number } {
  if (grossAmount <= 0 || revenueLeft <= 0) {
    return { amount: 0, loyaltyDiscount: 0 };
  }

  const discounted = applyLoyaltyDiscount(grossAmount);
  if (discounted.amount <= revenueLeft) {
    return discounted;
  }

  return {
    amount: Math.min(grossAmount, revenueLeft),
    loyaltyDiscount: 0,
  };
}

const TICKET_SALES_WINDOW_DAYS = 21;
const TICKET_PLAN_FILL_RATE = 0.82;
const TICKET_PLAN_AVG_PRICE = 1750;

const HIGH_DEMAND_OPPONENTS = new Set(["Ак Барс", "Локомотив", "Трактор"]);
const LOW_DEMAND_OPPONENTS = new Set(["Сочи", "Торпедо"]);

function getOpponentSalesFactor(opponent: string): number {
  if (HIGH_DEMAND_OPPONENTS.has(opponent)) {
    return 1.1 + rand() * 0.08;
  }
  if (LOW_DEMAND_OPPONENTS.has(opponent)) {
    return 0.5 + rand() * 0.06;
  }
  return 0.78 + rand() * 0.14;
}

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
      const { amount, loyaltyDiscount } = resolveTicketPayment(gross, revenueLeft);
      if (amount <= 0) break;

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
        loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
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
    const { amount, loyaltyDiscount } = resolveTicketPayment(gross, revenueLeft);
    if (amount <= 0) break;

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
      loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
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

function getLeagueTicketProfile(league: League): { avgPrice: number } {
  switch (league) {
    case "VHL":
      return { avgPrice: 1100 };
    case "MHL":
      return { avgPrice: 700 };
    default:
      return { avgPrice: TICKET_PLAN_AVG_PRICE };
  }
}

function generateMatchTicketSales(
  match: Match,
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const leagueProfile = getLeagueTicketProfile(match.league);
  const matchVariance = 0.9 + rand() * 0.12;
  const revenueVariance = 0.92 + rand() * 0.1;
  const opponentFactor = getOpponentSalesFactor(match.opponent);
  const targetTickets = Math.min(
    match.capacity,
    Math.round(
      match.capacity *
        TICKET_PLAN_FILL_RATE *
        matchVariance *
        opponentFactor,
    ),
  );
  const targetRevenue = Math.round(
    targetTickets * leagueProfile.avgPrice * revenueVariance,
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

function generateTransactions(allMatches: Match[]): Transaction[] {
  const transactions: Transaction[] = [];
  let id = 1;

  for (const match of allMatches) {
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

    const merchCount =
      match.league === "KHL"
        ? randomInt(55, 95)
        : match.league === "VHL"
          ? randomInt(18, 32)
          : randomInt(12, 22);
    for (let m = 0; m < merchCount; m++) {
      const item = pickMerchItem();
      const qty = pickMerchQuantity();
      const merchSalesPoint = pickMerchSalesPoint();
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
        productCategory: item.category,
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
          productCategory: item.category,
          isReturn: true,
        });
      }
    }

  }

  const offMatchMerchSales = generateOffMatchMerchSales(id);
  transactions.push(...offMatchMerchSales.txs);
  id = offMatchMerchSales.nextId;

  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

const subscriptionPlans: SubscriptionPlan[] = [
  { id: "plan-1", code: "SUB-5-A", name: "Абонемент на 5 матчей (сектор A)", matchCount: 5, price: 10000 },
  { id: "plan-2", code: "SUB-5-B", name: "Абонемент на 5 матчей (сектор B)", matchCount: 5, price: 7500 },
  { id: "plan-3", code: "SUB-10-A", name: "Абонемент на 10 матчей", matchCount: 10, price: 18000 },
  { id: "plan-4", code: "SUB-SEASON", name: "Сезонный абонемент", matchCount: 30, price: 85000 },
  { id: "plan-5", code: "SUB-VIP", name: "VIP-сезонный абонемент", matchCount: 30, price: 250000 },
  { id: "plan-6", code: "SUB-STUD", name: "Студенческий абонемент", matchCount: 10, price: 6000 },
];

function generateSubscriptions(allMatches: Match[]): Subscription[] {
  const subs: Subscription[] = [];
  let id = 1;

  for (let i = 0; i < 85; i++) {
    const plan = randomPick(subscriptionPlans);
    const tournamentStage: Subscription["tournamentStage"] =
      rand() > 0.45 ? "regular" : "playoff";
    const stageMatches = allMatches.filter(
      (m) => m.tournamentStage === tournamentStage,
    );
    const match = randomPick(stageMatches.length > 0 ? stageMatches : allMatches);
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

export function generateMockData(): {
  matches: Match[];
  transactions: Transaction[];
  subscriptions: Subscription[];
} {
  const matches = generateMatches();
  const transactions = generateTransactions(matches);
  const subscriptions = generateSubscriptions(matches);
  return { matches, transactions, subscriptions };
}

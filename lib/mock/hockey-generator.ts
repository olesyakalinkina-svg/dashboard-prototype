import { addDays, differenceInCalendarDays, isSameDay, startOfDay, subDays } from "date-fns";
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
  Sector,
  Subscription,
  SubscriptionPlan,
  SubscriptionRedemption,
  TicketType,
  Transaction,
  TicketSalesProfile,
  TicketSalesTempo,
} from "@/types/dashboard";
import {
  ALL_PRICE_ZONES,
  ALL_SECTORS,
  priceZoneFromUnitPrice,
} from "@/lib/ticket-filter-options";
import {
  getPreviousCampaignConfig,
  getSeasonTicketCampaignConfigs,
} from "@/lib/subscription-campaign/campaigns";
import {
  getCampaignDayNumber,
  parseCalendarDate,
  toCalendarDateKey,
} from "@/lib/subscription-campaign/dates";
import {
  COMPLETED_MATCH_OVERLAP_COUNT,
  TICKET_SALES_WINDOW_MAX_DAYS,
  TICKET_SALES_WINDOW_MIN_DAYS,
  alignCompletedMatchSalesWindows,
  alignNearestUpcomingMatchSalesWindows,
  getMatchTicketSalesWindowDays,
} from "@/lib/ticket-sales-window";
import { getMerchListAmount } from "@/lib/merch-catalog";
import {
  getMatchPlanRevenue,
  getMatchTicketPlanProfile,
  getKhlPlanAvgPrice,
  getMhlPlanAvgPrice,
  getVhlPlanAvgPrice,
  MAIN_ARENA_CAPACITY,
  MHL_ARENA_CAPACITY,
  SECONDARY_ARENA_CAPACITY,
  TICKET_PLAN_AVG_PRICE,
} from "@/lib/ticket-plan";
const HOME_ARENA: ArenaId = "main";
const KHL_MATCH_COUNT = 16;
const VHL_MATCH_COUNT = 8;
const MHL_MATCH_COUNT = 8;

export const PREV_SEASON_START = new Date(2024, 8, 1);
export const PREV_SEASON_END = new Date(2025, 4, 31);
export const SEASON_START = new Date(2025, 8, 1);
export const SEASON_END = new Date(2026, 4, 31);
export const MOCK_TODAY = new Date(2026, 4, 15);
export const SUBSCRIPTIONS_PERIOD_START = new Date(2025, 7, 25);
export const SUBSCRIPTIONS_PERIOD_END = new Date(2025, 8, 15);
/** Analogous regular sales window one season earlier (for 2024/25 YoY). */
export const PREV_SUBSCRIPTIONS_PERIOD_START = new Date(2024, 7, 25);
export const PREV_SUBSCRIPTIONS_PERIOD_END = new Date(2024, 8, 15);
/** Playoff stage = final 60 calendar days of each season (inclusive). */
export const PLAYOFF_WINDOW_DAYS = 60;

export function getPlayoffWindowStart(seasonEnd: Date): Date {
  return startOfDay(subDays(seasonEnd, PLAYOFF_WINDOW_DAYS - 1));
}

/** Days before the first playoff match when playoff subscription sales open. */
export const PLAYOFF_SUBSCRIPTION_SALES_LEAD_DAYS = 21;

export function getFirstPlayoffMatchDate(
  matches: Match[],
  season: string,
): Date | null {
  const playoffMatches = matches
    .filter(
      (match) => match.season === season && match.matchClass === "playoff",
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  return playoffMatches[0]?.date ?? null;
}

/** Playoff subscription sales: 21 days before first playoff match through day before it. */
export function getPlayoffSubscriptionSalesWindow(firstPlayoffMatch: Date): {
  start: Date;
  end: Date;
} {
  const firstMatchDay = startOfDay(firstPlayoffMatch);
  return {
    start: startOfDay(
      subDays(firstMatchDay, PLAYOFF_SUBSCRIPTION_SALES_LEAD_DAYS),
    ),
    end: startOfDay(subDays(firstMatchDay, 1)),
  };
}

export function isInPlayoffWindow(matchDate: Date, seasonEnd: Date): boolean {
  const matchDay = startOfDay(matchDate);
  const seasonEndDay = startOfDay(seasonEnd);
  const playoffStart = getPlayoffWindowStart(seasonEnd);
  return matchDay >= playoffStart && matchDay <= seasonEndDay;
}

export function getTournamentStageFromClass(
  matchClass: MatchClass,
): Match["tournamentStage"] {
  return matchClass === "playoff" ? "playoff" : "regular";
}

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

function randomDateInWindow(
  windowStart: Date,
  windowEnd: Date,
  preferStart?: Date,
  preferEnd?: Date,
): Date {
  const start = startOfDay(windowStart);
  const end = startOfDay(windowEnd);
  if (start > end) return start;

  if (preferStart && preferEnd) {
    const overlapStart =
      startOfDay(preferStart) > start ? startOfDay(preferStart) : start;
    const overlapEnd =
      startOfDay(preferEnd) < end ? startOfDay(preferEnd) : end;

    if (overlapStart <= overlapEnd && rand() > 0.3) {
      return randomDateInSeasonRange(overlapStart, overlapEnd);
    }
  }

  return randomDateInSeasonRange(start, end);
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
  "Динамо Минск",
  "Спартак",
  "Сибирь",
  "Амур",
  "Сочи",
  "Торпедо",
  "Динамо Мск",
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
};

const KHL_MATCH_CLASS_BY_OPPONENT: Record<string, MatchClass> = {
  Шанхай: "class_2",
  Торпедо: "class_3",
  Сочи: "class_3",
  Амур: "class_3",
  Сибирь: "class_2",
  Спартак: "class_2",
  "Динамо Минск": "class_1",
  "Динамо Мск": "class_1",
  "Салават Юлаев": "class_2",
  Металлург: "class_1",
  Трактор: "class_1",
  Локомотив: "class_1",
  "Ак Барс": "class_1",
  Авангард: "class_1",
  ЦСКА: "class_2",
  СКА: "class_1",
};

const VHL_MATCH_CLASS_BY_OPPONENT: Record<string, MatchClass> = {
  Торос: "class_1",
  Нефтяник: "class_1",
  Рубин: "class_2",
  Ижсталь: "class_2",
  Химик: "class_2",
  Звезда: "class_3",
  "СКА-ВМФ": "class_3",
  Дизель: "class_3",
};

const MHL_MATCH_CLASS_BY_OPPONENT: Record<string, MatchClass> = {
  "Красная Армия": "class_1",
  Алмаз: "class_1",
  Чайка: "class_2",
  "СКА-1946": "class_2",
  "МХК Спартак": "class_2",
  Капитан: "class_3",
  Локо: "class_3",
  Молот: "class_3",
};

const CURRENT_SEASON_SCHEDULES: LeagueSchedule[] = [
  {
    league: "KHL",
    arena: HOME_ARENA,
    capacity: MAIN_ARENA_CAPACITY,
    opponents: OPPONENTS,
  },
  {
    league: "VHL",
    arena: "secondary",
    capacity: SECONDARY_ARENA_CAPACITY,
    opponents: VHL_OPPONENTS,
  },
  {
    league: "MHL",
    arena: HOME_ARENA,
    capacity: MHL_ARENA_CAPACITY,
    opponents: MHL_OPPONENTS,
  },
];

const PREV_SEASON_SCHEDULES: LeagueSchedule[] = [
  {
    league: "KHL",
    arena: HOME_ARENA,
    capacity: MAIN_ARENA_CAPACITY,
    opponents: PREV_SEASON_OPPONENTS,
  },
  {
    league: "VHL",
    arena: "secondary",
    capacity: SECONDARY_ARENA_CAPACITY,
    opponents: VHL_OPPONENTS,
  },
  {
    league: "MHL",
    arena: HOME_ARENA,
    capacity: MHL_ARENA_CAPACITY,
    opponents: MHL_OPPONENTS,
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

const MAX_TICKET_UNIT_PRICE = 6000;

/**
 * Price range (min, max) per sector tier.
 * VIP is always ≥ 4000, so it never falls below the top price zone.
 */
const SECTOR_PRICE_RANGE: Record<Sector, [number, number]> = {
  A:   [2500, 3500],
  B1:  [1800, 2800],
  B2:  [1800, 2700],
  B3:  [1800, 2600],
  B4:  [1800, 2500],
  C1:  [1300, 1800],
  C2:  [1300, 1750],
  C3:  [1300, 1700],
  C4:  [1300, 1650],
  D1:  [800, 1400],
  D2:  [800, 1350],
  D3:  [800, 1300],
  D4:  [800, 1250],
  VIP: [4000, 6000],
};

/**
 * Returns a random unit price for a sector, scaled by a league/class factor.
 * The sector range is the base (KHL class_2); other leagues/classes scale it.
 */
function randomUnitPriceForSector(
  sector: Sector,
  league: League,
  matchClass: MatchClass = "class_2",
): number {
  const [minBase, maxBase] = SECTOR_PRICE_RANGE[sector];
  let scaleFactor: number;
  switch (league) {
    case "VHL":
      scaleFactor = getVhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE;
      break;
    case "MHL":
      scaleFactor = getMhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE;
      break;
    default:
      scaleFactor = getKhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE;
  }
  // VIP always stays in the top zone regardless of scale factor
  if (sector === "VIP") {
    const min = 4000;
    const max = MAX_TICKET_UNIT_PRICE;
    return Math.round(min + rand() * (max - min));
  }
  const min = Math.round(minBase * scaleFactor);
  const max = Math.round(maxBase * scaleFactor);
  return Math.min(MAX_TICKET_UNIT_PRICE, Math.round(min + rand() * (max - min)));
}

const ORDER_SOURCES: OrderSource[] = [
  "box_office",
  "official_site",
  "yandex_afisha",
];

const MATCH_MERCH_MALL_WEIGHTS: { point: MerchSalesPoint; weight: number }[] = [
  { point: "mall_raduga", weight: 2 },
  { point: "mall_continent", weight: 2 },
];

/** Arena-channel mixes (sum 82). Mall stays last so match-table totals stay stable. */
const MATCH_MERCH_ARENA_PROFILES: {
  flagship: number;
  arena_north: number;
  arena_south: number;
}[] = [
  { flagship: 70, arena_north: 6, arena_south: 6 },
  { flagship: 18, arena_north: 50, arena_south: 14 },
  { flagship: 16, arena_north: 14, arena_south: 52 },
  { flagship: 28, arena_north: 27, arena_south: 27 },
];

const MATCH_MERCH_CATEGORY_PROFILES: Record<MerchProductCategory, number>[] = [
  { jerseys: 2.4, souvenirs: 0.7, drinkware: 0.8, apparel: 0.6, accessories: 0.7 },
  { jerseys: 0.6, souvenirs: 2.2, drinkware: 0.7, apparel: 0.8, accessories: 0.9 },
  { jerseys: 0.7, souvenirs: 0.6, drinkware: 0.8, apparel: 2.4, accessories: 0.7 },
  { jerseys: 0.8, souvenirs: 0.7, drinkware: 0.6, apparel: 0.7, accessories: 2.3 },
];

function hashMatchId(matchId: string): number {
  let hash = 0;
  for (let i = 0; i < matchId.length; i += 1) {
    hash = (hash * 31 + matchId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

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

function pickMerchSalesPointForMatch(matchId: string): MerchSalesPoint {
  const profile =
    MATCH_MERCH_ARENA_PROFILES[
      hashMatchId(matchId) % MATCH_MERCH_ARENA_PROFILES.length
    ];
  return pickWeightedMerchSalesPoint([
    { point: "flagship", weight: profile.flagship },
    { point: "arena_north", weight: profile.arena_north },
    { point: "arena_south", weight: profile.arena_south },
    ...MATCH_MERCH_MALL_WEIGHTS,
  ]);
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
      const payment = resolveMerchPayment(item, qty);
      const costAmount = Math.round(payment.amount * (0.35 + rand() * 0.2));
      txs.push({
        id: `tx-${id++}`,
        date: randomDateInSeasonRange(PREV_SEASON_START, MOCK_TODAY),
        stream: "merch",
        description: item.desc,
        matchId: null,
        channel: channel.point === "online_store" ? "online" : "kiosk",
        amount: payment.amount,
        quantity: qty,
        listUnitPrice: payment.listUnitPrice,
        loyaltyDiscount: payment.loyaltyDiscount,
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

function resolveMerchPayment(
  item: (typeof MERCH_ITEMS)[number],
  qty: number,
): {
  amount: number;
  listUnitPrice: number;
  loyaltyDiscount?: number;
} {
  const listUnitPrice = item.price;
  const gross = listUnitPrice * qty;
  const { amount, loyaltyDiscount } = applyLoyaltyDiscount(gross);
  return {
    amount,
    listUnitPrice,
    loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
  };
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
  { desc: "Варежки детские", price: 1400, weight: 8, category: "apparel" },
  { desc: "Футболка поло", price: 3800, weight: 8, category: "jerseys" },
  { desc: "Шорты тренировочные", price: 2600, weight: 6, category: "jerseys" },
];

function pickMerchItem(): (typeof MERCH_ITEMS)[number] {
  return pickMerchItemFromWeights(MERCH_ITEMS);
}

function pickMerchItemForMatch(matchId: string): (typeof MERCH_ITEMS)[number] {
  const profile =
    MATCH_MERCH_CATEGORY_PROFILES[
      hashMatchId(matchId) % MATCH_MERCH_CATEGORY_PROFILES.length
    ];
  return pickMerchItemFromWeights(
    MERCH_ITEMS.map((item) => ({
      ...item,
      weight: item.weight * profile[item.category],
    })),
  );
}

function pickMerchItemFromWeights(
  items: readonly (typeof MERCH_ITEMS)[number][],
): (typeof MERCH_ITEMS)[number] {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rand() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function getBaseMatchClass(opponent: string, league: League): MatchClass {
  switch (league) {
    case "VHL":
      return VHL_MATCH_CLASS_BY_OPPONENT[opponent] ?? "class_2";
    case "MHL":
      return MHL_MATCH_CLASS_BY_OPPONENT[opponent] ?? "class_2";
    default:
      return KHL_MATCH_CLASS_BY_OPPONENT[opponent] ?? "class_2";
  }
}

/** Matches in the playoff window: later half become class «Плей-офф». */
function assignPlayoffClasses(matches: Match[]): void {
  const seasonBounds = new Map(
    SEASON_DEFINITIONS.map((def) => [def.season, def.end] as const),
  );

  for (const [season, seasonEnd] of seasonBounds) {
    for (const league of ["KHL", "VHL", "MHL"] as const) {
      const candidates = matches
        .filter(
          (match) =>
            match.league === league &&
            match.season === season &&
            isInPlayoffWindow(match.date, seasonEnd),
        )
        .sort((left, right) => left.date.getTime() - right.date.getTime());

      if (candidates.length === 0) continue;

      const playoffCount = Math.max(1, Math.ceil(candidates.length / 2));
      for (const match of candidates.slice(-playoffCount)) {
        match.matchClass = "playoff";
      }
    }
  }
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

      const matchClass = getBaseMatchClass(opponent, schedule.league);

      seasonMatches.push({
        id: `match-${nextId++}`,
        date,
        opponent,
        attendance,
        capacity: schedule.capacity,
        eventCompleted,
        season,
        league: schedule.league,
        tournamentStage: getTournamentStageFromClass(matchClass),
        matchClass,
        arena: schedule.arena,
        ticketSalesWindowDays: randomInt(
          TICKET_SALES_WINDOW_MIN_DAYS,
          TICKET_SALES_WINDOW_MAX_DAYS,
        ),
      });
    }
  }

  return seasonMatches;
}

/** Fixed KHL match dates for the current season (2025/26). */
const CURRENT_SEASON_KHL_MATCH_DATES: Record<string, Date> = {
  "Ак Барс": new Date(2025, 8, 29),
  "Локомотив": new Date(2025, 9, 5),
  "Трактор": new Date(2025, 9, 29),
  "Металлург": new Date(2025, 10, 7),
  "Салават Юлаев": new Date(2025, 11, 1),
};

function applyCurrentSeasonKhlMatchDates(matches: Match[]): void {
  for (const match of matches) {
    if (match.season !== "2025/26" || match.league !== "KHL") continue;

    const override = CURRENT_SEASON_KHL_MATCH_DATES[match.opponent];
    if (!override) continue;

    match.date = startOfDay(override);
    match.eventCompleted = isEventCompleted(match.date);
    if (!match.eventCompleted) {
      match.attendance = 0;
    }
  }
}

/**
 * Upcoming playoff demo: two Динамо Мск home games on different dates.
 * match-16 (originally Shanghai) becomes Динамо Мск on 17.05.2026;
 * match-15 stays Динамо Мск on 15.05.2026.
 */
function applyUpcomingDynamoPlayoffDates(matches: Match[]): void {
  const season = "2025/26";
  const isCurrentKhl = (match: Match) =>
    match.season === season && match.league === "KHL";

  const match16 = matches.find(
    (match) => isCurrentKhl(match) && match.id === "match-16",
  );
  const match15 = matches.find(
    (match) => isCurrentKhl(match) && match.id === "match-15",
  );

  if (match16) {
    match16.opponent = "Динамо Мск";
    match16.date = startOfDay(new Date(2026, 4, 17));
    match16.eventCompleted = isEventCompleted(match16.date);
    if (!match16.eventCompleted) {
      match16.attendance = 0;
    }
    match16.matchClass = "playoff";
    match16.tournamentStage = "playoff";
  }

  if (match15) {
    match15.opponent = "Динамо Мск";
    match15.date = startOfDay(new Date(2026, 4, 15));
    match15.eventCompleted = isEventCompleted(match15.date);
    if (!match15.eventCompleted) {
      match15.attendance = 0;
    }
    match15.matchClass = "playoff";
    match15.tournamentStage = "playoff";
  }
}

/** Spacing between clustered match days so 10–16 day windows can share a start. */
const COMPLETED_KHL_CLUSTER_DAY_SPACING = 2;

/**
 * Pulls the earliest completed KHL matches in a season onto nearby calendar days
 * so their ticket sales windows can be aligned to the same start date.
 */
function clusterCompletedKhlMatchDates(
  matches: Match[],
  season = "2025/26",
  clusterSize = COMPLETED_MATCH_OVERLAP_COUNT,
): void {
  const cluster = matches
    .filter(
      (match) =>
        match.league === "KHL" &&
        match.season === season &&
        match.eventCompleted,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(0, clusterSize);

  if (cluster.length < 2) return;

  const anchorDate = startOfDay(cluster[0].date);
  for (let index = 0; index < cluster.length; index += 1) {
    cluster[index].date = addDays(
      anchorDate,
      index * COMPLETED_KHL_CLUSTER_DAY_SPACING,
    );
  }
}

function applyTournamentStages(matches: Match[]): void {
  for (const match of matches) {
    match.tournamentStage = getTournamentStageFromClass(match.matchClass);
  }
}

function applyMatchClasses(matches: Match[]): void {
  for (const match of matches) {
    match.matchClass = getBaseMatchClass(match.opponent, match.league);
  }
  assignPlayoffClasses(matches);
}

function generateMatches(): Match[] {
  const allMatches = SEASON_DEFINITIONS.flatMap(buildSeasonMatches);
  clusterCompletedKhlMatchDates(allMatches);
  applyMatchClasses(allMatches);
  applyTournamentStages(allMatches);
  alignCompletedMatchSalesWindows(allMatches);
  alignNearestUpcomingMatchSalesWindows(allMatches);
  applyCurrentSeasonKhlMatchDates(allMatches);
  applyUpcomingDynamoPlayoffDates(allMatches);
  applyTicketChartDemoProfiles(allMatches);
  return allMatches;
}

function buildTicketSalesDailyWeights(
  saleDayCount: number,
  tempo?: TicketSalesTempo,
): number[] {
  if (!tempo || tempo === "steady") {
    return Array.from({ length: saleDayCount }, () => 0.8 + rand() * 0.4);
  }

  return Array.from({ length: saleDayCount }, (_, index) => {
    const t = saleDayCount <= 1 ? 0.5 : index / (saleDayCount - 1);
    switch (tempo) {
      case "front_loaded":
        return 1.35 - t * 0.75;
      case "back_loaded":
        return 0.55 + t * 0.85;
      case "slow_start":
        return t < 0.45 ? 0.35 + t * 0.5 : 1.15;
      default:
        return 0.8 + rand() * 0.4;
    }
  });
}

/**
 * Tunes a handful of matches so the season match dynamics chart has clear demo
 * scenarios: shared sales starts, ahead/behind/on-track fulfillment, and
 * different sales tempos.
 */
function applyTicketChartDemoProfiles(matches: Match[]): void {
  const completedKhl = matches
    .filter(
      (match) =>
        match.league === "KHL" &&
        match.season === "2025/26" &&
        match.eventCompleted,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(0, COMPLETED_MATCH_OVERLAP_COUNT);

  const completedProfiles: TicketSalesProfile[] = [
    { fulfillmentFactor: 1.06, tempo: "front_loaded" },
    { fulfillmentFactor: 1.05, tempo: "slow_start" },
    { fulfillmentFactor: 1.08, tempo: "back_loaded" },
  ];

  const completedKhlIds = new Set(completedKhl.map((match) => match.id));

  completedKhl.forEach((match, index) => {
    match.ticketSalesProfile = completedProfiles[index];
  });

  const otherCompletedKhlProfiles: TicketSalesProfile[] = [
    { fulfillmentFactor: 0.88, tempo: "steady" },
    { fulfillmentFactor: 0.91, tempo: "front_loaded" },
    { fulfillmentFactor: 0.86, tempo: "slow_start" },
    { fulfillmentFactor: 0.93, tempo: "back_loaded" },
    { fulfillmentFactor: 0.89, tempo: "steady" },
    { fulfillmentFactor: 0.87, tempo: "front_loaded" },
    { fulfillmentFactor: 0.9, tempo: "slow_start" },
    { fulfillmentFactor: 0.85, tempo: "back_loaded" },
    { fulfillmentFactor: 0.92, tempo: "steady" },
    { fulfillmentFactor: 0.84, tempo: "front_loaded" },
    { fulfillmentFactor: 0.88, tempo: "slow_start" },
    { fulfillmentFactor: 0.9, tempo: "back_loaded" },
  ];

  matches
    .filter(
      (match) =>
        match.league === "KHL" &&
        match.season === "2025/26" &&
        match.eventCompleted &&
        !completedKhlIds.has(match.id),
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .forEach((match, index) => {
      match.ticketSalesProfile =
        otherCompletedKhlProfiles[index % otherCompletedKhlProfiles.length];
    });

  const inSaleDemoMatch = matches.find(
    (match) =>
      match.id === "match-16" &&
      match.season === "2025/26" &&
      match.league === "KHL",
  );
  const secondUpcomingDemoMatch = matches.find(
    (match) =>
      match.id === "match-15" &&
      match.season === "2025/26" &&
      match.league === "KHL",
  );

  if (inSaleDemoMatch) {
    // In-sale demo: sales window opens before MOCK_TODAY so presale txs exist
    // through mock today (partial curve; match still upcoming).
    inSaleDemoMatch.date = startOfDay(new Date(2026, 4, 17));
    inSaleDemoMatch.ticketSalesWindowDays = TICKET_SALES_WINDOW_MAX_DAYS;
    inSaleDemoMatch.ticketSalesProfile = {
      fulfillmentFactor: 0.88,
      tempo: "steady",
    };
  }
  if (secondUpcomingDemoMatch) {
    secondUpcomingDemoMatch.ticketSalesProfile = {
      fulfillmentFactor: 1.03,
      tempo: "front_loaded",
    };
  }
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

const HIGH_DEMAND_OPPONENTS = new Set(["Ак Барс", "Локомотив", "Трактор"]);
const LOW_DEMAND_OPPONENTS = new Set(["Сочи", "Торпедо"]);

/** Small opponent variance so fact stays within ~90–98% of plan. */
function getOpponentSalesFactor(opponent: string, matchClass: MatchClass): number {
  if (matchClass === "playoff") {
    return 0.96 + rand() * 0.06;
  }
  if (HIGH_DEMAND_OPPONENTS.has(opponent)) {
    return 1.02 + rand() * 0.04;
  }
  if (LOW_DEMAND_OPPONENTS.has(opponent)) {
    return 0.92 + rand() * 0.04;
  }
  return 0.96 + rand() * 0.06;
}

/**
 * Returns the midpoint of the sector's price range scaled for league/class,
 * used only for the "closestSector" heuristic when filling the last batch.
 */
function sectorMidPrice(
  sector: Sector,
  league: League,
  matchClass: MatchClass = "class_2",
): number {
  if (sector === "VIP") return 5000;
  const [min, max] = SECTOR_PRICE_RANGE[sector];
  const mid = (min + max) / 2;
  let scaleFactor: number;
  switch (league) {
    case "VHL":
      scaleFactor = getVhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE;
      break;
    case "MHL":
      scaleFactor = getMhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE;
      break;
    default:
      scaleFactor = getKhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE;
  }
  return Math.min(MAX_TICKET_UNIT_PRICE, Math.round(mid * scaleFactor));
}

function closestSector(
  targetPrice: number,
  league: League = "KHL",
  matchClass: MatchClass = "class_2",
): Sector {
  return ALL_SECTORS.reduce((best, zone) =>
    Math.abs(sectorMidPrice(zone, league, matchClass) - targetPrice) <
    Math.abs(sectorMidPrice(best, league, matchClass) - targetPrice)
      ? zone
      : best,
  ALL_SECTORS[0]);
}

function randomSaleDate(match: Match, explicit?: Date): Date {
  if (explicit) return explicit;

  const salesWindowDays = getMatchTicketSalesWindowDays(match);
  const saleEnd = match.date > MOCK_TODAY ? MOCK_TODAY : match.date;
  const saleStart = subDays(saleEnd, salesWindowDays - 1);
  const span = Math.max(0, differenceInCalendarDays(saleEnd, saleStart));
  return subDays(saleEnd, randomInt(0, span));
}

function buildDayTicketSales(
  matchId: string,
  saleDate: Date,
  startId: number,
  ticketTarget: number,
  revenueTarget: number,
  league: League,
  matchClass: MatchClass = "class_2",
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
      const sector = closestSector(
        Math.round(revenueLeft / ticketsLeft),
        league,
        matchClass,
      );
      const unitPrice = randomUnitPriceForSector(sector, league, matchClass);
      const qty = ticketsLeft;
      const gross = unitPrice * qty;
      const { amount, loyaltyDiscount } = resolveTicketPayment(gross, revenueLeft);
      if (amount <= 0) break;

      const orderSource = pickOrderSource();
      txs.push({
        id: `tx-${id++}`,
        date: saleDate,
        stream: "tickets",
        description: `Билет на арену, сектор ${sector}`,
        matchId,
        channel: orderSource === "box_office" ? "arena" : "online",
        amount,
        quantity: qty,
        loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
        sector,
        ticketType: "arena",
        priceZone: priceZoneFromUnitPrice(unitPrice),
        orderSource,
      });
      break;
    }

    const sector = randomPick(ALL_SECTORS);
    const unitPrice = randomUnitPriceForSector(sector, league, matchClass);
    const qty = Math.min(randomInt(1, 4), ticketsLeft);
    const gross = unitPrice * qty;
    const { amount, loyaltyDiscount } = resolveTicketPayment(gross, revenueLeft);
    if (amount <= 0) break;

    const orderSource = pickOrderSource();
    txs.push({
      id: `tx-${id++}`,
      date: saleDate,
      stream: "tickets",
      description: `Билет на арену, сектор ${sector}`,
      matchId,
      channel: orderSource === "box_office" ? "arena" : "online",
      amount,
      quantity: qty,
      loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
      sector,
      ticketType: "arena",
      priceZone: priceZoneFromUnitPrice(unitPrice),
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
  const planProfile = getMatchTicketPlanProfile(match);
  const planTickets = Math.round(match.capacity * planProfile.fillRate);
  const planRevenue = getMatchPlanRevenue(match);
  const profile = match.ticketSalesProfile;
  const fulfillmentFactor =
    profile?.fulfillmentFactor ?? 0.9 + rand() * 0.08;
  const opponentFactor = getOpponentSalesFactor(match.opponent, match.matchClass);
  const targetRevenue = Math.round(
    planRevenue * fulfillmentFactor * opponentFactor * (0.97 + rand() * 0.05),
  );
  const targetTickets = Math.min(
    match.capacity,
    Math.round(planTickets * fulfillmentFactor * opponentFactor),
  );

  const salesWindowDays = getMatchTicketSalesWindowDays(match);
  const saleDayCount = salesWindowDays + 1;
  const dailyWeights = buildTicketSalesDailyWeights(saleDayCount, profile?.tempo);
  const weightSum = dailyWeights.reduce((sum, weight) => sum + weight, 0);

  const txs: Transaction[] = [];
  let id = startId;
  let allocatedTickets = 0;
  let allocatedRevenue = 0;

  for (let offset = salesWindowDays; offset >= 0; offset -= 1) {
    const saleDay = subDays(match.date, offset);
    if (saleDay > MOCK_TODAY) {
      continue;
    }

    const weightIndex = salesWindowDays - offset;
    const isLastDay = offset === 0;
    const dayTickets = isLastDay
      ? targetTickets - allocatedTickets
      : Math.round((targetTickets * dailyWeights[weightIndex]) / weightSum);
    const dayRevenue = isLastDay
      ? targetRevenue - allocatedRevenue
      : Math.round((targetRevenue * dailyWeights[weightIndex]) / weightSum);

    if (dayTickets > 0 && dayRevenue > 0) {
      const dayTxs = buildDayTicketSales(
        match.id,
        saleDay,
        id,
        dayTickets,
        dayRevenue,
        match.league,
        match.matchClass,
      );
      id += dayTxs.length;
      txs.push(...dayTxs);
      allocatedTickets += dayTxs.reduce((sum, tx) => sum + tx.quantity, 0);
      allocatedRevenue += dayTxs.reduce((sum, tx) => sum + tx.amount, 0);
    }
  }

  return { txs, nextId: id };
}

function isWithinTicketSalesWindow(match: Match, day: Date): boolean {
  const matchDay = startOfDay(match.date);
  const referenceDay = startOfDay(day);
  const daysUntilMatch = differenceInCalendarDays(matchDay, referenceDay);
  const salesWindowDays = getMatchTicketSalesWindowDays(match);
  return daysUntilMatch >= 0 && daysUntilMatch <= salesWindowDays;
}

function findUpcomingMatchInSalesWindow(
  allMatches: Match[],
  day: Date,
): Match | undefined {
  const referenceDay = startOfDay(day);
  return allMatches
    .filter(
      (match) =>
        !match.eventCompleted &&
        startOfDay(match.date) >= referenceDay &&
        isWithinTicketSalesWindow(match, referenceDay),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
}

function ensureMockTodayTicketSales(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const today = startOfDay(MOCK_TODAY);
  const hasTodayTickets = transactions.some(
    (tx) => tx.stream === "tickets" && isSameDay(startOfDay(tx.date), today),
  );
  if (hasTodayTickets) {
    return { txs: [], nextId: startId };
  }

  const upcomingMatch = findUpcomingMatchInSalesWindow(allMatches, today);

  if (!upcomingMatch) {
    return { txs: [], nextId: startId };
  }

  const planProfile = getMatchTicketPlanProfile(upcomingMatch);
  const tickets = randomInt(120, 280);
  const revenue = Math.round(
    tickets * planProfile.avgPrice * (0.95 + rand() * 0.08),
  );
  const dayTxs = buildDayTicketSales(
    upcomingMatch.id,
    today,
    startId,
    tickets,
    revenue,
    upcomingMatch.league,
    upcomingMatch.matchClass,
  );

  return { txs: dayTxs, nextId: startId + dayTxs.length };
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
      const sector = randomPick(ALL_SECTORS);
      const unitPrice = randomUnitPriceForSector(sector, match.league, match.matchClass);
      transactions.push({
        id: `tx-${id++}`,
        date: randomSaleDate(match),
        stream: "tickets",
        description: "Бесплатный билет",
        matchId: match.id,
        channel,
        amount: 0,
        quantity: qty,
        freeQuantity: qty,
        sector,
        ticketType: "arena",
        priceZone: priceZoneFromUnitPrice(unitPrice),
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
      const item = pickMerchItemForMatch(match.id);
      const qty = pickMerchQuantity();
      const merchSalesPoint = pickMerchSalesPointForMatch(match.id);
      const payment = resolveMerchPayment(item, qty);
      const costAmount = Math.round(payment.amount * (0.35 + rand() * 0.2));
      transactions.push({
        id: `tx-${id++}`,
        date: match.date,
        stream: "merch",
        description: item.desc,
        matchId: match.id,
        channel: "kiosk",
        amount: payment.amount,
        quantity: qty,
        listUnitPrice: payment.listUnitPrice,
        loyaltyDiscount: payment.loyaltyDiscount,
        merchSalesPoint,
        productCategory: item.category,
        costAmount,
      });

      if (rand() < 0.035) {
        const returnQty = randomInt(1, qty);
        const returnAmount = Math.round((payment.amount / qty) * returnQty);
        transactions.push({
          id: `tx-${id++}`,
          date: addDays(match.date, randomInt(1, 5)),
          stream: "merch",
          description: `Возврат: ${item.desc}`,
          matchId: match.id,
          channel: "kiosk",
          amount: returnAmount,
          quantity: returnQty,
          listUnitPrice: payment.listUnitPrice,
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

  const todayTicketSales = ensureMockTodayTicketSales(allMatches, transactions, id);
  transactions.push(...todayTicketSales.txs);
  id = todayTicketSales.nextId;

  const zoneCoverage = ensureTicketPriceZoneCoverage(
    allMatches,
    transactions,
    id,
  );
  transactions.push(...zoneCoverage.txs);

  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

const PRICE_ZONE_SEED_UNIT_PRICE: Record<PriceZone, number> = {
  up_to_1500: 900,
  from_1500_to_2500: 2000,
  from_2500_to_4000: 3200,
  from_4000_to_6000: 5000,
};

const NON_VIP_SEED_ZONES: PriceZone[] = [
  "up_to_1500",
  "from_1500_to_2500",
  "from_2500_to_4000",
];

const PRICE_ZONE_SEED_QUANTITY = 8;

/** Returns set of priceZones present per (matchId, sector) pair. */
function arenaPriceZonesBySectorAndMatch(
  transactions: Transaction[],
): Map<string, Set<PriceZone>> {
  const byKey = new Map<string, Set<PriceZone>>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena" || !tx.matchId) {
      continue;
    }
    if (!tx.priceZone || !tx.sector) continue;
    const key = `${tx.matchId}::${tx.sector}`;
    let zones = byKey.get(key);
    if (!zones) {
      zones = new Set();
      byKey.set(key, zones);
    }
    zones.add(tx.priceZone);
  }
  return byKey;
}

/** Returns all (matchId, sector) pairs that appear in arena ticket transactions. */
function arenaMatchSectorPairs(
  transactions: Transaction[],
): Map<string, Set<Sector>> {
  const bySector = new Map<string, Set<Sector>>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena" || !tx.matchId) {
      continue;
    }
    if (!tx.sector) continue;
    let sectors = bySector.get(tx.matchId);
    if (!sectors) {
      sectors = new Set();
      bySector.set(tx.matchId, sectors);
    }
    sectors.add(tx.sector);
  }
  return bySector;
}

/**
 * Guarantee:
 * - Every non-VIP sector in every match has tickets in all three lower price
 *   zones (up_to_1500, from_1500_to_2500, from_2500_to_4000).
 * - VIP sector only ever gets from_4000_to_6000 seeds (already correct from
 *   random generation; we do not inject lower zones into VIP).
 * - If VIP is missing from_4000_to_6000 it is seeded as before.
 * Parking rows are skipped (no price zone).
 */
function ensureTicketPriceZoneCoverage(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const matchSectors = arenaMatchSectorPairs(transactions);
  if (matchSectors.size === 0) return { txs: [], nextId: startId };

  const zonesBySectorAndMatch = arenaPriceZonesBySectorAndMatch(transactions);
  const matchById = new Map(allMatches.map((match) => [match.id, match]));
  const txs: Transaction[] = [];
  let id = startId;

  for (const [matchId, sectors] of matchSectors) {
    const match = matchById.get(matchId);
    if (!match) continue;

    for (const sector of sectors) {
      const key = `${matchId}::${sector}`;
      const present = zonesBySectorAndMatch.get(key) ?? new Set<PriceZone>();

      if (sector === "VIP") {
        const vipZone: PriceZone = "from_4000_to_6000";
        if (!present.has(vipZone)) {
          const unitPrice = PRICE_ZONE_SEED_UNIT_PRICE[vipZone];
          const qty = PRICE_ZONE_SEED_QUANTITY;
          const orderSource = pickOrderSource();
          txs.push({
            id: `tx-${id++}`,
            date: randomSaleDate(match),
            stream: "tickets",
            description: `Билет на арену, сектор ${sector}`,
            matchId,
            channel: orderSource === "box_office" ? "arena" : "online",
            amount: unitPrice * qty,
            quantity: qty,
            sector,
            ticketType: "arena",
            priceZone: priceZoneFromUnitPrice(unitPrice),
            orderSource,
          });
        }
      } else {
        for (const zone of NON_VIP_SEED_ZONES) {
          if (present.has(zone)) continue;
          const unitPrice = PRICE_ZONE_SEED_UNIT_PRICE[zone];
          const qty = PRICE_ZONE_SEED_QUANTITY;
          const orderSource = pickOrderSource();
          txs.push({
            id: `tx-${id++}`,
            date: randomSaleDate(match),
            stream: "tickets",
            description: `Билет на арену, сектор ${sector}`,
            matchId,
            channel: orderSource === "box_office" ? "arena" : "online",
            amount: unitPrice * qty,
            quantity: qty,
            sector,
            ticketType: "arena",
            priceZone: priceZoneFromUnitPrice(unitPrice),
            orderSource,
          });
        }
      }
    }
  }

  return { txs, nextId: id };
}

/** Catalog prices are 35% below the previous mock so average check drops by 35%. */
const subscriptionPlans: SubscriptionPlan[] = [
  { id: "plan-1", code: "SUB-5-A", name: "Абонемент на 5 матчей (сектор A)", matchCount: 5, price: 6500 },
  { id: "plan-2", code: "SUB-5-B", name: "Абонемент на 5 матчей (сектор B)", matchCount: 5, price: 4875 },
  { id: "plan-3", code: "SUB-10-A", name: "Абонемент на 10 матчей", matchCount: 10, price: 11700 },
  { id: "plan-4", code: "SUB-SEASON", name: "Сезонный абонемент", matchCount: 30, price: 55250 },
  { id: "plan-5", code: "SUB-VIP", name: "VIP-сезонный абонемент", matchCount: 30, price: 162500 },
  { id: "plan-6", code: "SUB-STUD", name: "Студенческий абонемент", matchCount: 10, price: 3900 },
];

type SeasonSubscriptionQuota = {
  season: string;
  seasonStart: Date;
  regularCount: number;
  playoffCount: number;
  preferDashboardPeriod: boolean;
};

const SEASON_SUBSCRIPTION_QUOTAS: SeasonSubscriptionQuota[] = [
  {
    season: "2025/26",
    seasonStart: SEASON_START,
    regularCount: 45,
    playoffCount: 20,
    preferDashboardPeriod: true,
  },
  {
    season: "2024/25",
    seasonStart: PREV_SEASON_START,
    regularCount: 45,
    playoffCount: 12,
    preferDashboardPeriod: true,
  },
];

function getRegularSubscriptionSalesWindow(season: string): {
  start: Date;
  end: Date;
} {
  if (season === "2024/25") {
    return {
      start: PREV_SUBSCRIPTIONS_PERIOD_START,
      end: PREV_SUBSCRIPTIONS_PERIOD_END,
    };
  }
  return {
    start: SUBSCRIPTIONS_PERIOD_START,
    end: SUBSCRIPTIONS_PERIOD_END,
  };
}

function isInRegularSubscriptionSalesWindow(
  purchasedAt: Date,
  season = "2025/26",
): boolean {
  const { start, end } = getRegularSubscriptionSalesWindow(season);
  const day = startOfDay(purchasedAt);
  return day >= startOfDay(start) && day <= startOfDay(end);
}

function isInPlayoffSubscriptionSalesWindow(
  purchasedAt: Date,
  season: string,
  allMatches: Match[],
): boolean {
  const firstPlayoff = getFirstPlayoffMatchDate(allMatches, season);
  if (!firstPlayoff) return false;
  const window = getPlayoffSubscriptionSalesWindow(firstPlayoff);
  const day = startOfDay(purchasedAt);
  return (
    day >= startOfDay(window.start) && day <= startOfDay(window.end)
  );
}

function subscriptionPassesDefaultSeasonFilter(
  sub: Subscription,
  allMatches: Match[],
): boolean {
  if (sub.season !== "2025/26") return false;
  if (sub.tournamentStage === "playoff") {
    return isInPlayoffSubscriptionSalesWindow(
      sub.purchasedAt,
      sub.season,
      allMatches,
    );
  }
  return isInRegularSubscriptionSalesWindow(sub.purchasedAt, sub.season);
}

const SEED_SUBSCRIPTION_PLAN =
  subscriptionPlans.find((plan) => plan.code === "SUB-SEASON") ??
  subscriptionPlans[3];

/** Seed subscriptions so every sector appears in 2025/26 default filters. */
function ensureSubscriptionSectorCoverage(
  subs: Subscription[],
  allMatches: Match[],
  startId: number,
): number {
  const seasonMatches = allMatches.filter(
    (match) => match.season === "2025/26" && match.league === "KHL",
  );
  const regularMatch =
    seasonMatches.find((match) => match.tournamentStage === "regular") ??
    seasonMatches[0];
  if (!regularMatch) return startId;

  const purchasedAt = SUBSCRIPTIONS_PERIOD_START;
  let id = startId;

  for (const sector of ALL_SECTORS) {
    const hasCoverage = subs.some(
      (sub) =>
        sub.sector === sector &&
        sub.league === "KHL" &&
        sub.ticketType === "arena" &&
        subscriptionPassesDefaultSeasonFilter(sub, allMatches),
    );
    if (!hasCoverage) {
      subs.push(
        buildSubscription(
          id++,
          SEED_SUBSCRIPTION_PLAN,
          regularMatch,
          purchasedAt,
          "regular",
          sector,
          "arena",
        ),
      );
    }
  }

  return id;
}

/** ~80% unique buyers: some fans purchase more than one subscription. */
function customerIdForSubscription(id: number): string {
  const customerNum = Math.max(1, Math.floor((id - 1) * 4 / 5) + 1);
  return `cust-${customerNum}`;
}

function buildSubscription(
  id: number,
  plan: SubscriptionPlan,
  match: Match,
  purchasedAt: Date,
  tournamentStage: Subscription["tournamentStage"],
  explicitSector?: Sector,
  explicitTicketType?: Subscription["ticketType"],
): Subscription {
  const validTo = addDays(purchasedAt, 90);
  const usedCount = Math.min(randomInt(1, plan.matchCount), randomInt(1, 8));
  const channel = rand() > 0.4 ? "official_site" : "box_office";
  const status =
    usedCount >= plan.matchCount
      ? "fully_used"
      : validTo < SUBSCRIPTIONS_PERIOD_END
        ? "expired"
        : "active";
  const sector =
    explicitSector ??
    (plan.code.includes("VIP")
      ? "VIP"
      : plan.code.includes("-A")
        ? "A"
        : plan.code.includes("-B")
          ? randomPick(["B1", "B2", "B3", "B4"] as Sector[])
          : randomPick(ALL_SECTORS));

  return {
    id: `sub-${id}`,
    planId: plan.id,
    planName: plan.name,
    customerId: customerIdForSubscription(id),
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
    ticketType: explicitTicketType ?? (rand() > 0.08 ? "arena" : "parking"),
    sector,
  };
}

function generateSubscriptions(allMatches: Match[]): Subscription[] {
  const subs: Subscription[] = [];
  let id = 1;

  for (const quota of SEASON_SUBSCRIPTION_QUOTAS) {
    const seasonMatches = allMatches.filter(
      (match) => match.season === quota.season,
    );
    const regularStageMatches = seasonMatches.filter(
      (match) => match.tournamentStage === "regular",
    );
    const playoffStageMatches = seasonMatches.filter(
      (match) => match.tournamentStage === "playoff",
    );

    const firstPlayoffMatch = getFirstPlayoffMatchDate(allMatches, quota.season);
    if (!firstPlayoffMatch) continue;

    const playoffSalesWindow =
      getPlayoffSubscriptionSalesWindow(firstPlayoffMatch);
    const regularSalesEnd = subDays(playoffSalesWindow.start, 1);
    const preferWindow = getRegularSubscriptionSalesWindow(quota.season);
    const preferStart = quota.preferDashboardPeriod
      ? preferWindow.start
      : undefined;
    const preferEnd = quota.preferDashboardPeriod
      ? preferWindow.end
      : undefined;

    for (let i = 0; i < quota.regularCount; i += 1) {
      const plan = randomPick(subscriptionPlans);
      const match = randomPick(
        regularStageMatches.length > 0 ? regularStageMatches : seasonMatches,
      );
      const purchasedAt =
        quota.season === "2024/25" && preferStart && preferEnd
          ? randomDateInSeasonRange(preferStart, preferEnd)
          : randomDateInWindow(
              quota.seasonStart,
              regularSalesEnd,
              preferStart,
              preferEnd,
            );

      subs.push(
        buildSubscription(id++, plan, match, purchasedAt, "regular"),
      );
    }

    for (let i = 0; i < quota.playoffCount; i += 1) {
      const plan = randomPick(subscriptionPlans);
      const match = randomPick(
        playoffStageMatches.length > 0 ? playoffStageMatches : seasonMatches,
      );
      const purchasedAt = randomDateInSeasonRange(
        playoffSalesWindow.start,
        playoffSalesWindow.end,
      );

      subs.push(
        buildSubscription(id++, plan, match, purchasedAt, "playoff"),
      );
    }
  }

  id = ensureSubscriptionSectorCoverage(subs, allMatches, id);
  id = ensureCriticalSubscriptionCombos(subs, allMatches, id);
  ensureDefaultSeasonSoldCount(subs, allMatches, id);
  id = seedCampaignPaceSubscriptions(subs, allMatches, id);
  realignPreviousSeasonSubscriptionPurchases(subs, allMatches);
  rebalancePreviousSeasonKhlRevenue(subs, allMatches);
  rebalanceDefaultSeasonAverageCheck(subs, allMatches);

  return subs.sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
}

/** Analogous 2024/25 KHL window: keep sold~45 and revenue near 1.90M for modest YoY. */
const TARGET_PREV_SEASON_KHL_REVENUE = 1_900_000;

function rebalancePreviousSeasonKhlRevenue(
  subs: Subscription[],
  allMatches: Match[],
): void {
  const prev = subs.filter((sub) =>
    subscriptionPassesPrevSeasonDefaultFilter(sub, allMatches),
  );
  if (prev.length === 0) return;

  const minRevenue = TARGET_PREV_SEASON_KHL_REVENUE * 0.9;
  const maxRevenue = TARGET_PREV_SEASON_KHL_REVENUE * 1.08;
  const sumPrices = () => prev.reduce((sum, sub) => sum + sub.price, 0);
  let revenue = sumPrices();
  if (revenue >= minRevenue && revenue <= maxRevenue) return;

  const seasonPlan = SEED_SUBSCRIPTION_PLAN;
  const cheapPlan =
    subscriptionPlans.find((plan) => plan.code === "SUB-STUD") ??
    subscriptionPlans[5] ??
    seasonPlan;

  if (revenue < minRevenue) {
    const cheapest = [...prev].sort((left, right) => left.price - right.price);
    for (const sub of cheapest) {
      revenue = sumPrices();
      if (revenue >= minRevenue) return;
      if (sub.planId === seasonPlan.id || sub.planId === "plan-5") continue;
      sub.price = seasonPlan.price;
      sub.planId = seasonPlan.id;
      sub.planName = seasonPlan.name;
    }
    return;
  }

  const expensive = [...prev].sort((left, right) => right.price - left.price);
  for (const sub of expensive) {
    revenue = sumPrices();
    if (revenue <= maxRevenue) return;
    if (sub.planId === cheapPlan.id) continue;
    sub.price = cheapPlan.price;
    sub.planId = cheapPlan.id;
    sub.planName = cheapPlan.name;
  }
}

/** Catalog-scale target: ~65% of the pre-cut 3.451M / 60 average check. */
const TARGET_DEFAULT_AVG_CHECK = 0.65 * (3_451_000 / 60);

/**
 * Upgrade the cheapest 2025/26 default-window rows to the season plan so
 * average check stays in the catalog 0.65× band after RNG reshuffles.
 */
function rebalanceDefaultSeasonAverageCheck(
  subs: Subscription[],
  allMatches: Match[],
): void {
  const defaultSubs = subs.filter(
    (sub) =>
      sub.league === "KHL" &&
      subscriptionPassesDefaultSeasonFilter(sub, allMatches),
  );
  if (defaultSubs.length === 0) return;

  const minAvg = TARGET_DEFAULT_AVG_CHECK * 0.97;
  const maxAvg = TARGET_DEFAULT_AVG_CHECK * 1.12;
  const sumPrices = () => defaultSubs.reduce((sum, sub) => sum + sub.price, 0);
  let avg = sumPrices() / defaultSubs.length;
  if (avg >= minAvg && avg <= maxAvg) return;

  const seasonPlan = SEED_SUBSCRIPTION_PLAN;
  const cheapPlan =
    subscriptionPlans.find((plan) => plan.code === "SUB-STUD") ??
    subscriptionPlans[5] ??
    seasonPlan;
  const ordered = [...defaultSubs].sort((left, right) => left.price - right.price);
  for (const sub of ordered) {
    avg = sumPrices() / defaultSubs.length;
    if (avg >= minAvg && avg <= maxAvg) return;
    if (avg < minAvg) {
      if (sub.planId === seasonPlan.id || sub.planId === "plan-5") continue;
      sub.price = seasonPlan.price;
      sub.planId = seasonPlan.id;
      sub.planName = seasonPlan.name;
    }
  }

  const expensiveFirst = [...defaultSubs].sort(
    (left, right) => right.price - left.price,
  );
  for (const sub of expensiveFirst) {
    avg = sumPrices() / defaultSubs.length;
    if (avg >= minAvg && avg <= maxAvg) return;
    if (avg <= maxAvg) return;
    if (sub.tournamentStage === "playoff" && sub.sector === "VIP") continue;
    if (sub.planId === cheapPlan.id) continue;
    sub.price = cheapPlan.price;
    sub.planId = cheapPlan.id;
    sub.planName = cheapPlan.name;
  }
}

/** Default 2025/26 filter view should show this many sold subscriptions. */
const TARGET_DEFAULT_SEASON_SOLD = 85;

/**
 * Top up 2025/26 default-window sales to TARGET_DEFAULT_SEASON_SOLD.
 * Extra rows reuse the existing default-filter plan mix so average check
 * stays at catalog scale (0.65× previous prices) rather than drifting.
 */
function ensureDefaultSeasonSoldCount(
  subs: Subscription[],
  allMatches: Match[],
  startId: number,
): void {
  const seasonMatches = allMatches.filter((match) => match.season === "2025/26");
  const regularMatch =
    seasonMatches.find((match) => match.tournamentStage === "regular") ??
    seasonMatches[0];
  if (!regularMatch) return;

  const defaultSubs = subs.filter((sub) =>
    subscriptionPassesDefaultSeasonFilter(sub, allMatches),
  );
  if (defaultSubs.length === 0) return;
  if (defaultSubs.length >= TARGET_DEFAULT_SEASON_SOLD) return;

  const planById = new Map(subscriptionPlans.map((plan) => [plan.id, plan]));
  const needed = TARGET_DEFAULT_SEASON_SOLD - defaultSubs.length;
  let id = startId;

  for (let extraIndex = 0; extraIndex < needed; extraIndex += 1) {
    const templateIndex = Math.floor(
      (extraIndex * defaultSubs.length) / needed,
    );
    const template = defaultSubs[templateIndex];
    const plan = planById.get(template.planId) ?? SEED_SUBSCRIPTION_PLAN;
    const purchasedAt = randomDateInSeasonRange(
      SUBSCRIPTIONS_PERIOD_START,
      SUBSCRIPTIONS_PERIOD_END,
    );
    const extra = buildSubscription(
      id++,
      plan,
      regularMatch,
      purchasedAt,
      "regular",
    );
    extra.price = template.price;
    extra.planId = template.planId;
    extra.planName = template.planName;
    subs.push(extra);
  }
}

/** Default 2024/25 KHL view (analogous sales window) should be close to 2025/26. */
const TARGET_PREV_SEASON_KHL_SOLD = 45;

function nextSubscriptionNumericId(subs: Subscription[]): number {
  let max = 0;
  for (const sub of subs) {
    const parsed = Number.parseInt(String(sub.id).replace(/\D/g, ""), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return max + 1;
}

function subscriptionPassesPrevSeasonDefaultFilter(
  sub: Subscription,
  allMatches: Match[],
): boolean {
  if (sub.season !== "2024/25" || sub.league !== "KHL") return false;
  if (sub.tournamentStage === "playoff") {
    return isInPlayoffSubscriptionSalesWindow(
      sub.purchasedAt,
      sub.season,
      allMatches,
    );
  }
  return isInRegularSubscriptionSalesWindow(sub.purchasedAt, sub.season);
}

/** Keep ~45 KHL 2024/25 sales in the analogous window so YoY vs 2025/26 stays modest. */
export function realignPreviousSeasonSubscriptionPurchases(
  subs: Subscription[],
  allMatches: Match[],
): void {
  const prevWindow = getRegularSubscriptionSalesWindow("2024/25");
  const span = Math.max(
    0,
    differenceInCalendarDays(prevWindow.end, prevWindow.start),
  );
  const outsideWindow = addDays(prevWindow.end, 21);

  const prevKhlPlayoff = subs.filter(
    (sub) =>
      sub.season === "2024/25" &&
      sub.league === "KHL" &&
      sub.tournamentStage === "playoff" &&
      isInPlayoffSubscriptionSalesWindow(
        sub.purchasedAt,
        sub.season,
        allMatches,
      ),
  );
  const prevKhlRegulars = subs.filter(
    (sub) =>
      sub.season === "2024/25" &&
      sub.league === "KHL" &&
      sub.tournamentStage === "regular",
  );
  const otherPrevRegulars = subs.filter(
    (sub) =>
      sub.season === "2024/25" &&
      sub.tournamentStage === "regular" &&
      sub.league !== "KHL",
  );

  otherPrevRegulars.forEach((sub, index) => {
    const purchasedAt = addDays(outsideWindow, index % 14);
    sub.purchasedAt = purchasedAt;
    sub.validTo = addDays(purchasedAt, 90);
  });

  const regularsNeeded = Math.max(
    0,
    TARGET_PREV_SEASON_KHL_SOLD - prevKhlPlayoff.length,
  );

  prevKhlRegulars.forEach((sub, index) => {
    const inWindow = index < regularsNeeded;
    const purchasedAt = inWindow
      ? addDays(prevWindow.start, span === 0 ? 0 : index % (span + 1))
      : addDays(outsideWindow, index % 14);
    sub.purchasedAt = purchasedAt;
    sub.validTo = addDays(purchasedAt, 90);
  });

  const coverageCombo = subs.find(
    (sub) =>
      sub.season === "2024/25" &&
      sub.league === "VHL" &&
      sub.ticketType === "parking" &&
      sub.tournamentStage === "regular",
  );
  if (coverageCombo) {
    coverageCombo.purchasedAt = prevWindow.start;
    coverageCombo.validTo = addDays(prevWindow.start, 90);
  }

  const passing = subs.filter((sub) =>
    subscriptionPassesPrevSeasonDefaultFilter(sub, allMatches),
  );
  if (passing.length >= TARGET_PREV_SEASON_KHL_SOLD) return;

  const khlMatch =
    allMatches.find(
      (match) =>
        match.season === "2024/25" &&
        match.league === "KHL" &&
        match.tournamentStage === "regular",
    ) ??
    allMatches.find(
      (match) => match.season === "2024/25" && match.league === "KHL",
    );
  if (!khlMatch) return;

  const templates =
    passing.length > 0
      ? passing
      : prevKhlRegulars;
  if (templates.length === 0) return;

  const planById = new Map(subscriptionPlans.map((plan) => [plan.id, plan]));
  let id = nextSubscriptionNumericId(subs);
  const needed = TARGET_PREV_SEASON_KHL_SOLD - passing.length;

  for (let extraIndex = 0; extraIndex < needed; extraIndex += 1) {
    const template = templates[extraIndex % templates.length];
    const plan = planById.get(template.planId) ?? SEED_SUBSCRIPTION_PLAN;
    const purchasedAt = addDays(
      prevWindow.start,
      span === 0 ? 0 : extraIndex % (span + 1),
    );
    const extra = buildSubscription(
      id++,
      plan,
      khlMatch,
      purchasedAt,
      "regular",
    );
    extra.price = template.price;
    extra.planId = template.planId;
    extra.planName = template.planName;
    extra.league = "KHL";
    extra.season = "2024/25";
    extra.ticketType = "arena";
    extra.tournamentStage = "regular";
    subs.push(extra);
  }
}

/** Ensures rare but tested filter combinations have at least one subscription. */
function ensureCriticalSubscriptionCombos(
  subs: Subscription[],
  allMatches: Match[],
  startId: number,
): number {
  let id = startId;

  const hasPrevVhlParking = subs.some(
    (sub) =>
      sub.season === "2024/25" &&
      sub.league === "VHL" &&
      sub.ticketType === "parking" &&
      (sub.tournamentStage === "playoff"
        ? isInPlayoffSubscriptionSalesWindow(
            sub.purchasedAt,
            sub.season,
            allMatches,
          )
        : isInRegularSubscriptionSalesWindow(sub.purchasedAt, sub.season)),
  );
  if (!hasPrevVhlParking) {
    const vhlMatch = allMatches.find(
      (match) => match.season === "2024/25" && match.league === "VHL",
    );
    if (vhlMatch) {
      subs.push(
        buildSubscription(
          id++,
          SEED_SUBSCRIPTION_PLAN,
          vhlMatch,
          PREV_SUBSCRIPTIONS_PERIOD_START,
          "regular",
          "D1",
          "parking",
        ),
      );
    }
  }

  const hasPlayoffVip = subs.some(
    (sub) =>
      sub.season === "2025/26" &&
      sub.league === "KHL" &&
      sub.tournamentStage === "playoff" &&
      sub.sector === "VIP" &&
      isInPlayoffSubscriptionSalesWindow(
        sub.purchasedAt,
        sub.season,
        allMatches,
      ),
  );
  if (!hasPlayoffVip) {
    const playoffMatch = allMatches.find(
      (match) =>
        match.season === "2025/26" &&
        match.league === "KHL" &&
        match.tournamentStage === "playoff",
    );
    const firstPlayoff = getFirstPlayoffMatchDate(allMatches, "2025/26");
    if (playoffMatch && firstPlayoff) {
      const window = getPlayoffSubscriptionSalesWindow(firstPlayoff);
      const vipPlan =
        subscriptionPlans.find((plan) => plan.code === "SUB-SEASON") ??
        SEED_SUBSCRIPTION_PLAN;
      subs.push(
        buildSubscription(
          id++,
          vipPlan,
          playoffMatch,
          window.start,
          "playoff",
          "VIP",
          "arena",
        ),
      );
    }
  }

  return id;
}

function getSellableCampaignDays(
  totalDays: number,
  emptyDays: ReadonlySet<number>,
): number[] {
  const days: number[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    if (!emptyDays.has(day)) days.push(day);
  }
  return days.length > 0 ? days : [Math.max(1, totalDays)];
}

function assignPurchasedAtAlongCampaign(
  items: Subscription[],
  campaignStart: Date,
  sellableDays: number[],
): void {
  const total = items.length;
  for (let index = 0; index < items.length; index += 1) {
    const t = total <= 1 ? 0 : index / (total - 1);
    const biased = Math.pow(t, 1.35);
    const dayIndex = Math.min(
      sellableDays.length - 1,
      Math.floor(biased * sellableDays.length),
    );
    items[index].purchasedAt = addDays(
      campaignStart,
      sellableDays[dayIndex] - 1,
    );
  }
}

/**
 * Spreads (and, for older seasons, adds) purchases across each campaign
 * calendar so pace charts are not flat. Empty early days stay on the axis.
 */
function seedCampaignPaceSubscriptions(
  subs: Subscription[],
  allMatches: Match[],
  startId: number,
): number {
  const campaigns = getSeasonTicketCampaignConfigs();
  const dashboardStartKey = toCalendarDateKey(SUBSCRIPTIONS_PERIOD_START);
  let id = startId;

  for (const campaign of campaigns) {
    if (!campaign.endDate) continue;
    const start = parseCalendarDate(campaign.startDate);
    const end = parseCalendarDate(campaign.endDate);
    if (end < start) continue;

    const asOf = startOfDay(MOCK_TODAY);
    if (asOf < start) continue;

    const lastInclusive = end < asOf ? end : asOf;
    const totalDays = getCampaignDayNumber(lastInclusive, start);
    const emptyDays = new Set<number>([1, 2]);
    if (totalDays >= 8) emptyDays.add(8);
    const sellableDays = getSellableCampaignDays(totalDays, emptyDays);

    const existing = subs.filter((sub) => {
      if (sub.season !== campaign.seasonId) return false;
      if (sub.tournamentStage !== "regular") return false;
      const day = getCampaignDayNumber(sub.purchasedAt, campaign.startDate);
      return day >= 1 && day <= totalDays;
    });

    const isDashboardCampaign = campaign.startDate === dashboardStartKey;

    if (existing.length > 0) {
      assignPurchasedAtAlongCampaign(existing, start, sellableDays);
    }

    if (isDashboardCampaign) continue;

    const templateMatch =
      allMatches.find(
        (match) =>
          match.season === campaign.seasonId &&
          match.tournamentStage === "regular",
      ) ??
      allMatches.find((match) => match.tournamentStage === "regular") ??
      allMatches[0];
    if (!templateMatch) continue;

    const targetCount = totalDays <= 18 ? 48 : 72;
    const needed = Math.max(0, targetCount - existing.length);
    if (needed === 0) continue;

    const created: Subscription[] = [];
    for (let index = 0; index < needed; index += 1) {
      const plan = randomPick(subscriptionPlans);
      const next = buildSubscription(
        id++,
        plan,
        templateMatch,
        start,
        "regular",
      );
      next.season = campaign.seasonId;
      created.push(next);
      subs.push(next);
    }

    assignPurchasedAtAlongCampaign(created, start, sellableDays);

    if (created.length >= 4) {
      created[1].customerId = created[0].customerId;
      created[1].purchasedAt = created[0].purchasedAt;
    }
  }

  const dashboardCampaign = campaigns.find(
    (campaign) => campaign.startDate === dashboardStartKey,
  );
  const previousCampaign = dashboardCampaign
    ? getPreviousCampaignConfig(dashboardCampaign.seasonId, campaigns)
    : null;
  const cancelledTemplate =
    (previousCampaign
      ? allMatches.find((match) => match.season === previousCampaign.seasonId)
      : null) ?? allMatches[0];
  if (cancelledTemplate && previousCampaign) {
    const cancelled = buildSubscription(
      id++,
      SEED_SUBSCRIPTION_PLAN,
      cancelledTemplate,
      parseCalendarDate(previousCampaign.startDate),
      "regular",
    );
    cancelled.season = previousCampaign.seasonId;
    cancelled.status = "cancelled";
    cancelled.purchasedAt = addDays(
      parseCalendarDate(previousCampaign.startDate),
      2,
    );
    subs.push(cancelled);
  }

  return id;
}

function pickEvenlySpaced<T>(items: T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  if (count >= items.length) return items.slice();

  const selected: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    let idx = Math.round((i * (items.length - 1)) / Math.max(count - 1, 1));
    while (used.has(idx) && used.size < items.length) {
      idx = (idx + 1) % items.length;
    }
    used.add(idx);
    selected.push(items[idx]);
  }
  return selected;
}

function eligibleMatchesForSubscription(
  sub: Subscription,
  allMatches: Match[],
): Match[] {
  return allMatches
    .filter(
      (match) =>
        match.season === sub.season &&
        match.league === sub.league &&
        match.arena === sub.arena &&
        match.tournamentStage === sub.tournamentStage &&
        match.date >= sub.purchasedAt &&
        match.date <= MOCK_TODAY,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function generateSubscriptionRedemptions(
  subscriptions: Subscription[],
  allMatches: Match[],
): SubscriptionRedemption[] {
  const redemptions: SubscriptionRedemption[] = [];
  let id = 1;
  const uniqueSubs = [
    ...new Map(subscriptions.map((sub) => [sub.id, sub])).values(),
  ];

  for (const sub of uniqueSubs) {
    if (sub.status === "cancelled") continue;

    const usedCount = Math.min(sub.matchesUsed, sub.matchesTotal);
    if (usedCount <= 0) continue;

    const eligible = eligibleMatchesForSubscription(sub, allMatches);
    const picked = pickEvenlySpaced(eligible, usedCount);

    for (const match of picked) {
      redemptions.push({
        id: `redemption-${id++}`,
        subscriptionId: sub.id,
        matchId: match.id,
        redeemedAt: match.date,
      });
    }
  }

  return redemptions;
}

export function generateMockData(): {
  matches: Match[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  subscriptionRedemptions: SubscriptionRedemption[];
} {
  const matches = generateMatches();
  // Subscriptions use the shared RNG; generate them before tickets so
  // catalog-price retunes do not reshuffle 2024/25–2025/26 abonement mix.
  const subscriptions = generateSubscriptions(matches);
  const transactions = generateTransactions(matches);
  const subscriptionRedemptions = generateSubscriptionRedemptions(
    subscriptions,
    matches,
  );
  return { matches, transactions, subscriptions, subscriptionRedemptions };
}

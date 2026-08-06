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
  Subscription,
  SubscriptionPlan,
  TicketType,
  Transaction,
  TicketSalesProfile,
  TicketSalesTempo,
} from "@/types/dashboard";
import { ALL_PRICE_ZONES } from "@/lib/ticket-filter-options";
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
  LEGACY_TICKET_PLAN_AVG_PRICE,
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
export const SUBSCRIPTIONS_PERIOD_END = new Date(2025, 8, 14);
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

const ZONE_PRICE_SCALE = TICKET_PLAN_AVG_PRICE / LEGACY_TICKET_PLAN_AVG_PRICE;

const ZONE_PRICES: Record<PriceZone, number> = {
  A: Math.round(2500 * ZONE_PRICE_SCALE),
  B1: Math.round(2200 * ZONE_PRICE_SCALE),
  B2: Math.round(2100 * ZONE_PRICE_SCALE),
  B3: Math.round(2000 * ZONE_PRICE_SCALE),
  B4: Math.round(1900 * ZONE_PRICE_SCALE),
  C1: Math.round(1600 * ZONE_PRICE_SCALE),
  C2: Math.round(1500 * ZONE_PRICE_SCALE),
  C3: Math.round(1400 * ZONE_PRICE_SCALE),
  C4: Math.round(1300 * ZONE_PRICE_SCALE),
  D1: Math.round(1100 * ZONE_PRICE_SCALE),
  D2: Math.round(1000 * ZONE_PRICE_SCALE),
  D3: Math.round(900 * ZONE_PRICE_SCALE),
  D4: Math.round(800 * ZONE_PRICE_SCALE),
  VIP: Math.round(8500 * ZONE_PRICE_SCALE),
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
  "Динамо Мск": new Date(2026, 0, 5),
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
  applyTicketChartDemoProfiles(allMatches);
  applyCurrentSeasonKhlMatchDates(allMatches);
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

  const upcomingKhl = matches
    .filter((match) => match.league === "KHL" && !match.eventCompleted)
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (upcomingKhl[0]) {
    // In-sale demo: sales window opens before MOCK_TODAY so presale txs exist
    // through mock today (partial curve; match still upcoming).
    upcomingKhl[0].date = startOfDay(new Date(2026, 4, 25));
    upcomingKhl[0].ticketSalesWindowDays = TICKET_SALES_WINDOW_MAX_DAYS;
    upcomingKhl[0].ticketSalesProfile = {
      fulfillmentFactor: 0.88,
      tempo: "steady",
    };
  }
  if (upcomingKhl[1]) {
    upcomingKhl[1].ticketSalesProfile = {
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

function getLeagueZonePrice(
  zone: PriceZone,
  league: League,
  matchClass: MatchClass = "class_2",
): number {
  switch (league) {
    case "VHL":
      return Math.round(
        ZONE_PRICES[zone] *
          (getVhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE),
      );
    case "MHL":
      return Math.round(
        ZONE_PRICES[zone] *
          (getMhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE),
      );
    default:
      return Math.round(
        ZONE_PRICES[zone] *
          (getKhlPlanAvgPrice(matchClass) / TICKET_PLAN_AVG_PRICE),
      );
  }
}

function closestPriceZone(
  targetPrice: number,
  league: League = "KHL",
  matchClass: MatchClass = "class_2",
): PriceZone {
  return ALL_PRICE_ZONES.reduce((best, zone) =>
    Math.abs(getLeagueZonePrice(zone, league, matchClass) - targetPrice) <
    Math.abs(getLeagueZonePrice(best, league, matchClass) - targetPrice)
      ? zone
      : best,
  ALL_PRICE_ZONES[0]);
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
      const priceZone = closestPriceZone(
        Math.round(revenueLeft / ticketsLeft),
        league,
        matchClass,
      );
      const unitPrice = getLeagueZonePrice(priceZone, league, matchClass);
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
    const unitPrice = getLeagueZonePrice(priceZone, league, matchClass);
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
    playoffCount: 18,
    preferDashboardPeriod: false,
  },
];

function isInRegularSubscriptionSalesWindow(purchasedAt: Date): boolean {
  const day = startOfDay(purchasedAt);
  return (
    day >= startOfDay(SUBSCRIPTIONS_PERIOD_START) &&
    day <= startOfDay(SUBSCRIPTIONS_PERIOD_END)
  );
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
  return isInRegularSubscriptionSalesWindow(sub.purchasedAt);
}

const SEED_SUBSCRIPTION_PLAN =
  subscriptionPlans.find((plan) => plan.code === "SUB-SEASON") ??
  subscriptionPlans[3];

/** Seed subscriptions so every price zone appears in 2025/26 default filters. */
function ensureSubscriptionPriceZoneCoverage(
  subs: Subscription[],
  allMatches: Match[],
  startId: number,
): number {
  const seasonMatches = allMatches.filter((match) => match.season === "2025/26");
  const regularMatch =
    seasonMatches.find((match) => match.tournamentStage === "regular") ??
    seasonMatches[0];
  if (!regularMatch) return startId;

  const purchasedAt = SUBSCRIPTIONS_PERIOD_START;
  let id = startId;

  for (const zone of ALL_PRICE_ZONES) {
    const hasCoverage = subs.some(
      (sub) =>
        sub.priceZone === zone &&
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
          zone,
        ),
      );
    }
  }

  return id;
}

function buildSubscription(
  id: number,
  plan: SubscriptionPlan,
  match: Match,
  purchasedAt: Date,
  tournamentStage: Subscription["tournamentStage"],
  explicitPriceZone?: PriceZone,
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
  const priceZone =
    explicitPriceZone ??
    (plan.code.includes("VIP")
      ? "VIP"
      : plan.code.includes("-A")
        ? "A"
        : plan.code.includes("-B")
          ? randomPick(["B1", "B2", "B3", "B4"] as PriceZone[])
          : randomPick(ALL_PRICE_ZONES));

  return {
    id: `sub-${id}`,
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
    ticketType: explicitTicketType ?? (rand() > 0.08 ? "arena" : "parking"),
    priceZone,
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
    const preferStart = quota.preferDashboardPeriod
      ? SUBSCRIPTIONS_PERIOD_START
      : undefined;
    const preferEnd = quota.preferDashboardPeriod
      ? SUBSCRIPTIONS_PERIOD_END
      : undefined;

    for (let i = 0; i < quota.regularCount; i += 1) {
      const plan = randomPick(subscriptionPlans);
      const match = randomPick(
        regularStageMatches.length > 0 ? regularStageMatches : seasonMatches,
      );
      const purchasedAt = randomDateInWindow(
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

  id = ensureSubscriptionPriceZoneCoverage(subs, allMatches, id);
  ensureCriticalSubscriptionCombos(subs, allMatches, id);

  return subs.sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
}

/** Ensures rare but tested filter combinations have at least one subscription. */
function ensureCriticalSubscriptionCombos(
  subs: Subscription[],
  allMatches: Match[],
  startId: number,
): void {
  const hasCombo = subs.some(
    (sub) =>
      sub.season === "2024/25" &&
      sub.league === "VHL" &&
      sub.ticketType === "parking",
  );
  if (hasCombo) return;

  const vhlMatch = allMatches.find(
    (match) => match.season === "2024/25" && match.league === "VHL",
  );
  if (!vhlMatch) return;

  subs.push(
    buildSubscription(
      startId,
      SEED_SUBSCRIPTION_PLAN,
      vhlMatch,
      SUBSCRIPTIONS_PERIOD_START,
      "regular",
      "D1",
      "parking",
    ),
  );
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

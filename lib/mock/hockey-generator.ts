import { addDays, differenceInCalendarDays, endOfDay, isSameDay, startOfDay, subDays } from "date-fns";
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
  Transaction,
  TicketSalesProfile,
  TicketSalesTempo,
} from "@/types/dashboard";
import {
  ALL_PRICE_ZONES,
  ALL_SECTORS,
  allowedPriceZonesForSector,
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
import { isMerchMatchTablePoint } from "@/lib/merch-filter-options";
import {
  applyExplicitMatchMerchPlan,
  applyMatchMerchPlanFloorWhenTicketsMet,
  applyMatchMerchPlanFulfillmentBand,
} from "@/lib/merch-plan";
import {
  allocateIntegerShares,
  allocateIntegerSharesWithBounds,
  getSectorCapacitiesForMatch,
  splitSectorCapacity,
} from "@/lib/arena-sector-inventory";
import { getTicketIssuedQuantity } from "@/lib/ticket-sales-metrics";
import {
  getMatchParkingCapacity,
  getMatchPlanArenaTickets,
  getMatchPlanArenaRevenue,
  getMatchPlanRevenue,
  getMatchPlanTickets,
  isRegularTicketPlanMatch,
  isSoldOutOccupancyMatch,
  isTicketRevenuePlanMet,
  MAIN_ARENA_CAPACITY,
  MHL_ARENA_CAPACITY,
  applyMatchTicketPlanFulfillmentBand,
  HIGH_REVENUE_PLAN_THRESHOLD,
  MAX_MID_REVENUE_OCCUPANCY,
  MID_REVENUE_PLAN_MIN,
  MIN_HIGH_REVENUE_OCCUPANCY,
  minHighRevenueOccupancyIssued,
  minMidRevenueOccupancyIssued,
  maxMidRevenueOccupancyIssued,
  occupancyMassCapacity,
  OVER_PLAN_REVENUE_THRESHOLD,
  SECONDARY_ARENA_CAPACITY,
  TICKET_PLAN_PARKING_UNIT_PRICE,
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

/**
 * Keep 2024/25 merch slightly above 2025/26 so default KPI YoY is a modest
 * decline (~4%), not a 40% cliff. Applied after ticket generation so the
 * shared RNG (occupancy / parking / loyalty / plan-cap) is unchanged.
 */
const PREV_SEASON_MERCH_VOLUME_FACTOR = 1.04;
const MERCH_YOY_MAX_ABS_PCT = 10;

function merchTxNumericId(tx: Transaction): number {
  const parsed = Number.parseInt(String(tx.id).replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextMerchTxNumericId(txs: Transaction[]): number {
  let max = 0;
  for (const tx of txs) {
    const parsed = merchTxNumericId(tx);
    if (parsed > max) max = parsed;
  }
  return max + 1;
}

function startOfSeasonDay(date: Date): Date {
  return startOfDay(date);
}

function isDateInInclusiveBounds(
  date: Date,
  min: Date,
  max: Date,
): boolean {
  const day = startOfSeasonDay(date);
  return day >= min && day <= max;
}

function pickEvenly<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (count >= items.length) return items.slice();
  const picked: T[] = [];
  const used = new Set<number>();
  const last = Math.max(1, count - 1);
  for (let i = 0; i < count; i += 1) {
    let index = Math.round((i * (items.length - 1)) / last);
    if (used.has(index)) {
      let forward = index;
      while (forward < items.length && used.has(forward)) forward += 1;
      if (forward < items.length) {
        index = forward;
      } else {
        let backward = index;
        while (backward >= 0 && used.has(backward)) backward -= 1;
        if (backward < 0) continue;
        index = backward;
      }
    }
    used.add(index);
    picked.push(items[index]);
  }
  return picked;
}

function dropTransactionsById(transactions: Transaction[], dropIds: Set<string>): void {
  if (dropIds.size === 0) return;
  let write = 0;
  for (let read = 0; read < transactions.length; read += 1) {
    if (dropIds.has(transactions[read].id)) continue;
    transactions[write] = transactions[read];
    write += 1;
  }
  transactions.length = write;
}

function dropMerchSalesAndLinkedReturns(
  transactions: Transaction[],
  salesToDrop: Transaction[],
): void {
  if (salesToDrop.length === 0) return;
  const dropIds = new Set(salesToDrop.map((tx) => tx.id));
  const returns = transactions.filter(
    (tx) => tx.stream === "merch" && tx.isReturn && !dropIds.has(tx.id),
  );
  for (const sale of salesToDrop) {
    const returnIndex = returns.findIndex(
      (ret) =>
        !dropIds.has(ret.id) &&
        ret.matchId === sale.matchId &&
        ret.description === `Возврат: ${sale.description}`,
    );
    if (returnIndex >= 0) {
      dropIds.add(returns[returnIndex].id);
      returns.splice(returnIndex, 1);
    }
  }
  dropTransactionsById(transactions, dropIds);
}

function summarizeMerchSlice(txs: Transaction[]): {
  revenue: number;
  receipts: number;
  avgCheck: number;
  returnsPct: number;
} {
  let revenue = 0;
  let receipts = 0;
  let returnsValue = 0;
  let grossSales = 0;
  for (const tx of txs) {
    if (tx.isReturn) {
      revenue -= tx.amount;
      receipts = Math.max(0, receipts - 1);
      returnsValue += tx.amount;
    } else {
      revenue += tx.amount;
      receipts += 1;
      grossSales += tx.amount;
    }
  }
  return {
    revenue,
    receipts,
    avgCheck: receipts > 0 ? revenue / receipts : 0,
    returnsPct: grossSales > 0 ? (returnsValue / grossSales) * 100 : 0,
  };
}

function pctChangeSafe(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function defaultKhlMerchSlice(
  txs: Transaction[],
  matchById: Map<string, Match>,
  season: "2024/25" | "2025/26",
): Transaction[] {
  const bounds =
    season === "2024/25"
      ? {
          min: startOfSeasonDay(
            subDays(PREV_SEASON_START, TICKET_SALES_WINDOW_MAX_DAYS),
          ),
          max: startOfSeasonDay(PREV_SEASON_END),
        }
      : {
          min: startOfSeasonDay(
            subDays(SEASON_START, TICKET_SALES_WINDOW_MAX_DAYS),
          ),
          max: startOfSeasonDay(MOCK_TODAY),
        };
  return txs.filter((tx) => {
    if (tx.stream !== "merch") return false;
    if (!tx.matchId) {
      return isDateInInclusiveBounds(tx.date, bounds.min, bounds.max);
    }
    const match = matchById.get(tx.matchId);
    return match?.season === season && match.league === "KHL";
  });
}

function growPrevMerchSalesToTarget(
  transactions: Transaction[],
  prevSales: Transaction[],
  currentSalesCount: number,
): void {
  const target = Math.max(
    0,
    Math.round(currentSalesCount * PREV_SEASON_MERCH_VOLUME_FACTOR),
  );
  if (prevSales.length >= target || prevSales.length === 0) return;
  const need = target - prevSales.length;
  let id = nextMerchTxNumericId(transactions);
  for (let i = 0; i < need; i += 1) {
    const src = prevSales[i % prevSales.length];
    transactions.push({
      ...src,
      id: `tx-${id++}`,
    });
  }
}

function trimPrevMerchSalesToTarget(
  transactions: Transaction[],
  prevSales: Transaction[],
  currentSalesCount: number,
): void {
  const target = Math.max(
    0,
    Math.round(currentSalesCount * PREV_SEASON_MERCH_VOLUME_FACTOR),
  );
  if (prevSales.length <= target) return;
  const keepIds = new Set(pickEvenly(prevSales, target).map((tx) => tx.id));
  const drop = prevSales.filter((tx) => !keepIds.has(tx.id));
  dropMerchSalesAndLinkedReturns(transactions, drop);
}

function nudgePrevMerchReturns(
  transactions: Transaction[],
  matchById: Map<string, Match>,
): void {
  const current = summarizeMerchSlice(
    defaultKhlMerchSlice(transactions, matchById, "2025/26"),
  );
  let prevSlice = defaultKhlMerchSlice(transactions, matchById, "2024/25");
  let prev = summarizeMerchSlice(prevSlice);
  let guard = 0;
  while (
    Math.abs(pctChangeSafe(current.returnsPct, prev.returnsPct)) >
      MERCH_YOY_MAX_ABS_PCT &&
    guard < 40
  ) {
    guard += 1;
    const returnsYoY = pctChangeSafe(current.returnsPct, prev.returnsPct);
    if (returnsYoY > MERCH_YOY_MAX_ABS_PCT) {
      const sale = prevSlice.find(
        (tx) =>
          !tx.isReturn &&
          Boolean(tx.matchId) &&
          !transactions.some(
            (candidate) =>
              candidate.isReturn &&
              candidate.matchId === tx.matchId &&
              candidate.description === `Возврат: ${tx.description}`,
          ),
      );
      if (!sale) break;
      const returnQty = Math.max(1, Math.min(sale.quantity, 1));
      const returnAmount = Math.round((sale.amount / sale.quantity) * returnQty);
      transactions.push({
        id: `tx-${nextMerchTxNumericId(transactions)}`,
        date: addDays(sale.date, 2),
        stream: "merch",
        description: `Возврат: ${sale.description}`,
        matchId: sale.matchId,
        channel: sale.channel,
        amount: returnAmount,
        quantity: returnQty,
        listUnitPrice: sale.listUnitPrice,
        merchSalesPoint: sale.merchSalesPoint,
        productCategory: sale.productCategory,
        isReturn: true,
      });
    } else {
      const extraReturn = prevSlice.find((tx) => tx.isReturn);
      if (!extraReturn) break;
      dropTransactionsById(transactions, new Set([extraReturn.id]));
    }
    prevSlice = defaultKhlMerchSlice(transactions, matchById, "2024/25");
    prev = summarizeMerchSlice(prevSlice);
  }
}

function realignPreviousSeasonMerch(
  transactions: Transaction[],
  matches: Match[],
): void {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const prevOffBounds = {
    min: startOfSeasonDay(
      subDays(PREV_SEASON_START, TICKET_SALES_WINDOW_MAX_DAYS),
    ),
    max: startOfSeasonDay(PREV_SEASON_END),
  };
  const curOffBounds = {
    min: startOfSeasonDay(subDays(SEASON_START, TICKET_SALES_WINDOW_MAX_DAYS)),
    max: startOfSeasonDay(MOCK_TODAY),
  };

  const leagues: League[] = ["KHL", "VHL", "MHL"];
  for (const league of leagues) {
    const currentSales = transactions
      .filter((tx) => {
        if (tx.stream !== "merch" || tx.isReturn || !tx.matchId) return false;
        const match = matchById.get(tx.matchId);
        return match?.season === "2025/26" && match.league === league;
      })
      .sort((left, right) => merchTxNumericId(left) - merchTxNumericId(right));
    const prevSales = transactions
      .filter((tx) => {
        if (tx.stream !== "merch" || tx.isReturn || !tx.matchId) return false;
        const match = matchById.get(tx.matchId);
        return match?.season === "2024/25" && match.league === league;
      })
      .sort((left, right) => merchTxNumericId(left) - merchTxNumericId(right));
    growPrevMerchSalesToTarget(transactions, prevSales, currentSales.length);
    const prevAfterGrow = transactions
      .filter((tx) => {
        if (tx.stream !== "merch" || tx.isReturn || !tx.matchId) return false;
        const match = matchById.get(tx.matchId);
        return match?.season === "2024/25" && match.league === league;
      })
      .sort((left, right) => merchTxNumericId(left) - merchTxNumericId(right));
    trimPrevMerchSalesToTarget(transactions, prevAfterGrow, currentSales.length);
  }

  const currentOff = transactions
    .filter(
      (tx) =>
        tx.stream === "merch" &&
        !tx.isReturn &&
        !tx.matchId &&
        isDateInInclusiveBounds(tx.date, curOffBounds.min, curOffBounds.max),
    )
    .sort((left, right) => merchTxNumericId(left) - merchTxNumericId(right));
  const prevOff = transactions
    .filter(
      (tx) =>
        tx.stream === "merch" &&
        !tx.isReturn &&
        !tx.matchId &&
        isDateInInclusiveBounds(tx.date, prevOffBounds.min, prevOffBounds.max),
    )
    .sort((left, right) => merchTxNumericId(left) - merchTxNumericId(right));
  growPrevMerchSalesToTarget(transactions, prevOff, currentOff.length);
  const prevOffAfterGrow = transactions
    .filter(
      (tx) =>
        tx.stream === "merch" &&
        !tx.isReturn &&
        !tx.matchId &&
        isDateInInclusiveBounds(tx.date, prevOffBounds.min, prevOffBounds.max),
    )
    .sort((left, right) => merchTxNumericId(left) - merchTxNumericId(right));
  trimPrevMerchSalesToTarget(transactions, prevOffAfterGrow, currentOff.length);

  nudgePrevMerchReturns(transactions, matchById);
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
/** Independent of `rand` so loyalty rate can move without reshuffling occupancy/plan. */
const loyaltyRand = seededRandom(20260515);
/**
 * Share of paid txs that get 5/10/15% off. Tuned so the tickets-tab KPI
 * «Скидка программы лояльности» matches production (~3.1%).
 */
const LOYALTY_DISCOUNT_APPLY_RATE = 0.304;

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
        // Bowl size only. Per-sector seats live in arena-sector-inventory (shared venue map).
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

function applySoldOutAttendance(matches: Match[]): void {
  for (const match of matches) {
    if (!match.eventCompleted) continue;
    if (isSoldOutOccupancyMatch(match)) {
      match.attendance = match.capacity;
    }
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
  applySoldOutAttendance(allMatches);
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
  // Historical 32% gate still draws from `rand` so later mock streams stay put.
  if (rand() <= 0.32) {
    randomInt(0, 2);
  }
  if (loyaltyRand() > LOYALTY_DISCOUNT_APPLY_RATE) {
    return { amount: grossAmount, loyaltyDiscount: 0 };
  }
  const discountPct = ([5, 10, 15] as const)[Math.floor(loyaltyRand() * 3)];
  const loyaltyDiscount = Math.round(grossAmount * (discountPct / 100));
  return {
    amount: grossAmount - loyaltyDiscount,
    loyaltyDiscount,
  };
}

/** Paid ticket amount after optional 5/10/15% loyalty discount (~3.1% of gross). */
function resolveTicketPayment(grossAmount: number): {
  amount: number;
  loyaltyDiscount?: number;
} {
  const { amount, loyaltyDiscount } = applyLoyaltyDiscount(grossAmount);
  return {
    amount,
    loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
  };
}

/** Occupancy-fill tickets keep the tickets-tab loyalty KPI at ~3.1%. */
const OCCUPANCY_FILL_LOYALTY_RATE = 0.031;

function resolveTicketPaymentWithRate(
  grossAmount: number,
  lockedLoyaltyRate?: number,
): { amount: number; loyaltyDiscount?: number } {
  if (lockedLoyaltyRate == null) {
    return resolveTicketPayment(grossAmount);
  }
  if (!(grossAmount > 0) || !(lockedLoyaltyRate > 0)) {
    return { amount: grossAmount };
  }
  const loyaltyDiscount = Math.round(grossAmount * lockedLoyaltyRate);
  return {
    amount: grossAmount - loyaltyDiscount,
    loyaltyDiscount: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
  };
}

const HIGH_DEMAND_OPPONENTS = new Set(["Ак Барс", "Локомотив", "Трактор"]);
const LOW_DEMAND_OPPONENTS = new Set(["Сочи", "Торпедо"]);

/** Opponent variance around the ticket-count plan; revenue cap is applied after. */
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

function randomSaleDate(match: Match, explicit?: Date): Date {
  if (explicit) return explicit;

  const salesWindowDays = getMatchTicketSalesWindowDays(match);
  const saleEnd = match.date > MOCK_TODAY ? MOCK_TODAY : match.date;
  const saleStart = subDays(saleEnd, salesWindowDays - 1);
  const span = Math.max(0, differenceInCalendarDays(saleEnd, saleStart));
  return subDays(saleEnd, randomInt(0, span));
}

const PRICE_ZONE_UNIT_PRICE: Record<PriceZone, number> = {
  up_to_1500: 900,
  from_1500_to_2500: 2000,
  from_2500_to_4000: 3200,
  from_4000_to_6000: 5000,
};

/** Parking is a separate fixed inventory. No price zone. */
const MIN_PARKING_PAID_QUANTITY = 8;

function parkingSalesForMatch(
  match: Match,
  arenaQty: number,
  soldOut: boolean,
): number {
  const cap = getMatchParkingCapacity(match);
  if (cap <= 0) return 0;
  if (soldOut) return cap;
  if (!(match.capacity > 0) || arenaQty <= 0) {
    return Math.min(cap, MIN_PARKING_PAID_QUANTITY);
  }
  const fill = Math.min(1, arenaQty / match.capacity);
  return Math.min(
    cap,
    Math.max(MIN_PARKING_PAID_QUANTITY, Math.round(cap * fill)),
  );
}

/**
 * Paid parking tickets for one match. Never sets sector or priceZone —
 * parking is not a seating inventory combo.
 */
function appendParkingTicketSales(
  match: Match,
  dates: Date[],
  parkingTickets: number,
  startId: number,
  lockedLoyaltyRate?: number,
): { txs: Transaction[]; nextId: number } {
  if (parkingTickets <= 0) {
    return { txs: [], nextId: startId };
  }
  const saleDates =
    dates.length > 0
      ? dates
      : [startOfDay(match.date <= MOCK_TODAY ? match.date : MOCK_TODAY)];
  const txs: Transaction[] = [];
  let id = startId;
  let parkingLeft = parkingTickets;
  while (parkingLeft > 0) {
    const qty = Math.min(randomInt(1, 2), parkingLeft);
    const saleDate = saleDates[randomInt(0, saleDates.length - 1)]!;
    const orderSource = pickOrderSource();
    const payment = resolveTicketPaymentWithRate(
      TICKET_PLAN_PARKING_UNIT_PRICE * qty,
      lockedLoyaltyRate,
    );
    txs.push({
      id: `tx-${id++}`,
      date: saleDate,
      stream: "tickets",
      description: "Парковка",
      matchId: match.id,
      channel: orderSource === "box_office" ? "arena" : "online",
      amount: payment.amount,
      quantity: qty,
      loyaltyDiscount: payment.loyaltyDiscount,
      ticketType: "parking",
      orderSource,
    });
    parkingLeft -= qty;
  }
  return { txs, nextId: id };
}

function saleDatesOnOrBeforeToday(match: Match): Date[] {
  const dates = eligibleSaleDates(match);
  if (dates.length === 0) {
    dates.push(startOfDay(match.date <= MOCK_TODAY ? match.date : MOCK_TODAY));
  }
  return dates;
}

function eligibleSaleDates(match: Match): Date[] {
  const salesWindowDays = getMatchTicketSalesWindowDays(match);
  const dates: Date[] = [];
  for (let offset = salesWindowDays; offset >= 0; offset -= 1) {
    const saleDay = subDays(match.date, offset);
    if (saleDay > MOCK_TODAY) continue;
    dates.push(saleDay);
  }
  return dates;
}

type InventoryCombo = { sector: Sector; zone: PriceZone; mass: number };

function comboId(sector: Sector, zone: PriceZone): string {
  return `${sector}|${zone}`;
}

function listInventoryCombos(
  match: Pick<Match, "arena" | "league" | "capacity">,
): InventoryCombo[] {
  const sectors = getSectorCapacitiesForMatch(match);
  if (!sectors) return [];
  const combos: InventoryCombo[] = [];
  for (const sector of ALL_SECTORS) {
    const sectorCap = sectors[sector] ?? 0;
    if (!(sectorCap > 0)) continue;
    const split = splitSectorCapacity(sector, sectorCap);
    for (const zone of allowedPriceZonesForSector(sector)) {
      const mass = split[zone] ?? 0;
      if (!(mass > 0)) continue;
      combos.push({ sector, zone, mass });
    }
  }
  return combos;
}

function emitComboTicketSales(
  match: Match,
  quantities: Map<string, number>,
  dates: Date[],
  startId: number,
  tempo?: TicketSalesTempo,
  lockedLoyaltyRate?: number,
): { txs: Transaction[]; nextId: number } {
  const saleDates =
    dates.length > 0
      ? dates
      : [startOfDay(match.date <= MOCK_TODAY ? match.date : MOCK_TODAY)];
  const dailyWeights = tempo
    ? buildTicketSalesDailyWeights(saleDates.length, tempo)
    : saleDates.map(() => 0.8 + rand() * 0.4);
  const dateWeights = dailyWeights.map((weight, index) => ({
    id: String(index),
    weight,
  }));
  const txs: Transaction[] = [];
  let id = startId;

  for (const [key, qtyTotal] of quantities) {
    if (!(qtyTotal > 0)) continue;
    const sep = key.indexOf("|");
    const sector = key.slice(0, sep) as Sector;
    const zone = key.slice(sep + 1) as PriceZone;
    const byDay = allocateIntegerShares(qtyTotal, dateWeights);
    for (let index = 0; index < saleDates.length; index += 1) {
      const qty = byDay.get(String(index)) ?? 0;
      if (qty <= 0) continue;
      const unitPrice = PRICE_ZONE_UNIT_PRICE[zone];
      const orderSource = pickOrderSource();
      const payment = resolveTicketPaymentWithRate(
        unitPrice * qty,
        lockedLoyaltyRate,
      );
      txs.push({
        id: `tx-${id++}`,
        date: saleDates[index]!,
        stream: "tickets",
        description: `Билет на арену, сектор ${sector}`,
        matchId: match.id,
        channel: orderSource === "box_office" ? "arena" : "online",
        amount: payment.amount,
        quantity: qty,
        loyaltyDiscount: payment.loyaltyDiscount,
        sector,
        ticketType: "arena",
        priceZone: zone,
        orderSource,
      });
    }
  }

  return { txs, nextId: id };
}

/**
 * Class 1 and playoff matches sell out: arena issued equals sector capacities
 * (and therefore match.capacity when leftover is 0). Every allowed combo with
 * inventory gets tickets so occupancy is 100% with no empty 0% rows.
 */
function generateSoldOutMatchTicketSales(
  match: Match,
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const combos = listInventoryCombos(match);
  if (combos.length === 0) {
    return { txs: [], nextId: startId };
  }
  const quantities = new Map(
    combos.map((combo) => [comboId(combo.sector, combo.zone), combo.mass]),
  );
  const dates = saleDatesOnOrBeforeToday(match);
  const arenaSales = emitComboTicketSales(match, quantities, dates, startId);
  const arenaQty = [...quantities.values()].reduce((sum, qty) => sum + qty, 0);
  const parking = appendParkingTicketSales(
    match,
    dates,
    parkingSalesForMatch(match, arenaQty, true),
    arenaSales.nextId,
  );
  return {
    txs: [...arenaSales.txs, ...parking.txs],
    nextId: parking.nextId,
  };
}

function generatePartialMatchTicketSales(
  match: Match,
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const combos = listInventoryCombos(match);
  const dates = eligibleSaleDates(match);
  if (combos.length === 0 || dates.length === 0) {
    return { txs: [], nextId: startId };
  }

  const planTickets = getMatchPlanArenaTickets(match);
  const profile = match.ticketSalesProfile;
  const fulfillmentFactor =
    profile?.fulfillmentFactor ?? 0.9 + rand() * 0.08;
  const opponentFactor = getOpponentSalesFactor(match.opponent, match.matchClass);
  const maxArenaIssued = Math.floor(
    match.capacity * MAX_MID_REVENUE_OCCUPANCY,
  );
  const targetTickets = Math.min(
    maxArenaIssued,
    Math.round(planTickets * fulfillmentFactor * opponentFactor),
  );

  const saleDayCount = getMatchTicketSalesWindowDays(match) + 1;
  const elapsedFraction = dates.length / saleDayCount;
  const comboMass = combos.reduce((sum, combo) => sum + combo.mass, 0);
  const arenaTarget = Math.min(
    comboMass,
    maxArenaIssued,
    Math.max(
      combos.length,
      Math.round(targetTickets * elapsedFraction),
    ),
  );
  const quantities = allocateIntegerSharesWithBounds(
    arenaTarget,
    combos.map((combo) => ({
      id: comboId(combo.sector, combo.zone),
      weight: combo.mass,
      min: 1,
      max: combo.mass,
    })),
  );

  const arenaSales = emitComboTicketSales(
    match,
    quantities,
    dates,
    startId,
    profile?.tempo,
  );
  const parking = appendParkingTicketSales(
    match,
    dates,
    parkingSalesForMatch(match, arenaTarget, false),
    arenaSales.nextId,
  );
  return {
    txs: [...arenaSales.txs, ...parking.txs],
    nextId: parking.nextId,
  };
}

function generateMatchTicketSales(
  match: Match,
  startId: number,
): { txs: Transaction[]; nextId: number } {
  if (isSoldOutOccupancyMatch(match)) {
    return generateSoldOutMatchTicketSales(match, startId);
  }
  return generatePartialMatchTicketSales(match, startId);
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

type ArenaComboStat = { paid: number; issued: number; revenue: number };

function arenaComboStats(
  transactions: Transaction[],
  matchId: string,
): Map<string, ArenaComboStat> {
  const stats = new Map<string, ArenaComboStat>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (tx.matchId !== matchId || !tx.sector || !tx.priceZone) continue;
    const key = comboId(tx.sector, tx.priceZone);
    let row = stats.get(key);
    if (!row) {
      row = { paid: 0, issued: 0, revenue: 0 };
      stats.set(key, row);
    }
    if (tx.amount > 0) row.paid += tx.quantity;
    row.issued += getTicketIssuedQuantity(tx);
    row.revenue += tx.amount;
  }
  return stats;
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

  if (!upcomingMatch || isSoldOutOccupancyMatch(upcomingMatch)) {
    return { txs: [], nextId: startId };
  }

  const combos = listInventoryCombos(upcomingMatch);
  if (combos.length === 0) {
    return { txs: [], nextId: startId };
  }
  const stats = arenaComboStats(transactions, upcomingMatch.id);
  const items = combos.map((combo) => {
    const row = stats.get(comboId(combo.sector, combo.zone));
    const remain = Math.max(0, combo.mass - (row?.issued ?? 0));
    return {
      id: comboId(combo.sector, combo.zone),
      weight: remain,
      min: 0,
      max: remain,
    };
  });
  const room = items.reduce((sum, item) => sum + item.max, 0);
  if (room <= 0) {
    return { txs: [], nextId: startId };
  }
  const tickets = Math.min(randomInt(120, 280), room);
  const quantities = allocateIntegerSharesWithBounds(tickets, items);
  return emitComboTicketSales(
    upcomingMatch,
    quantities,
    [today],
    startId,
    upcomingMatch.ticketSalesProfile?.tempo,
  );
}

function generateMatchMerchSales(
  match: Match,
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;
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
    txs.push({
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
      txs.push({
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

  return { txs, nextId: id };
}

function merchMatchTableNetRevenue(
  transactions: Transaction[],
  matchId: string,
): number {
  const end = endOfDay(MOCK_TODAY);
  let revenue = 0;
  for (const tx of transactions) {
    if (tx.stream !== "merch" || tx.matchId !== matchId) continue;
    if (tx.date > end) continue;
    if (!isMerchMatchTablePoint(tx.merchSalesPoint)) continue;
    revenue += tx.isReturn ? -tx.amount : tx.amount;
  }
  return revenue;
}

function ticketRevenueThroughToday(
  transactions: Transaction[],
  matchId: string,
): number {
  const end = endOfDay(MOCK_TODAY);
  let revenue = 0;
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.matchId !== matchId) continue;
    if (tx.date > end) continue;
    revenue += tx.amount;
  }
  return revenue;
}

/**
 * After ticket occupancy/plan bands are final: apply explicit match-id
 * merch % first, else raise/lower stored merch plan so match-table
 * fulfillment is ≤103%, and 75–100% when that match's ticket revenue plan
 * is already met. Does not emit tickets.
 */
function alignMatchMerchPlanFulfillment(
  matches: Match[],
  transactions: Transaction[],
): void {
  for (const match of matches) {
    if (!match.eventCompleted) continue;
    const merchRevenue = merchMatchTableNetRevenue(transactions, match.id);
    if (!(merchRevenue > 0)) continue;

    if (applyExplicitMatchMerchPlan(match, merchRevenue)) continue;

    const ticketsMet = isTicketRevenuePlanMet(
      match,
      ticketRevenueThroughToday(transactions, match.id),
    );
    if (ticketsMet) {
      applyMatchMerchPlanFloorWhenTicketsMet(match, merchRevenue);
    }
    applyMatchMerchPlanFulfillmentBand(match, merchRevenue, ticketsMet);
  }
}

function ensureCompletedMatchMerchSales(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const withMerch = new Set<string>();
  for (const tx of transactions) {
    if (tx.stream === "merch" && tx.matchId) {
      withMerch.add(tx.matchId);
    }
  }

  const txs: Transaction[] = [];
  let id = startId;
  for (const match of allMatches) {
    if (!match.eventCompleted || withMerch.has(match.id)) continue;
    const generated = generateMatchMerchSales(match, id);
    txs.push(...generated.txs);
    id = generated.nextId;
    withMerch.add(match.id);
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
    // Sold-out bowls cannot take free tickets; merch for those matches is
    // appended after ticket coverage so occupancy/parking/loyalty/plan RNG
    // stays unchanged.
    if (isSoldOutOccupancyMatch(match)) continue;

    const freeTicketCount = randomInt(0, 2);
    const combos = listInventoryCombos(match);
    const comboStats = arenaComboStats(ticketSales.txs, match.id);
    for (let f = 0; f < freeTicketCount; f++) {
      const qty = pickMerchQuantity();
      const openCombos = combos.filter((combo) => {
        const issued = comboStats.get(comboId(combo.sector, combo.zone))?.issued ?? 0;
        return combo.mass - issued >= qty;
      });
      if (openCombos.length === 0) continue;
      const combo = randomPick(openCombos);
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
        sector: combo.sector,
        ticketType: "arena",
        priceZone: combo.zone,
        orderSource,
      });
      const key = comboId(combo.sector, combo.zone);
      const row: ArenaComboStat = comboStats.get(key) ?? {
        paid: 0,
        issued: 0,
        revenue: 0,
      };
      row.issued += qty;
      comboStats.set(key, row);
    }

    const merchSales = generateMatchMerchSales(match, id);
    transactions.push(...merchSales.txs);
    id = merchSales.nextId;
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
  id = zoneCoverage.nextId;

  const parkingCoverage = ensureParkingTicketCoverage(
    allMatches,
    transactions,
    id,
  );
  transactions.push(...parkingCoverage.txs);
  id = parkingCoverage.nextId;

  // Completed sold-out matches skipped merch above to keep ticket RNG stable.
  const completedMerch = ensureCompletedMatchMerchSales(
    allMatches,
    transactions,
    id,
  );
  transactions.push(...completedMerch.txs);

  realignPreviousSeasonMerch(transactions, allMatches);

  // After merch/itogo streams so those RNGs stay put. Occupancy bands
  // vs revenue/plan: [89%, 95%] → [89%, 96%] issued; (95%, 100%) → ≥96%;
  // ≥100% → 100% arena+parking issued.
  const midOccupancyFill = ensureMidRevenueArenaOccupancy(
    allMatches,
    transactions,
    nextMerchTxNumericId(transactions),
  );
  transactions.push(...midOccupancyFill.txs);
  const occupancyFill = ensureHighRevenueArenaOccupancy(
    allMatches,
    transactions,
    nextMerchTxNumericId(transactions),
  );
  transactions.push(...occupancyFill.txs);

  // Zone-sector widget is arena-only (issued vs match.capacity, arena plan).
  const arenaBandFill = ensureZoneSectorMatchOccupancyBands(
    allMatches,
    transactions,
    nextMerchTxNumericId(transactions),
  );
  transactions.push(...arenaBandFill.txs);

  // Then fill remaining arena seats on any combo/zone/sector/match row
  // whose revenue already beats 100% of its arena plan.
  const overPlanFill = ensureOverPlanArenaOccupancy(
    allMatches,
    transactions,
    nextMerchTxNumericId(transactions),
  );
  transactions.push(...overPlanFill.txs);

  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

const PRICE_ZONE_SEED_QUANTITY = 8;

function pushCoverageTicket(
  txs: Transaction[],
  id: number,
  match: Match,
  matchId: string,
  sector: Sector,
  zone: PriceZone,
  qty: number,
): number {
  if (!(qty > 0)) return id;
  const unitPrice = PRICE_ZONE_UNIT_PRICE[zone];
  const orderSource = pickOrderSource();
  const payment = resolveTicketPayment(unitPrice * qty);
  txs.push({
    id: `tx-${id}`,
    date: randomSaleDate(match),
    stream: "tickets",
    description: `Билет на арену, сектор ${sector}`,
    matchId,
    channel: orderSource === "box_office" ? "arena" : "online",
    amount: payment.amount,
    quantity: qty,
    loyaltyDiscount: payment.loyaltyDiscount,
    sector,
    ticketType: "arena",
    priceZone: zone,
    orderSource,
  });
  return id + 1;
}

/**
 * Guarantee paid arena tickets for every inventory sector×zone combo on
 * matches that already have arena sales. Missing allowed combos are seeded
 * only into remaining seat mass so occupancy stays ≤ 100%. Parking is skipped.
 */
function ensureTicketPriceZoneCoverage(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;

  for (const match of allMatches) {
    const combos = listInventoryCombos(match);
    if (combos.length === 0) continue;
    const stats = arenaComboStats(transactions.concat(txs), match.id);
    if (![...stats.values()].some((row) => row.paid > 0)) continue;

    const sectorIssued: Partial<Record<Sector, number>> = {};
    let matchIssued = 0;
    for (const combo of combos) {
      const issued = stats.get(comboId(combo.sector, combo.zone))?.issued ?? 0;
      matchIssued += issued;
      sectorIssued[combo.sector] = (sectorIssued[combo.sector] ?? 0) + issued;
    }
    const sectors = getSectorCapacitiesForMatch(match);
    if (!sectors) continue;

    for (const combo of combos) {
      const key = comboId(combo.sector, combo.zone);
      const row: ArenaComboStat = stats.get(key) ?? {
        paid: 0,
        issued: 0,
        revenue: 0,
      };
      if (row.paid > 0) continue;
      const remainCombo = combo.mass - row.issued;
      const remainSector =
        (sectors[combo.sector] ?? 0) - (sectorIssued[combo.sector] ?? 0);
      const remainMatch = maxRegularArenaIssued(match) - matchIssued;
      const qty = Math.min(
        PRICE_ZONE_SEED_QUANTITY,
        remainCombo,
        remainSector,
        remainMatch,
      );
      if (qty <= 0) continue;
      id = pushCoverageTicket(
        txs,
        id,
        match,
        match.id,
        combo.sector,
        combo.zone,
        qty,
      );
      const coverageTx = txs[txs.length - 1];
      row.paid += qty;
      row.issued += qty;
      row.revenue += coverageTx.amount;
      stats.set(key, row);
      matchIssued += qty;
      sectorIssued[combo.sector] = (sectorIssued[combo.sector] ?? 0) + qty;
    }
  }

  return { txs, nextId: id };
}

/**
 * Guarantee paid parking (no price zone) for every match that already has
 * arena ticket sales. Parking is a separate inventory and does not consume
 * seating mass.
 */
function ensureParkingTicketCoverage(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const paidArena = new Set<string>();
  const parkingPaid = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || !tx.matchId) continue;
    if (tx.ticketType === "arena" && tx.amount > 0) {
      paidArena.add(tx.matchId);
    }
    if (tx.ticketType === "parking" && tx.amount > 0) {
      parkingPaid.set(
        tx.matchId,
        (parkingPaid.get(tx.matchId) ?? 0) + tx.quantity,
      );
    }
  }

  const txs: Transaction[] = [];
  let id = startId;

  for (const match of allMatches) {
    if (!paidArena.has(match.id)) continue;
    const have = parkingPaid.get(match.id) ?? 0;
    const need = MIN_PARKING_PAID_QUANTITY - have;
    if (need <= 0) continue;
    const parking = appendParkingTicketSales(
      match,
      saleDatesOnOrBeforeToday(match),
      need,
      id,
    );
    txs.push(...parking.txs);
    id = parking.nextId;
    parkingPaid.set(match.id, have + need);
  }

  return { txs, nextId: id };
}

function arenaActualsForMatch(
  matchId: string,
  transactions: Transaction[],
): { issued: number; revenue: number } {
  let issued = 0;
  let revenue = 0;
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (tx.matchId !== matchId) continue;
    issued += getTicketIssuedQuantity(tx);
    revenue += tx.amount;
  }
  return { issued, revenue };
}

function emitArenaOccupancyFill(
  match: Match,
  stats: Map<string, ArenaComboStat>,
  dates: Date[],
  startId: number,
  targetIssued: number,
  maxIssued: number,
): { txs: Transaction[]; nextId: number } {
  let arenaIssued = 0;
  for (const row of stats.values()) arenaIssued += row.issued;
  const need = Math.max(0, Math.min(targetIssued, maxIssued) - arenaIssued);
  if (!(need > 0)) return { txs: [], nextId: startId };
  const quantities = allocateCheapestRemainingSeats(match, stats, need);
  const added = [...quantities.values()].reduce((sum, qty) => sum + qty, 0);
  if (!(added > 0)) return { txs: [], nextId: startId };
  return emitComboTicketSales(
    match,
    quantities,
    dates,
    startId,
    match.ticketSalesProfile?.tempo,
    OCCUPANCY_FILL_LOYALTY_RATE,
  );
}

/**
 * Zone-sector match occupancy is arena issued / match.capacity against the
 * arena ticket-plan. Fill cheapest remaining seats into the band for the
 * current arena revenue/plan; do not sell out a 89–95% match.
 */
function ensureZoneSectorMatchOccupancyBands(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;

  for (const match of allMatches) {
    if (!(match.capacity > 0)) continue;
    const current = arenaActualsForMatch(match.id, transactions.concat(txs));
    const arenaPlan = getMatchPlanArenaRevenue(match);
    if (!(arenaPlan > 0) || !(current.revenue > 0)) continue;
    if (isSoldOutOccupancyMatch(match)) continue;
    const ratio = current.revenue / arenaPlan;
    const cap = match.capacity;
    if (ratio < MID_REVENUE_PLAN_MIN) continue;
    const minIssued = Math.ceil(cap * MID_REVENUE_PLAN_MIN);
    const maxIssued = Math.floor(cap * MAX_MID_REVENUE_OCCUPANCY);
    if (current.issued >= minIssued) continue;
    const stats = arenaComboStats(transactions.concat(txs), match.id);
    const dates = saleDatesOnOrBeforeToday(match);
    const filled = emitArenaOccupancyFill(
      match,
      stats,
      dates,
      id,
      minIssued,
      maxIssued,
    );
    txs.push(...filled.txs);
    id = filled.nextId;
  }

  return { txs, nextId: id };
}

function ticketActualsForMatch(
  matchId: string,
  transactions: Transaction[],
  redemptionIssued = 0,
): {
  tickets: number;
  revenue: number;
  occupancyIssued: number;
  parkingIssued: number;
} {
  let tickets = 0;
  let revenue = 0;
  let occupancyIssued = redemptionIssued;
  let parkingIssued = 0;
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.matchId !== matchId) continue;
    tickets += tx.quantity;
    revenue += tx.amount;
    const issued = getTicketIssuedQuantity(tx);
    occupancyIssued += issued;
    if (tx.ticketType === "parking") parkingIssued += issued;
  }
  return { tickets, revenue, occupancyIssued, parkingIssued };
}

function maxRegularArenaIssued(match: Match): number {
  if (!(match.capacity > 0)) return 0;
  if (isSoldOutOccupancyMatch(match)) return match.capacity;
  return Math.floor(match.capacity * MAX_MID_REVENUE_OCCUPANCY);
}

function allocateCheapestRemainingSeats(
  match: Match,
  stats: Map<string, ArenaComboStat>,
  need: number,
): Map<string, number> {
  const quantities = new Map<string, number>();
  const combos = listInventoryCombos(match);
  const sectors = getSectorCapacitiesForMatch(match);
  if (!sectors || need <= 0 || combos.length === 0) return quantities;
  const arenaCap = maxRegularArenaIssued(match);

  let matchIssued = 0;
  const sectorIssued: Partial<Record<Sector, number>> = {};
  for (const combo of combos) {
    const issued = stats.get(comboId(combo.sector, combo.zone))?.issued ?? 0;
    matchIssued += issued;
    sectorIssued[combo.sector] = (sectorIssued[combo.sector] ?? 0) + issued;
  }

  const ranked = [...combos].sort((left, right) => {
    const priceDelta =
      PRICE_ZONE_UNIT_PRICE[left.zone] - PRICE_ZONE_UNIT_PRICE[right.zone];
    if (priceDelta !== 0) return priceDelta;
    return comboId(left.sector, left.zone).localeCompare(
      comboId(right.sector, right.zone),
    );
  });

  let remaining = need;
  for (const combo of ranked) {
    if (remaining <= 0) break;
    const key = comboId(combo.sector, combo.zone);
    const issued = stats.get(key)?.issued ?? 0;
    const room = Math.max(
      0,
      Math.min(
        combo.mass - issued,
        (sectors[combo.sector] ?? 0) - (sectorIssued[combo.sector] ?? 0),
        arenaCap - matchIssued,
        remaining,
      ),
    );
    if (room <= 0) continue;
    quantities.set(key, room);
    remaining -= room;
    matchIssued += room;
    sectorIssued[combo.sector] = (sectorIssued[combo.sector] ?? 0) + room;
  }
  return quantities;
}

/**
 * Fill cheapest remaining arena seats then leftover parking until
 * occupancyIssued reaches `targetIssued`, never exceeding `maxIssued`.
 */
function appendIssuedOccupancyFill(
  match: Match,
  current: {
    occupancyIssued: number;
    parkingIssued: number;
  },
  stats: Map<string, ArenaComboStat>,
  dates: Date[],
  startId: number,
  targetIssued: number,
  maxIssued: number,
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;
  const cap = Math.min(targetIssued, maxIssued);
  const need = Math.max(0, cap - current.occupancyIssued);
  if (!(need > 0)) return { txs, nextId: id };

  const quantities = allocateCheapestRemainingSeats(match, stats, need);
  const added = [...quantities.values()].reduce((sum, qty) => sum + qty, 0);
  if (added > 0) {
    const arenaSales = emitComboTicketSales(
      match,
      quantities,
      dates,
      id,
      match.ticketSalesProfile?.tempo,
      OCCUPANCY_FILL_LOYALTY_RATE,
    );
    txs.push(...arenaSales.txs);
    id = arenaSales.nextId;
  }

  const occupancyAfterArena = current.occupancyIssued + added;
  const parkingCap = getMatchParkingCapacity(match);
  const parkingRoom = Math.max(0, parkingCap - current.parkingIssued);
  const extraParking = Math.min(
    parkingRoom,
    Math.max(0, cap - occupancyAfterArena),
  );
  if (extraParking > 0) {
    const parking = appendParkingTicketSales(
      match,
      dates,
      extraParking,
      id,
      OCCUPANCY_FILL_LOYALTY_RATE,
    );
    txs.push(...parking.txs);
    id = parking.nextId;
  }
  return { txs, nextId: id };
}

/**
 * Revenue/plan in [89%, 95%]: fill remaining cheap inventory up to at least
 * 89% occupancy, never past 96%.
 */
function ensureMidRevenueArenaOccupancy(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
  redemptionsByMatch: Map<string, number> = new Map(),
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;

  for (const match of allMatches) {
    if (!(match.capacity > 0)) continue;
    const occupancyFloor = minMidRevenueOccupancyIssued(match.capacity);
    const occupancyCeil = maxMidRevenueOccupancyIssued(match.capacity);
    const current = ticketActualsForMatch(
      match.id,
      transactions.concat(txs),
      redemptionsByMatch.get(match.id) ?? 0,
    );
    if (current.occupancyIssued >= occupancyFloor) continue;
    const planRevenue = getMatchPlanRevenue(match);
    const arenaPlan = getMatchPlanArenaRevenue(match);
    const arena = arenaActualsForMatch(match.id, transactions.concat(txs));
    if (!(planRevenue > 0) || !(current.revenue > 0)) continue;
    const ratio = current.revenue / planRevenue;
    const arenaRatio =
      arenaPlan > 0 && arena.revenue > 0 ? arena.revenue / arenaPlan : 0;
    const inMidBand =
      (ratio >= MID_REVENUE_PLAN_MIN && ratio <= HIGH_REVENUE_PLAN_THRESHOLD) ||
      (arenaRatio >= MID_REVENUE_PLAN_MIN &&
        arenaRatio <= HIGH_REVENUE_PLAN_THRESHOLD);
    if (!inMidBand) continue;
    const stats = arenaComboStats(transactions.concat(txs), match.id);
    const dates = saleDatesOnOrBeforeToday(match);
    const filled = appendIssuedOccupancyFill(
      match,
      current,
      stats,
      dates,
      id,
      occupancyFloor,
      occupancyCeil,
    );
    txs.push(...filled.txs);
    id = filled.nextId;
  }

  return { txs, nextId: id };
}

/**
 * If revenue already beats 95% of the formula plan and is still under 100%,
 * fill remaining cheap arena seats and leftover parking up to 96% occupancy
 * of arena+parking mass instead of leaving empty inventory.
 */
function ensureHighRevenueArenaOccupancy(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;

  for (const match of allMatches) {
    if (!(match.capacity > 0)) continue;
    if (isRegularTicketPlanMatch(match)) continue;
    const occupancyFloor = minHighRevenueOccupancyIssued(match.capacity);
    const occupancyMass = occupancyMassCapacity(match.capacity);
    const current = ticketActualsForMatch(
      match.id,
      transactions.concat(txs),
    );
    if (current.occupancyIssued >= occupancyFloor) continue;
    const planRevenue = getMatchPlanRevenue(match);
    if (!(planRevenue > 0) || !(current.revenue > 0)) continue;
    const ratio = current.revenue / planRevenue;
    if (ratio <= HIGH_REVENUE_PLAN_THRESHOLD) continue;
    if (ratio >= OVER_PLAN_REVENUE_THRESHOLD) continue;

    const stats = arenaComboStats(transactions.concat(txs), match.id);
    const dates = saleDatesOnOrBeforeToday(match);
    const filled = appendIssuedOccupancyFill(
      match,
      current,
      stats,
      dates,
      id,
      occupancyFloor,
      occupancyMass,
    );
    txs.push(...filled.txs);
    id = filled.nextId;
  }

  return { txs, nextId: id };
}

function occupancyFillNetAmount(zone: PriceZone, qty: number): number {
  const gross = PRICE_ZONE_UNIT_PRICE[zone] * qty;
  return gross - Math.round(gross * OCCUPANCY_FILL_LOYALTY_RATE);
}

function isOverPlanRevenue(revenue: number, plan: number): boolean {
  return plan > 0 && revenue / plan >= OVER_PLAN_REVENUE_THRESHOLD;
}

/**
 * Per row in «Продажи по ценовым зонам и секторам на арене»: if arena
 * revenue / plan is at least 100%, fill remaining catalog seats so occupancy
 * is 100% (the display cap). Combo, then sector, then zone, then match.
 */
function allocateOverPlanArenaOccupancy(
  match: Match,
  stats: Map<string, ArenaComboStat>,
  maxMatchIssued = match.capacity,
): Map<string, number> {
  const quantities = new Map<string, number>();
  const combos = listInventoryCombos(match);
  const sectors = getSectorCapacitiesForMatch(match);
  if (!sectors || combos.length === 0 || !(match.capacity > 0)) return quantities;

  const issued = new Map<string, number>();
  const revenue = new Map<string, number>();
  const sectorIssued: Partial<Record<Sector, number>> = {};
  let matchIssued = 0;
  let matchRevenue = 0;

  for (const combo of combos) {
    const key = comboId(combo.sector, combo.zone);
    const row = stats.get(key);
    const qty = row?.issued ?? 0;
    const amount = row?.revenue ?? 0;
    issued.set(key, qty);
    revenue.set(key, amount);
    matchIssued += qty;
    matchRevenue += amount;
    sectorIssued[combo.sector] = (sectorIssued[combo.sector] ?? 0) + qty;
  }

  const arenaPlan = getMatchPlanArenaRevenue(match);
  const comboPlan = allocateIntegerShares(
    arenaPlan,
    combos.map((combo) => ({
      id: comboId(combo.sector, combo.zone),
      weight: combo.mass,
    })),
  );

  const roomOf = (combo: InventoryCombo): number => {
    const key = comboId(combo.sector, combo.zone);
    return Math.max(
      0,
      Math.min(
        combo.mass - (issued.get(key) ?? 0),
        (sectors[combo.sector] ?? 0) - (sectorIssued[combo.sector] ?? 0),
        match.capacity - matchIssued,
        Math.max(0, maxMatchIssued - matchIssued),
      ),
    );
  };

  const add = (combo: InventoryCombo, qty: number) => {
    if (!(qty > 0)) return;
    const key = comboId(combo.sector, combo.zone);
    quantities.set(key, (quantities.get(key) ?? 0) + qty);
    issued.set(key, (issued.get(key) ?? 0) + qty);
    const addedRevenue = occupancyFillNetAmount(combo.zone, qty);
    revenue.set(key, (revenue.get(key) ?? 0) + addedRevenue);
    matchIssued += qty;
    matchRevenue += addedRevenue;
    sectorIssued[combo.sector] = (sectorIssued[combo.sector] ?? 0) + qty;
  };

  const fillRemaining = (candidates: InventoryCombo[]) => {
    const ranked = [...candidates].sort((left, right) => {
      const priceDelta =
        PRICE_ZONE_UNIT_PRICE[left.zone] - PRICE_ZONE_UNIT_PRICE[right.zone];
      if (priceDelta !== 0) return priceDelta;
      return comboId(left.sector, left.zone).localeCompare(
        comboId(right.sector, right.zone),
      );
    });
    for (const combo of ranked) add(combo, roomOf(combo));
  };

  for (const combo of combos) {
    const key = comboId(combo.sector, combo.zone);
    if (isOverPlanRevenue(revenue.get(key) ?? 0, comboPlan.get(key) ?? 0)) {
      add(combo, roomOf(combo));
    }
  }

  for (const sector of ALL_SECTORS) {
    const sectorCombos = combos.filter((combo) => combo.sector === sector);
    if (sectorCombos.length === 0) continue;
    let sectorRev = 0;
    let sectorPlan = 0;
    for (const combo of sectorCombos) {
      const key = comboId(combo.sector, combo.zone);
      sectorRev += revenue.get(key) ?? 0;
      sectorPlan += comboPlan.get(key) ?? 0;
    }
    if (isOverPlanRevenue(sectorRev, sectorPlan)) fillRemaining(sectorCombos);
  }

  for (const zone of ALL_PRICE_ZONES) {
    const zoneCombos = combos.filter((combo) => combo.zone === zone);
    if (zoneCombos.length === 0) continue;
    let zoneRev = 0;
    let zonePlan = 0;
    for (const combo of zoneCombos) {
      const key = comboId(combo.sector, combo.zone);
      zoneRev += revenue.get(key) ?? 0;
      zonePlan += comboPlan.get(key) ?? 0;
    }
    if (isOverPlanRevenue(zoneRev, zonePlan)) fillRemaining(zoneCombos);
  }

  if (isOverPlanRevenue(matchRevenue, arenaPlan) && isSoldOutOccupancyMatch(match)) {
    fillRemaining(combos);
  }

  return quantities;
}

function mergeComboQuantities(
  target: Map<string, number>,
  extra: Map<string, number>,
): void {
  for (const [key, qty] of extra) {
    if (!(qty > 0)) continue;
    target.set(key, (target.get(key) ?? 0) + qty);
  }
}

function comboStatsWithQuantities(
  stats: Map<string, ArenaComboStat>,
  quantities: Map<string, number>,
): Map<string, ArenaComboStat> {
  const next = new Map<string, ArenaComboStat>();
  for (const [key, row] of stats) {
    next.set(key, { ...row });
  }
  for (const [key, qty] of quantities) {
    if (!(qty > 0)) continue;
    const row = next.get(key) ?? { paid: 0, issued: 0, revenue: 0 };
    next.set(key, {
      paid: row.paid,
      issued: row.issued + qty,
      revenue: row.revenue,
    });
  }
  return next;
}

/**
 * Fill remaining arena seats so every combo / sector / zone / match row
 * at or above its revenue plan is at 100% occupancy. When the match
 * Продажи revenue/plan is also ≥ 100%, sell leftover arena and parking
 * so «Оформлено» is 100% of arena+parking mass.
 */
function ensureOverPlanArenaOccupancy(
  allMatches: Match[],
  transactions: Transaction[],
  startId: number,
): { txs: Transaction[]; nextId: number } {
  const txs: Transaction[] = [];
  let id = startId;

  for (const match of allMatches) {
    if (!(match.capacity > 0)) continue;
    if (isRegularTicketPlanMatch(match)) continue;
    const arena = arenaActualsForMatch(match.id, transactions.concat(txs));
    const arenaPlan = getMatchPlanArenaRevenue(match);
    const arenaRatio =
      arenaPlan > 0 && arena.revenue > 0 ? arena.revenue / arenaPlan : 0;
    const maxArenaIssued = isSoldOutOccupancyMatch(match)
      ? match.capacity
      : Math.floor(match.capacity * MAX_MID_REVENUE_OCCUPANCY);
    const stats = arenaComboStats(transactions.concat(txs), match.id);
    const quantities = allocateOverPlanArenaOccupancy(
      match,
      stats,
      maxArenaIssued,
    );

    if (
      arenaRatio >= OVER_PLAN_REVENUE_THRESHOLD &&
      isSoldOutOccupancyMatch(match)
    ) {
      const statsAfter = comboStatsWithQuantities(stats, quantities);
      let arenaIssued = 0;
      for (const row of statsAfter.values()) arenaIssued += row.issued;
      const arenaNeed = Math.max(0, match.capacity - arenaIssued);
      mergeComboQuantities(
        quantities,
        allocateCheapestRemainingSeats(match, statsAfter, arenaNeed),
      );
    }

    const added = [...quantities.values()].reduce((sum, qty) => sum + qty, 0);
    const dates = saleDatesOnOrBeforeToday(match);
    if (added > 0) {
      const arenaSales = emitComboTicketSales(
        match,
        quantities,
        dates,
        id,
        match.ticketSalesProfile?.tempo,
        OCCUPANCY_FILL_LOYALTY_RATE,
      );
      txs.push(...arenaSales.txs);
      id = arenaSales.nextId;
    }

    const afterArena = ticketActualsForMatch(
      match.id,
      transactions.concat(txs),
    );
    if (!isOverPlanRevenue(afterArena.revenue, getMatchPlanRevenue(match))) {
      continue;
    }
    if (!isSoldOutOccupancyMatch(match)) continue;
    const occupancyMass = occupancyMassCapacity(match.capacity);
    const parkingCap = getMatchParkingCapacity(match);
    const parkingRoom = Math.max(0, parkingCap - afterArena.parkingIssued);
    const extraParking = Math.min(
      parkingRoom,
      Math.max(0, occupancyMass - afterArena.occupancyIssued),
    );
    if (extraParking > 0) {
      const parking = appendParkingTicketSales(
        match,
        dates,
        extraParking,
        id,
        OCCUPANCY_FILL_LOYALTY_RATE,
      );
      txs.push(...parking.txs);
      id = parking.nextId;
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
  expandSeasonSubscriptionSoldTargets(subs, allMatches);

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

/** Seed mix size before cloning up to TARGET_DEFAULT_SEASON_*_SOLD. */
const TARGET_DEFAULT_SEASON_SOLD = 85;

/** Default 2025/26 KHL KPI view: sold season tickets by tournament stage. */
export const TARGET_DEFAULT_SEASON_REGULAR_SOLD = 3500;
export const TARGET_DEFAULT_SEASON_PLAYOFF_SOLD = 1000;
export const TARGET_DEFAULT_SEASON_TOTAL_SOLD =
  TARGET_DEFAULT_SEASON_REGULAR_SOLD + TARGET_DEFAULT_SEASON_PLAYOFF_SOLD;

/**
 * 2024/25 KHL analog after cloning. Scaled up toward 2025/26 so default KPI
 * YoY for revenue, sold qty, and unique buyers stays in +0.5%…+10%.
 */
export const TARGET_PREV_SEASON_REGULAR_SOLD = 3430;
export const TARGET_PREV_SEASON_PLAYOFF_SOLD = 1000;
export const TARGET_PREV_SEASON_TOTAL_SOLD =
  TARGET_PREV_SEASON_REGULAR_SOLD + TARGET_PREV_SEASON_PLAYOFF_SOLD;

/** VHL/MHL season tickets are regular-only; two tariffs, no playoff campaign. */
export const TARGET_VHL_SEASON_SOLD = 1500;
export const TARGET_MHL_SEASON_SOLD = 1000;
/** Same ~2.04% YoY as KHL 3500 vs 3430, keeping league YoY in +0.5%…+10%. */
export const TARGET_PREV_VHL_SEASON_SOLD = 1470;
export const TARGET_PREV_MHL_SEASON_SOLD = 980;

const MINOR_LEAGUE_ARENA: Record<"VHL" | "MHL", ArenaId> = {
  VHL: "secondary",
  MHL: "main",
};

const MINOR_LEAGUE_ALL_INCLUSIVE_SHARE = 0.55;

const MINOR_LEAGUE_ALL_INCLUSIVE_PLAN = {
  id: "plan-5",
  name: "Все включено",
  price: 162500,
  matchCount: 30,
} as const;

const MINOR_LEAGUE_WEEKEND_PLAN = {
  id: "plan-1",
  name: "Выходного дня",
  price: 6500,
  matchCount: 5,
} as const;

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

function cloneSoldSubscription(source: Subscription, id: number): Subscription {
  return {
    ...source,
    id: `sub-${id}`,
    customerId: customerIdForSubscription(id),
    matchesUsed: 0,
    status: source.status === "cancelled" ? "active" : source.status,
  };
}

function expandStageToTarget(
  subs: Subscription[],
  templates: Subscription[],
  target: number,
): void {
  const usable = templates.filter((sub) => sub.status !== "cancelled");
  if (usable.length === 0 || templates.length >= target) return;

  let id = nextSubscriptionNumericId(subs);
  const needed = target - templates.length;
  for (let extraIndex = 0; extraIndex < needed; extraIndex += 1) {
    subs.push(cloneSoldSubscription(usable[extraIndex % usable.length], id++));
  }
}

function isMinorLeagueSeasonalPlan(
  sub: Pick<Subscription, "planId" | "planName">,
): boolean {
  if (sub.planId === "plan-4" || sub.planId === "plan-6") return true;
  if (
    sub.planId === "plan-1" ||
    sub.planId === "plan-2" ||
    sub.planId === "plan-3" ||
    sub.planId === "plan-5"
  ) {
    return false;
  }
  const name = sub.planName.toLowerCase();
  if (
    name.includes("все включено") ||
    name.includes("vip") ||
    name.includes("выходн")
  ) {
    return false;
  }
  return name.includes("сезон");
}

function applyMinorLeagueTariff(
  sub: Subscription,
  tariff: "all_inclusive" | "weekend",
): void {
  const plan =
    tariff === "all_inclusive"
      ? MINOR_LEAGUE_ALL_INCLUSIVE_PLAN
      : MINOR_LEAGUE_WEEKEND_PLAN;
  sub.planId = plan.id;
  sub.planName = plan.name;
  sub.price = plan.price;
  sub.matchesTotal = plan.matchCount;
  sub.matchesUsed = Math.min(sub.matchesUsed, plan.matchCount);
}

function rebalanceMinorLeagueTariffs(rows: Subscription[]): void {
  if (rows.length === 0) return;
  const allInclusiveCount = Math.round(
    rows.length * MINOR_LEAGUE_ALL_INCLUSIVE_SHARE,
  );
  rows.forEach((sub, index) => {
    applyMinorLeagueTariff(
      sub,
      index < allInclusiveCount ? "all_inclusive" : "weekend",
    );
  });
}

function normalizeMinorLeagueSubscriptions(subs: Subscription[]): void {
  for (const sub of subs) {
    if (sub.league !== "VHL" && sub.league !== "MHL") continue;
    sub.arena = MINOR_LEAGUE_ARENA[sub.league];
    if (sub.tournamentStage === "playoff") {
      sub.tournamentStage = "regular";
    }
    if (isMinorLeagueSeasonalPlan(sub)) {
      applyMinorLeagueTariff(sub, "weekend");
    }
  }
}

function subscriptionPassesMinorLeagueRegularWindow(
  sub: Subscription,
  league: "VHL" | "MHL",
  season: string,
): boolean {
  return (
    sub.league === league &&
    sub.season === season &&
    sub.tournamentStage === "regular" &&
    isInRegularSubscriptionSalesWindow(sub.purchasedAt, season)
  );
}

function ensureMinorLeagueRegularTemplates(
  subs: Subscription[],
  league: "VHL" | "MHL",
  season: string,
  arena: ArenaId,
): Subscription[] {
  const inWindow = subs.filter((sub) =>
    subscriptionPassesMinorLeagueRegularWindow(sub, league, season),
  );
  if (inWindow.length > 0) return inWindow;

  const sameSeason = subs.find(
    (sub) => sub.league === league && sub.season === season,
  );
  const fallback = sameSeason ?? subs.find((sub) => sub.league === league);
  if (!fallback) return [];

  const window = getRegularSubscriptionSalesWindow(season);
  if (sameSeason) {
    sameSeason.purchasedAt = window.start;
    sameSeason.validTo = addDays(window.start, 90);
    sameSeason.season = season;
    sameSeason.tournamentStage = "regular";
    sameSeason.arena = arena;
    return [sameSeason];
  }

  const clone = cloneSoldSubscription(fallback, nextSubscriptionNumericId(subs));
  clone.league = league;
  clone.season = season;
  clone.arena = arena;
  clone.tournamentStage = "regular";
  clone.purchasedAt = window.start;
  clone.validTo = addDays(window.start, 90);
  subs.push(clone);
  return [clone];
}

function expandMinorLeagueRegularSold(
  subs: Subscription[],
  league: "VHL" | "MHL",
  season: string,
  target: number,
): void {
  const arena = MINOR_LEAGUE_ARENA[league];
  const templates = ensureMinorLeagueRegularTemplates(
    subs,
    league,
    season,
    arena,
  );
  const usable = templates.filter((sub) => sub.status !== "cancelled");
  if (templates.length < target && usable.length > 0) {
    const window = getRegularSubscriptionSalesWindow(season);
    const span = Math.max(
      0,
      differenceInCalendarDays(window.end, window.start),
    );
    let id = nextSubscriptionNumericId(subs);
    const needed = target - templates.length;
    for (let extraIndex = 0; extraIndex < needed; extraIndex += 1) {
      const source = usable[extraIndex % usable.length];
      const purchasedAt = addDays(
        window.start,
        span === 0 ? 0 : extraIndex % (span + 1),
      );
      const clone = cloneSoldSubscription(source, id++);
      clone.league = league;
      clone.season = season;
      clone.arena = arena;
      clone.tournamentStage = "regular";
      clone.purchasedAt = purchasedAt;
      clone.validTo = addDays(purchasedAt, 90);
      subs.push(clone);
    }
  }

  rebalanceMinorLeagueTariffs(
    subs.filter((sub) =>
      subscriptionPassesMinorLeagueRegularWindow(sub, league, season),
    ),
  );
}

/**
 * Scale default-filter KHL sold counts without extra RNG, so ticket/merch
 * generation stays stable. Clones copy the existing plan mix (matchesUsed=0
 * so occupancy redemptions do not explode). VHL/MHL are regular-only with
 * two tariffs (Все включено / Выходного дня) and league-locked arenas.
 */
export function expandSeasonSubscriptionSoldTargets(
  subs: Subscription[],
  allMatches: Match[],
): void {
  expandStageToTarget(
    subs,
    subs.filter(
      (sub) =>
        sub.league === "KHL" &&
        sub.tournamentStage === "regular" &&
        subscriptionPassesDefaultSeasonFilter(sub, allMatches),
    ),
    TARGET_DEFAULT_SEASON_REGULAR_SOLD,
  );
  expandStageToTarget(
    subs,
    subs.filter(
      (sub) =>
        sub.league === "KHL" &&
        sub.tournamentStage === "playoff" &&
        subscriptionPassesDefaultSeasonFilter(sub, allMatches),
    ),
    TARGET_DEFAULT_SEASON_PLAYOFF_SOLD,
  );
  expandStageToTarget(
    subs,
    subs.filter(
      (sub) =>
        sub.league === "KHL" &&
        sub.tournamentStage === "regular" &&
        subscriptionPassesPrevSeasonDefaultFilter(sub, allMatches),
    ),
    TARGET_PREV_SEASON_REGULAR_SOLD,
  );
  expandStageToTarget(
    subs,
    subs.filter(
      (sub) =>
        sub.league === "KHL" &&
        sub.tournamentStage === "playoff" &&
        subscriptionPassesPrevSeasonDefaultFilter(sub, allMatches),
    ),
    TARGET_PREV_SEASON_PLAYOFF_SOLD,
  );

  normalizeMinorLeagueSubscriptions(subs);
  expandMinorLeagueRegularSold(subs, "VHL", "2025/26", TARGET_VHL_SEASON_SOLD);
  expandMinorLeagueRegularSold(subs, "MHL", "2025/26", TARGET_MHL_SEASON_SOLD);
  expandMinorLeagueRegularSold(
    subs,
    "VHL",
    "2024/25",
    TARGET_PREV_VHL_SEASON_SOLD,
  );
  expandMinorLeagueRegularSold(
    subs,
    "MHL",
    "2024/25",
    TARGET_PREV_MHL_SEASON_SOLD,
  );
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
          subscriptionPlans.find((plan) => plan.id === "plan-1") ??
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
  applyTicketPlanFulfillmentCap(matches, transactions, subscriptionRedemptions);
  // Class 2/3 plans are raised to ≤90% after sales. Re-fill occupancy so
  // those matches now sitting in the 89–95% revenue band have 89–96% issued.
  const arenaAfterCap = ensureZoneSectorMatchOccupancyBands(
    matches,
    transactions,
    nextMerchTxNumericId(transactions),
  );
  transactions.push(...arenaAfterCap.txs);
  const midAfterCap = ensureMidRevenueArenaOccupancy(
    matches,
    transactions,
    nextMerchTxNumericId(transactions),
  );
  transactions.push(...midAfterCap.txs);
  applyTicketPlanFulfillmentCap(matches, transactions, subscriptionRedemptions);
  // Merch plan bands after ticket occupancy/class caps so those RNGs stay put.
  alignMatchMerchPlanFulfillment(matches, transactions);
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  return { matches, transactions, subscriptions, subscriptionRedemptions };
}

function applyTicketPlanFulfillmentCap(
  matches: Match[],
  transactions: Transaction[],
  redemptions: SubscriptionRedemption[] = [],
): void {
  const actualByMatch = new Map<
    string,
    {
      tickets: number;
      revenue: number;
      occupancyIssued: number;
      arenaRevenue: number;
      arenaIssued: number;
    }
  >();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || !tx.matchId) continue;
    const row = actualByMatch.get(tx.matchId) ?? {
      tickets: 0,
      revenue: 0,
      occupancyIssued: 0,
      arenaRevenue: 0,
      arenaIssued: 0,
    };
    row.tickets += tx.quantity;
    row.revenue += tx.amount;
    const issued = getTicketIssuedQuantity(tx);
    row.occupancyIssued += issued;
    if (tx.ticketType === "arena") {
      row.arenaRevenue += tx.amount;
      row.arenaIssued += issued;
    }
    actualByMatch.set(tx.matchId, row);
  }
  for (const redemption of redemptions) {
    const row = actualByMatch.get(redemption.matchId);
    if (!row) continue;
    row.occupancyIssued += 1;
  }
  for (const match of matches) {
    const actual = actualByMatch.get(match.id);
    if (!actual) continue;
    applyMatchTicketPlanFulfillmentBand(match, actual);
    const ticketQtyCap = 1.04;
    if (actual.tickets > getMatchPlanTickets(match) * ticketQtyCap) {
      match.ticketPlanTickets = Math.ceil(actual.tickets / ticketQtyCap);
    }
  }
}

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  TICKET_SALES_WINDOW_MAX_DAYS,
  getMatchTicketSalesWindowDays,
} from "@/lib/ticket-sales-window";
import { MOCK_TODAY } from "@/lib/mock/constants";
import {
  getFirstPlayoffMatchDate,
  getPlayoffSubscriptionSalesWindow,
  getMatchById,
  getMatches,
  getSubscriptions,
  getTransactions,
  PREV_SEASON_START,
  SUBSCRIPTIONS_PERIOD_END,
  SUBSCRIPTIONS_PERIOD_START,
} from "@/lib/mock/hockey";
import {
  ORDER_SOURCE_LABELS,
  ALL_PRICE_ZONES,
  ALL_PRICE_ZONE_GROUPS,
  NO_MATCHES_FILTER_VALUE,
  TICKET_TYPE_LABELS,
  TOURNAMENT_STAGE_OPTIONS,
  getEffectiveTicketTimeGrouping,
  getPriceZoneGroup,
  getPreviousSeason,
} from "@/lib/ticket-filter-options";
import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  getMerchProductCategory,
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
  ALL_MERCH_SALES_SEGMENTS,
  getEffectiveMerchTimeGrouping,
  MERCH_SALES_SEGMENT_LABELS,
} from "@/lib/merch-filter-options";
import { getMerchListAmount } from "@/lib/merch-catalog";
import {
  getMatchPlanRevenue,
  getMatchPlanTickets,
  LEGACY_TICKET_PLAN_AVG_PRICE,
  TICKET_PLAN_AVG_PRICE,
} from "@/lib/ticket-plan";
import {
  isDateInTournamentStage,
  passesOrderDateRange,
} from "@/lib/season-dates";
import {
  matchSalesFiltersToMerchFilters,
  matchSalesFiltersToTicketFilters,
} from "@/lib/match-sales-filter-options";
import { SUBSCRIPTION_CHANNEL_LABELS } from "@/lib/subscription-filter-options";
import type {
  ChannelMixPoint,
  DashboardFilters,
  DashboardTab,
  League,
  MerchKpiData,
  Subscription,
  SubscriptionPlanStat,
  SubscriptionsKpiData,
  SubscriptionsSeasonComparison,
  TournamentStage,
  MatchSalesRow,
  Match,
  MatchRevenuePoint,
  MatchSalesFilters,
  MatchSalesKpiData,
  MatchSalesSeasonComparison,
  CombinedMatchSalesRow,
  MerchFilters,
  MerchMatchSalesRow,
  MerchProductCategory,
  MerchProductCategoryPoint,
  MerchProductCategoryTrendPoint,
  MerchSalesChannelPoint,
  MerchSalesChannelTrendPoint,
  TicketsSalesChannelTrendPoint,
  TicketsPriceZoneTrendPoint,
  PriceZone,
  PriceZoneGroup,
  MerchSalesPoint,
  MerchSalesSegment,
  MerchSalesSegmentTrendPoint,
  MerchSkuSalesRow,
  OrderSource,
  OrderSourceSalesPoint,
  PriceZoneSalesPoint,
  SubscriptionFilters,
  TicketFilters,
  TicketType,
  TicketTypeSalesPoint,
  TimeGrouping,
  MerchSeasonComparison,
  TicketsKpiData,
  TicketsSeasonComparison,
  TopProductPoint,
  Transaction,
  PlanFactTrendPoint,
  SubscriptionsPlanFactTrendPoint,
  TicketMatchCumulativeSeries,
  WeeklyPoint,
} from "@/types/dashboard";

type FilterPassCache = {
  ticket: Map<string, Transaction[]>;
  merch: Map<string, Transaction[]>;
  ticketPrevious: Map<string, Transaction[]>;
  ticketToday: Map<string, Transaction[]>;
};

let filterPassCache: FilterPassCache | null = null;

export function runWithFilterCache<T>(fn: () => T): T {
  filterPassCache = {
    ticket: new Map(),
    merch: new Map(),
    ticketPrevious: new Map(),
    ticketToday: new Map(),
  };
  try {
    return fn();
  } finally {
    filterPassCache = null;
  }
}

function ticketFilterCacheKey(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): string {
  return [
    filters.dateRange,
    filters.matchId,
    ticketFilters.season,
    ticketFilters.league,
    ticketFilters.tournamentStage,
    ticketFilters.matchClass,
    ticketFilters.arena,
    ticketFilters.eventCompleted,
    ticketFilters.matchId.join(","),
    ticketFilters.ticketType,
    ticketFilters.priceZone,
    ticketFilters.orderSource,
    ticketFilters.transactionDateRange.from ?? "",
    ticketFilters.transactionDateRange.to ?? "",
  ].join("|");
}

function merchFilterCacheKey(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  useSeasonRange: boolean,
): string {
  return [
    useSeasonRange,
    filters.dateRange,
    filters.matchId,
    merchFilters.season,
    merchFilters.league,
    merchFilters.tournamentStage,
    merchFilters.matchClass,
    merchFilters.matchId.join(","),
    merchFilters.salesChannels.join(","),
    merchFilters.orderDateRange.from ?? "",
    merchFilters.orderDateRange.to ?? "",
  ].join("|");
}

function passesMerchOrderDate(
  tx: Transaction,
  orderDateRange: MerchFilters["orderDateRange"],
): boolean {
  return passesOrderDateRange(tx.date, orderDateRange);
}

function getDateCutoff(days: number): Date {
  return startOfDay(subDays(MOCK_TODAY, days));
}

type SubscriptionDateRange = { start: Date; end: Date };

const CURRENT_SEASON = "2025/26";

function getRegularSubscriptionPeriod(): SubscriptionDateRange {
  return {
    start: startOfDay(SUBSCRIPTIONS_PERIOD_START),
    end: endOfDay(SUBSCRIPTIONS_PERIOD_END),
  };
}

function getPlayoffSubscriptionPeriod(season: string): SubscriptionDateRange | null {
  const firstPlayoffMatch = getFirstPlayoffMatchDate(getMatches(), season);
  if (!firstPlayoffMatch) return null;

  const window = getPlayoffSubscriptionSalesWindow(firstPlayoffMatch);
  return {
    start: startOfDay(window.start),
    end: endOfDay(window.end),
  };
}

function getSubscriptionsDisplayPeriod(
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionDateRange {
  if (subscriptionFilters?.tournamentStage === "playoff") {
    const season =
      subscriptionFilters.season !== "all"
        ? subscriptionFilters.season
        : CURRENT_SEASON;
    const playoffPeriod = getPlayoffSubscriptionPeriod(season);
    if (playoffPeriod) return playoffPeriod;
  }

  return getRegularSubscriptionPeriod();
}

function getSubscriptionsTrendDisplayPeriod(
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionDateRange {
  const regular = getRegularSubscriptionPeriod();
  let start = regular.start;
  let end = regular.end;

  const seasons =
    subscriptionFilters?.season && subscriptionFilters.season !== "all"
      ? [subscriptionFilters.season]
      : Array.from(new Set(getSubscriptions().map((sub) => sub.season)));

  for (const season of seasons) {
    const playoffPeriod = getPlayoffSubscriptionPeriod(season);
    if (!playoffPeriod) continue;
    if (playoffPeriod.start < start) start = playoffPeriod.start;
    if (playoffPeriod.end > end) end = playoffPeriod.end;
  }

  return { start, end };
}

function getSubscriptionsPeriodDays(
  subscriptionFilters?: SubscriptionFilters,
): number {
  const { start, end } = getSubscriptionsDisplayPeriod(subscriptionFilters);
  return differenceInCalendarDays(end, start) + 1;
}

function isDateInSubscriptionPeriod(
  date: Date,
  range: SubscriptionDateRange,
): boolean {
  return date >= range.start && date <= range.end;
}

function subscriptionMatchesSalesWindow(
  sub: Subscription,
  subscriptionFilters?: SubscriptionFilters,
): boolean {
  if (subscriptionFilters?.tournamentStage === "playoff") {
    const season =
      subscriptionFilters.season !== "all" ? subscriptionFilters.season : sub.season;
    const playoffPeriod = getPlayoffSubscriptionPeriod(season);
    if (!playoffPeriod) return false;
    return isDateInSubscriptionPeriod(sub.purchasedAt, playoffPeriod);
  }

  if (subscriptionFilters?.tournamentStage === "regular") {
    return isDateInSubscriptionPeriod(
      sub.purchasedAt,
      getRegularSubscriptionPeriod(),
    );
  }

  if (sub.tournamentStage === "playoff") {
    const playoffPeriod = getPlayoffSubscriptionPeriod(sub.season);
    if (!playoffPeriod) return false;
    return isDateInSubscriptionPeriod(sub.purchasedAt, playoffPeriod);
  }

  return isDateInSubscriptionPeriod(
    sub.purchasedAt,
    getRegularSubscriptionPeriod(),
  );
}

function isSubscriptionActive(sub: Subscription, asOf: Date): boolean {
  return (
    sub.matchesUsed < sub.matchesTotal &&
    sub.validTo >= startOfDay(asOf)
  );
}

function buildSubscriptionsSparkline<T>(
  items: T[],
  getDate: (item: T) => Date,
  getValue: (slice: T[]) => number,
  subscriptionFilters?: SubscriptionFilters,
): number[] {
  const { start: periodStart, end: periodEnd } =
    getSubscriptionsDisplayPeriod(subscriptionFilters);
  const days = getSubscriptionsPeriodDays(subscriptionFilters);
  const points: number[] = [];
  const step = Math.max(1, Math.floor(days / 7));

  for (let i = days - 1; i >= 0; i -= step) {
    const from = startOfDay(subDays(periodEnd, i + step));
    const to = endOfDay(subDays(periodEnd, i));
    const effectiveFrom = from < periodStart ? periodStart : from;
    const effectiveTo = to > periodEnd ? periodEnd : to;
    const slice = items.filter((item) => {
      const d = getDate(item);
      return d >= effectiveFrom && d <= effectiveTo;
    });
    points.push(getValue(slice));
  }

  return points;
}

function getTicketsSeasonCutoff(season: TicketFilters["season"] = "all"): Date {
  const seasonMatches = getMatches().filter((match) =>
    season === "all" ? true : match.season === season,
  );

  if (seasonMatches.length === 0) {
    return startOfDay(PREV_SEASON_START);
  }

  const earliestMatchDate = seasonMatches.reduce(
    (earliest, match) => (match.date < earliest ? match.date : earliest),
    seasonMatches[0].date,
  );

  return startOfDay(subDays(earliestMatchDate, TICKET_SALES_WINDOW_MAX_DAYS));
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function getMatchTournamentStage(match: Match): TournamentStage {
  return match.matchClass === "playoff" ? "playoff" : "regular";
}

function matchesTournamentStage(
  match: Match,
  stage: TournamentStage | "all",
): boolean {
  if (stage === "all") return true;
  return getMatchTournamentStage(match) === stage;
}

function passesMerchTournamentStage(
  tx: Transaction,
  merchFilters: MerchFilters,
): boolean {
  if (merchFilters.tournamentStage === "all") return true;

  if (tx.matchId) {
    const match = getMatchById().get(tx.matchId);
    return Boolean(match && matchesTournamentStage(match, merchFilters.tournamentStage));
  }

  return isDateInTournamentStage(
    tx.date,
    merchFilters.season,
    merchFilters.tournamentStage,
  );
}

function buildSparkline<T>(
  items: T[],
  days: number,
  getDate: (item: T) => Date,
  getValue: (slice: T[]) => number,
): number[] {
  const step = Math.max(1, Math.floor(days / 7));
  const buckets: T[][] = [];
  const bounds: { from: number; to: number }[] = [];

  for (let i = days - 1; i >= 0; i -= step) {
    buckets.push([]);
    bounds.push({
      from: startOfDay(subDays(MOCK_TODAY, i + step)).getTime(),
      to: endOfDay(subDays(MOCK_TODAY, i)).getTime(),
    });
  }

  for (const item of items) {
    const timestamp = getDate(item).getTime();
    for (let bucketIndex = 0; bucketIndex < bounds.length; bucketIndex += 1) {
      const { from, to } = bounds[bucketIndex];
      if (timestamp >= from && timestamp <= to) {
        buckets[bucketIndex].push(item);
        break;
      }
    }
  }

  return buckets.map(getValue);
}

function buildTransactionSparkline(
  txs: Transaction[],
  days: number,
  getValue: (tx: Transaction) => number,
): number[] {
  const step = Math.max(1, Math.floor(days / 7));
  const sums: number[] = [];
  const bounds: { from: number; to: number }[] = [];

  for (let i = days - 1; i >= 0; i -= step) {
    sums.push(0);
    bounds.push({
      from: startOfDay(subDays(MOCK_TODAY, i + step)).getTime(),
      to: endOfDay(subDays(MOCK_TODAY, i)).getTime(),
    });
  }

  for (const tx of txs) {
    const timestamp = tx.date.getTime();
    for (let bucketIndex = 0; bucketIndex < bounds.length; bucketIndex += 1) {
      const { from, to } = bounds[bucketIndex];
      if (timestamp >= from && timestamp <= to) {
        sums[bucketIndex] += getValue(tx);
        break;
      }
    }
  }

  return sums;
}

function passesMatchIdFilter(
  matchId: string,
  selectedMatchIds: string[],
  selectedMatchIdSet?: Set<string>,
): boolean {
  if (selectedMatchIds.length === 0) return true;
  if (
    selectedMatchIds.length === 1 &&
    selectedMatchIds[0] === NO_MATCHES_FILTER_VALUE
  ) {
    return false;
  }
  return (selectedMatchIdSet ?? new Set(selectedMatchIds)).has(matchId);
}

export function filterMatchesByMerchFilters(
  merchFilters: MerchFilters,
  dateRange?: number,
) {
  const cutoff = dateRange ? getDateCutoff(dateRange) : null;

  return getMatches().filter((match) => {
    if (cutoff && match.date < cutoff && match.eventCompleted) return false;
    if (merchFilters.season !== "all" && match.season !== merchFilters.season) {
      return false;
    }
    if (merchFilters.league !== "all" && match.league !== merchFilters.league) {
      return false;
    }
    if (
      merchFilters.tournamentStage !== "all" &&
      !matchesTournamentStage(match, merchFilters.tournamentStage)
    ) {
      return false;
    }
    if (
      merchFilters.matchClass !== "all" &&
      match.matchClass !== merchFilters.matchClass
    ) {
      return false;
    }
    if (!passesMatchIdFilter(match.id, merchFilters.matchId)) {
      return false;
    }
    return true;
  });
}

function passesMerchSalesChannels(
  tx: Transaction,
  salesChannels: MerchFilters["salesChannels"],
): boolean {
  if (salesChannels.length === 0) return false;
  if (salesChannels.length >= ALL_MERCH_SALES_POINTS.length) return true;
  return Boolean(tx.merchSalesPoint && salesChannels.includes(tx.merchSalesPoint));
}


const MERCH_MATCH_TABLE_EXCLUDED_POINTS = new Set<MerchSalesPoint>([
  "online_store",
  "mall_raduga",
  "mall_continent",
]);

const MATCHDAY_ARENA_POINTS = new Set<MerchSalesPoint>([
  "flagship",
  "arena_north",
  "arena_south",
]);

const OFFLINE_MERCH_POINTS = new Set<MerchSalesPoint>([
  "flagship",
  "arena_north",
  "arena_south",
  "mall_raduga",
  "mall_continent",
]);

function buildArenaMatchDayTimestamps(merchFilters: MerchFilters): Set<number> {
  const timestamps = new Set<number>();
  for (const match of filterMatchesByMerchFilters(merchFilters)) {
    if (match.eventCompleted) {
      timestamps.add(startOfDay(match.date).getTime());
    }
  }
  return timestamps;
}

function buildMatchDateById(merchFilters: MerchFilters): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const match of filterMatchesByMerchFilters(merchFilters)) {
    map.set(match.id, match.date);
  }
  return map;
}

function isMerchTransactionOnMatchDay(
  tx: Transaction,
  matchDatesById: Map<string, Date>,
  arenaMatchDayTimestamps: Set<number>,
): boolean {
  if (tx.matchId) {
    const matchDate = matchDatesById.get(tx.matchId);
    if (matchDate && isSameDay(tx.date, matchDate)) {
      return true;
    }
  }
  return arenaMatchDayTimestamps.has(startOfDay(tx.date).getTime());
}

function classifyMerchSalesSegment(
  tx: Transaction,
  matchDatesById: Map<string, Date>,
  arenaMatchDayTimestamps: Set<number>,
): MerchSalesSegment | null {
  if (!tx.merchSalesPoint) return null;

  const point = tx.merchSalesPoint;

  if (point === "online_store") {
    return "online";
  }

  if (
    MATCHDAY_ARENA_POINTS.has(point) &&
    isMerchTransactionOnMatchDay(tx, matchDatesById, arenaMatchDayTimestamps)
  ) {
    return "matchday";
  }

  if (OFFLINE_MERCH_POINTS.has(point)) {
    return "offline";
  }

  return null;
}

type MerchAggregateMetrics = {
  revenue: number;
  receipts: number;
  units: number;
  cost: number;
  returnsValue: number;
  grossSales: number;
};

export type MerchTotals = MerchAggregateMetrics;

function getMerchCost(tx: Transaction): number {
  return tx.costAmount ?? Math.round(tx.amount * 0.55);
}

function createMerchMetrics(): MerchAggregateMetrics {
  return {
    revenue: 0,
    receipts: 0,
    units: 0,
    cost: 0,
    returnsValue: 0,
    grossSales: 0,
  };
}

function applyMerchTransaction(
  metrics: MerchAggregateMetrics,
  tx: Transaction,
): void {
  if (tx.isReturn) {
    metrics.revenue -= tx.amount;
    metrics.units -= tx.quantity;
    metrics.receipts = Math.max(0, metrics.receipts - 1);
    metrics.cost -= getMerchCost(tx);
    metrics.returnsValue += tx.amount;
    return;
  }

  metrics.revenue += tx.amount;
  metrics.units += tx.quantity;
  metrics.receipts += 1;
  metrics.cost += getMerchCost(tx);
  metrics.grossSales += tx.amount;
}

function aggregateMerchTransactions(txs: Transaction[]): MerchAggregateMetrics {
  const metrics = createMerchMetrics();
  for (const tx of txs) {
    applyMerchTransaction(metrics, tx);
  }
  return metrics;
}

function getFilteredMerchTransactions(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): Transaction[] {
  return filterMerchTransactions(filters, merchFilters, { useSeasonRange: true });
}

export function computeMerchTotals(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchTotals {
  return aggregateMerchTransactions(getFilteredMerchTransactions(filters, merchFilters));
}

export function filterMerchTransactions(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  options?: { useSeasonRange?: boolean },
): Transaction[] {
  const useSeasonRange = options?.useSeasonRange ?? true;
  if (filterPassCache) {
    const key = merchFilterCacheKey(filters, merchFilters, useSeasonRange);
    const cached = filterPassCache.merch.get(key);
    if (cached) return cached;
    const result = filterMerchTransactionsImpl(filters, merchFilters, useSeasonRange);
    filterPassCache.merch.set(key, result);
    return result;
  }
  return filterMerchTransactionsImpl(filters, merchFilters, useSeasonRange);
}

function filterMerchTransactionsImpl(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  useSeasonRange: boolean,
): Transaction[] {
  const cutoff = useSeasonRange
    ? getTicketsSeasonCutoff(merchFilters.season)
    : getDateCutoff(filters.dateRange);
  const allowedMatches = filterMatchesByMerchFilters(
    merchFilters,
    useSeasonRange ? undefined : filters.dateRange,
  );
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));

  return getTransactions().filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    if (tx.stream !== "merch") return false;
    if (!passesMerchSalesChannels(tx, merchFilters.salesChannels)) return false;
    if (!passesMerchOrderDate(tx, merchFilters.orderDateRange)) {
      return false;
    }
    if (!tx.matchId) {
      if (merchFilters.matchId.length > 0) return false;
      return passesMerchTournamentStage(tx, merchFilters);
    }
    if (!allowedMatchIds.has(tx.matchId)) return false;
    return passesMerchTournamentStage(tx, merchFilters);
  });
}

export function filterMatchesByTicketFilters(
  ticketFilters: TicketFilters,
  dateRange?: number,
) {
  const cutoff = dateRange ? getDateCutoff(dateRange) : null;
  const selectedMatchIdSet =
    ticketFilters.matchId.length > 0
      ? new Set(ticketFilters.matchId)
      : undefined;

  return getMatches().filter((match) => {
    if (cutoff && match.date < cutoff && match.eventCompleted) return false;
    if (ticketFilters.season !== "all" && match.season !== ticketFilters.season) {
      return false;
    }
    if (ticketFilters.league !== "all" && match.league !== ticketFilters.league) {
      return false;
    }
    if (
      ticketFilters.tournamentStage !== "all" &&
      !matchesTournamentStage(match, ticketFilters.tournamentStage)
    ) {
      return false;
    }
    if (
      ticketFilters.matchClass !== "all" &&
      match.matchClass !== ticketFilters.matchClass
    ) {
      return false;
    }
    if (ticketFilters.arena !== "all" && match.arena !== ticketFilters.arena) {
      return false;
    }
    if (ticketFilters.eventCompleted === "yes" && !match.eventCompleted) {
      return false;
    }
    if (ticketFilters.eventCompleted === "no" && match.eventCompleted) {
      return false;
    }
    if (!passesMatchIdFilter(match.id, ticketFilters.matchId, selectedMatchIdSet)) {
      return false;
    }
    return true;
  });
}

function isTicketTransactionAllowed(
  tx: Transaction,
  allowedMatchIds: Set<string>,
  ticketFilters?: TicketFilters,
): boolean {
  if (tx.stream !== "tickets" || !tx.matchId) return false;
  if (!allowedMatchIds.has(tx.matchId)) return false;
  if (ticketFilters?.tournamentStage && ticketFilters.tournamentStage !== "all") {
    const match = getMatchById().get(tx.matchId);
    if (!match || !matchesTournamentStage(match, ticketFilters.tournamentStage)) {
      return false;
    }
  }
  return true;
}

export function filterTicketTransactions(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): Transaction[] {
  if (filterPassCache) {
    const key = ticketFilterCacheKey(filters, ticketFilters);
    const cached = filterPassCache.ticket.get(key);
    if (cached) return cached;
    const result = filterTicketTransactionsImpl(filters, ticketFilters);
    filterPassCache.ticket.set(key, result);
    return result;
  }
  return filterTicketTransactionsImpl(filters, ticketFilters);
}

function filterTicketTransactionsImpl(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): Transaction[] {
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));

  return getTransactions().filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    return passesTicketFilters(tx, ticketFilters, allowedMatchIds);
  });
}

function filterMatches(filters: DashboardFilters) {
  const cutoff = getDateCutoff(filters.dateRange);
  return getMatches().filter((m) => {
    if (m.date < cutoff || m.date > endOfDay(MOCK_TODAY)) return false;
    if (filters.matchId !== "all" && m.id !== filters.matchId) return false;
    return true;
  });
}

export function filterTransactions(
  filters: DashboardFilters,
  stream?: "tickets" | "merch",
): Transaction[] {
  const cutoff = getDateCutoff(filters.dateRange);

  return getTransactions().filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    if (stream && tx.stream !== stream) return false;
    if (filters.matchId !== "all" && tx.matchId !== filters.matchId) return false;
    return true;
  });
}

export function filterSubscriptions(
  _filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): Subscription[] {
  return getSubscriptions().filter((sub) => {
    if (!subscriptionMatchesSalesWindow(sub, subscriptionFilters)) return false;
    if (!subscriptionFilters) return true;
    if (
      subscriptionFilters.season !== "all" &&
      sub.season !== subscriptionFilters.season
    ) {
      return false;
    }
    if (
      subscriptionFilters.league !== "all" &&
      sub.league !== subscriptionFilters.league
    ) {
      return false;
    }
    if (
      subscriptionFilters.tournamentStage !== "all" &&
      sub.tournamentStage !== subscriptionFilters.tournamentStage
    ) {
      return false;
    }
    if (
      subscriptionFilters.arena !== "all" &&
      sub.arena !== subscriptionFilters.arena
    ) {
      return false;
    }
    if (
      subscriptionFilters.ticketType !== "all" &&
      sub.ticketType !== subscriptionFilters.ticketType
    ) {
      return false;
    }
    if (
      subscriptionFilters.priceZone !== "all" &&
      sub.priceZone !== subscriptionFilters.priceZone
    ) {
      return false;
    }
    return true;
  });
}

function sumAmount(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => sum + tx.amount, 0);
}

function countUnits(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => sum + tx.quantity, 0);
}

function countTickets(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => sum + tx.quantity, 0);
}

function countIssuedTickets(txs: Transaction[]): number {
  let total = 0;
  for (const tx of txs) {
    const freeQty = tx.freeQuantity ?? (tx.amount === 0 ? tx.quantity : 0);
    total += freeQty;
    if (tx.amount > 0) {
      total += tx.quantity;
    }
  }
  return total;
}

function sumLoyaltyDiscount(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => sum + (tx.loyaltyDiscount ?? 0), 0);
}

function avgTicketPrice(txs: Transaction[]): number {
  const tickets = countTickets(txs);
  return tickets > 0 ? sumAmount(txs) / tickets : 0;
}

function matchLevelTicketFilters(ticketFilters: TicketFilters): TicketFilters {
  return {
    ...ticketFilters,
    ticketType: "all",
    priceZone: "all",
    orderSource: "all",
  };
}

function passesTicketFilters(
  tx: Transaction,
  ticketFilters: TicketFilters,
  allowedMatchIds: Set<string>,
): boolean {
  if (!isTicketTransactionAllowed(tx, allowedMatchIds, ticketFilters)) return false;
  if (
    ticketFilters.ticketType !== "all" &&
    tx.ticketType !== ticketFilters.ticketType
  ) {
    return false;
  }
  if (ticketFilters.priceZone !== "all" && tx.priceZone !== ticketFilters.priceZone) {
    return false;
  }
  if (ticketFilters.orderSource !== "all" && tx.orderSource !== ticketFilters.orderSource) {
    return false;
  }
  if (!passesMerchOrderDate(tx, ticketFilters.transactionDateRange)) {
    return false;
  }
  return true;
}

function ticketTodayCacheKey(ticketFilters: TicketFilters): string {
  return [
    ticketFilters.season,
    ticketFilters.league,
    ticketFilters.tournamentStage,
    ticketFilters.matchClass,
    ticketFilters.arena,
    ticketFilters.eventCompleted,
    ticketFilters.matchId.join(","),
    ticketFilters.ticketType,
    ticketFilters.priceZone,
    ticketFilters.orderSource,
    ticketFilters.transactionDateRange.from ?? "",
    ticketFilters.transactionDateRange.to ?? "",
  ].join("|");
}

export function filterTicketTransactionsToday(
  ticketFilters: TicketFilters,
): Transaction[] {
  if (filterPassCache) {
    const key = ticketTodayCacheKey(ticketFilters);
    const cached = filterPassCache.ticketToday.get(key);
    if (cached) return cached;
    const result = filterTicketTransactionsTodayImpl(ticketFilters);
    filterPassCache.ticketToday.set(key, result);
    return result;
  }
  return filterTicketTransactionsTodayImpl(ticketFilters);
}

function filterTicketTransactionsTodayImpl(
  ticketFilters: TicketFilters,
): Transaction[] {
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));
  const now = MOCK_TODAY;

  return getTransactions().filter((tx) => {
    if (!isSameDay(tx.date, now)) return false;
    return passesTicketFilters(tx, ticketFilters, allowedMatchIds);
  });
}

function previousPeriodTicketTransactions(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): Transaction[] {
  if (filterPassCache) {
    const key = `${ticketFilterCacheKey(filters, ticketFilters)}|previous`;
    const cached = filterPassCache.ticketPrevious.get(key);
    if (cached) return cached;
    const result = previousPeriodTicketTransactionsImpl(filters, ticketFilters);
    filterPassCache.ticketPrevious.set(key, result);
    return result;
  }
  return previousPeriodTicketTransactionsImpl(filters, ticketFilters);
}

function previousPeriodTicketTransactionsImpl(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): Transaction[] {
  const prevCutoff = getDateCutoff(filters.dateRange * 2);
  const midCutoff = getDateCutoff(filters.dateRange);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));

  return getTransactions().filter((tx) => {
    if (tx.date < prevCutoff || tx.date >= midCutoff) return false;
    return passesTicketFilters(tx, ticketFilters, allowedMatchIds);
  });
}

function previousPeriodTransactions(
  filters: DashboardFilters,
  stream: "tickets" | "merch",
): Transaction[] {
  const prevCutoff = getDateCutoff(filters.dateRange * 2);
  const midCutoff = getDateCutoff(filters.dateRange);

  return getTransactions().filter((tx) => {
    if (tx.date < prevCutoff || tx.date >= midCutoff) return false;
    if (tx.stream !== stream) return false;
    if (filters.matchId !== "all" && tx.matchId !== filters.matchId) return false;
    return true;
  });
}

function previousPeriodSubscriptions(
  subscriptionFilters?: SubscriptionFilters,
): Subscription[] {
  const { start: periodStart } = getSubscriptionsDisplayPeriod(subscriptionFilters);
  const periodDays = getSubscriptionsPeriodDays(subscriptionFilters);
  const prevEnd = endOfDay(subDays(periodStart, 1));
  const prevStart = startOfDay(subDays(prevEnd, periodDays - 1));

  return getSubscriptions().filter((sub) => {
    if (sub.purchasedAt < prevStart || sub.purchasedAt > prevEnd) return false;
    if (!subscriptionFilters) return true;
    if (
      subscriptionFilters.season !== "all" &&
      sub.season !== subscriptionFilters.season
    ) {
      return false;
    }
    if (
      subscriptionFilters.league !== "all" &&
      sub.league !== subscriptionFilters.league
    ) {
      return false;
    }
    if (
      subscriptionFilters.tournamentStage !== "all" &&
      sub.tournamentStage !== subscriptionFilters.tournamentStage
    ) {
      return false;
    }
    if (
      subscriptionFilters.arena !== "all" &&
      sub.arena !== subscriptionFilters.arena
    ) {
      return false;
    }
    if (
      subscriptionFilters.ticketType !== "all" &&
      sub.ticketType !== subscriptionFilters.ticketType
    ) {
      return false;
    }
    if (
      subscriptionFilters.priceZone !== "all" &&
      sub.priceZone !== subscriptionFilters.priceZone
    ) {
      return false;
    }
    return true;
  });
}

export function computeTicketsKpis(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): TicketsKpiData {
  const current = filterTicketTransactions(filters, ticketFilters);
  const previous = previousPeriodTicketTransactions(filters, ticketFilters);
  const todayTxs = filterTicketTransactionsToday(ticketFilters);

  const metrics = computeTicketsKpiMetrics(filters, ticketFilters, current);

  const prevRevenue = sumAmount(previous);
  const prevTickets = countTickets(previous);
  const prevAvgPrice = avgTicketPrice(previous);
  const prevLoyaltyDiscount = sumLoyaltyDiscount(previous);

  const seasonComparison = buildTicketsSeasonComparison(
    filters,
    ticketFilters,
    metrics,
  );

  return {
    revenue: metrics.revenue,
    revenueChange: pctChange(metrics.revenue, prevRevenue),
    ticketsSold: metrics.ticketsSold,
    ticketsChange: pctChange(metrics.ticketsSold, prevTickets),
    avgPrice: metrics.avgPrice,
    avgPriceChange: pctChange(metrics.avgPrice, prevAvgPrice),
    loyaltyDiscount: metrics.loyaltyDiscount,
    loyaltyDiscountPct: metrics.loyaltyDiscountPct,
    loyaltyDiscountChange: pctChange(metrics.loyaltyDiscount, prevLoyaltyDiscount),
    fillRate: metrics.fillRate,
    planCompletionPct: metrics.planCompletionPct,
    revenueToday: sumAmount(todayTxs),
    ticketsToday: countTickets(todayTxs),
    revenueSparkline: buildTransactionSparkline(
      current,
      filters.dateRange,
      (tx) => tx.amount,
    ),
    ticketsSparkline: buildTransactionSparkline(
      current,
      filters.dateRange,
      (tx) => tx.quantity,
    ),
    seasonComparison,
  };
}

type TicketsKpiMetrics = {
  revenue: number;
  ticketsSold: number;
  avgPrice: number;
  loyaltyDiscount: number;
  loyaltyDiscountPct: number;
  fillRate: number;
  planCompletionPct: number;
};

function computeTicketsKpiMetrics(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  txs?: Transaction[],
): TicketsKpiMetrics {
  const current = txs ?? filterTicketTransactions(filters, ticketFilters);

  const revenue = sumAmount(current);
  const ticketsSold = countTickets(current);
  const avgPrice = avgTicketPrice(current);
  const loyaltyDiscount = sumLoyaltyDiscount(current);
  const grossRevenue = revenue + loyaltyDiscount;
  const loyaltyDiscountPct =
    grossRevenue > 0 ? (loyaltyDiscount / grossRevenue) * 100 : 0;

  const matchLevelFilters = matchLevelTicketFilters(ticketFilters);
  const planFactTxs = filterTicketTransactions(filters, matchLevelFilters);

  const eligibleCapacity = sumEligibleTicketCapacity(matchLevelFilters);
  const ticketsIssued = countIssuedTickets(planFactTxs);
  const rawFillRate =
    eligibleCapacity > 0 ? (ticketsIssued / eligibleCapacity) * 100 : 0;

  const planRevenue = sumTicketPlanRevenue(filters, matchLevelFilters);
  const planFactRevenue = sumAmount(planFactTxs);
  const planCompletionPct =
    planRevenue > 0 ? (planFactRevenue / planRevenue) * 100 : 0;

  return {
    revenue,
    ticketsSold,
    avgPrice,
    loyaltyDiscount,
    loyaltyDiscountPct,
    fillRate: rawFillRate,
    planCompletionPct,
  };
}

function buildTicketsSeasonComparison(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  current: TicketsKpiMetrics,
): TicketsSeasonComparison | undefined {
  if (ticketFilters.season === "all") return undefined;

  const previousSeason = getPreviousSeason(ticketFilters.season);
  if (!previousSeason) return undefined;

  const prevFilters: TicketFilters = {
    ...ticketFilters,
    season: previousSeason,
  };
  const prevMetrics = computeTicketsKpiMetrics(filters, prevFilters);

  return {
    previousSeason,
    revenueChange: pctChange(current.revenue, prevMetrics.revenue),
    planCompletionChange: pctChange(
      current.planCompletionPct,
      prevMetrics.planCompletionPct,
    ),
    fillRateChange: pctChange(current.fillRate, prevMetrics.fillRate),
    loyaltyDiscountPctChange: pctChange(
      current.loyaltyDiscountPct,
      prevMetrics.loyaltyDiscountPct,
    ),
    ticketsChange: pctChange(current.ticketsSold, prevMetrics.ticketsSold),
    avgPriceChange: pctChange(current.avgPrice, prevMetrics.avgPrice),
  };
}

type MerchKpiMetrics = {
  revenue: number;
  avgCheck: number;
  upt: number;
  receipts: number;
  returnsPct: number;
  marginPct: number;
};

function computeMerchKpiMetrics(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  totals?: MerchAggregateMetrics,
): MerchKpiMetrics {
  const metrics = totals ?? computeMerchTotals(filters, merchFilters);

  return {
    revenue: metrics.revenue,
    avgCheck: metrics.receipts > 0 ? metrics.revenue / metrics.receipts : 0,
    upt: metrics.receipts > 0 ? metrics.units / metrics.receipts : 0,
    receipts: metrics.receipts,
    returnsPct:
      metrics.grossSales > 0
        ? (metrics.returnsValue / metrics.grossSales) * 100
        : 0,
    marginPct:
      metrics.revenue > 0
        ? ((metrics.revenue - metrics.cost) / metrics.revenue) * 100
        : 0,
  };
}

function buildMerchSeasonComparison(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  current: MerchKpiMetrics,
): MerchSeasonComparison | undefined {
  if (merchFilters.season === "all") return undefined;

  const previousSeason = getPreviousSeason(merchFilters.season);
  if (!previousSeason) return undefined;

  const prevFilters: MerchFilters = {
    ...merchFilters,
    season: previousSeason,
  };
  const prevMetrics = computeMerchKpiMetrics(filters, prevFilters);

  return {
    previousSeason,
    revenueChange: pctChange(current.revenue, prevMetrics.revenue),
    avgCheckChange: pctChange(current.avgCheck, prevMetrics.avgCheck),
    receiptsChange: pctChange(current.receipts, prevMetrics.receipts),
    returnsPctChange: pctChange(current.returnsPct, prevMetrics.returnsPct),
    marginPctChange: pctChange(current.marginPct, prevMetrics.marginPct),
  };
}

export function computeMerchKpis(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchKpiData {
  const metrics = computeMerchKpiMetrics(filters, merchFilters);
  const seasonComparison = buildMerchSeasonComparison(
    filters,
    merchFilters,
    metrics,
  );

  return {
    ...metrics,
    seasonComparison,
  };
}

type SubscriptionsKpiMetrics = {
  revenue: number;
  sold: number;
  avgUtilization: number;
  activeCount: number;
};

function computeSubscriptionsKpiMetrics(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionsKpiMetrics {
  const current = filterSubscriptions(filters, subscriptionFilters);
  const revenue = current.reduce((s, sub) => s + sub.price, 0);
  const sold = current.length;
  const totalMatches = current.reduce((s, sub) => s + sub.matchesTotal, 0);
  const usedMatches = current.reduce((s, sub) => s + sub.matchesUsed, 0);
  const avgUtilization =
    totalMatches > 0 ? (usedMatches / totalMatches) * 100 : 0;
  const displayPeriod = getSubscriptionsDisplayPeriod(subscriptionFilters);
  const activeCount = current.filter((sub) =>
    isSubscriptionActive(sub, displayPeriod.end),
  ).length;

  return { revenue, sold, avgUtilization, activeCount };
}

function buildSubscriptionsSeasonComparison(
  filters: DashboardFilters,
  current: SubscriptionsKpiMetrics,
  subscriptionFilters: SubscriptionFilters,
): SubscriptionsSeasonComparison | undefined {
  if (subscriptionFilters.season === "all") {
    return undefined;
  }

  const previousSeason = getPreviousSeason(subscriptionFilters.season);
  if (!previousSeason) return undefined;

  const prevFilters: SubscriptionFilters = {
    ...subscriptionFilters,
    season: previousSeason,
  };
  const prevMetrics = computeSubscriptionsKpiMetrics(filters, prevFilters);

  return {
    previousSeason,
    revenueChange: pctChange(current.revenue, prevMetrics.revenue),
    soldChange: pctChange(current.sold, prevMetrics.sold),
  };
}

export function computeSubscriptionsKpis(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionsKpiData {
  const current = filterSubscriptions(filters, subscriptionFilters);
  const previous = previousPeriodSubscriptions(subscriptionFilters);
  const metrics = computeSubscriptionsKpiMetrics(filters, subscriptionFilters);

  const prevRevenue = previous.reduce((s, sub) => s + sub.price, 0);
  const prevSold = previous.length;
  const seasonComparison = subscriptionFilters
    ? buildSubscriptionsSeasonComparison(filters, metrics, subscriptionFilters)
    : undefined;

  return {
    ...metrics,
    revenueChange: pctChange(metrics.revenue, prevRevenue),
    soldChange: pctChange(metrics.sold, prevSold),
    seasonComparison,
    revenueSparkline: buildSubscriptionsSparkline(
      current,
      (sub) => sub.purchasedAt,
      (slice) => slice.reduce((s, sub) => s + sub.price, 0),
      subscriptionFilters,
    ),
    soldSparkline: buildSubscriptionsSparkline(
      current,
      (sub) => sub.purchasedAt,
      (slice) => slice.length,
      subscriptionFilters,
    ),
  };
}

export function periodKeyAndSort(
  date: Date,
  grouping: TicketFilters["timeGrouping"],
): { period: string; sortKey: number } {
  if (grouping === "day") {
    const day = startOfDay(date);
    return {
      period: format(day, "dd MMM", { locale: ru }),
      sortKey: day.getTime(),
    };
  }
  if (grouping === "month") {
    const month = startOfMonth(date);
    return {
      period: format(month, "LLLL yyyy", { locale: ru }),
      sortKey: month.getTime(),
    };
  }
  if (grouping === "quarter") {
    const quarter = startOfQuarter(date);
    const quarterNum = Math.floor(quarter.getMonth() / 3) + 1;
    return {
      period: `Q${quarterNum} ${format(quarter, "yyyy", { locale: ru })}`,
      sortKey: quarter.getTime(),
    };
  }
  const week = startOfWeek(date, { locale: ru });
  return {
    period: format(week, "dd MMM", { locale: ru }),
    sortKey: week.getTime(),
  };
}

const SUBSCRIPTION_PLAN_EXECUTION_RATE = 0.94;

function matchHasEligibleTicketSaleDay(
  match: { date: Date; ticketSalesWindowDays?: number },
  cutoff: Date,
  now: Date,
): boolean {
  const salesWindowDays = getMatchTicketSalesWindowDays(match);
  for (let offset = salesWindowDays; offset >= 1; offset -= 1) {
    const saleDay = subDays(match.date, offset);
    if (saleDay >= cutoff && saleDay <= now) {
      return true;
    }
  }
  return false;
}

function sumEligibleTicketCapacity(ticketFilters: TicketFilters): number {
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);

  return allowedMatches.reduce((total, match) => {
    if (!matchHasEligibleTicketSaleDay(match, cutoff, now)) {
      return total;
    }
    return total + match.capacity;
  }, 0);
}

function getSubscriptionPeriodBuckets(
  subscriptionFilters: SubscriptionFilters | undefined,
  grouping: TimeGrouping,
  periodOverride?: SubscriptionDateRange,
): Date[] {
  const { start: periodStart, end: periodEnd } =
    periodOverride ?? getSubscriptionsDisplayPeriod(subscriptionFilters);
  const buckets: Date[] = [];

  if (grouping === "day") {
    let current = startOfDay(periodStart);
    while (current <= periodEnd) {
      buckets.push(current);
      current = addDays(current, 1);
    }
    return buckets;
  }

  if (grouping === "month") {
    let current = startOfMonth(periodStart);
    while (current <= periodEnd) {
      buckets.push(current);
      current = addMonths(current, 1);
    }
    return buckets;
  }

  let current = startOfWeek(periodStart, { locale: ru });
  while (current <= periodEnd) {
    buckets.push(current);
    current = addDays(current, 7);
  }

  return buckets;
}

// Arena vs parking split — aligned with ticketPlanScale and mock generator (~12% parking).
const TICKET_TYPE_PLAN_SHARE: Record<TicketType, number> = {
  arena: 0.88,
  parking: 0.12,
};

function ticketPlanScale(ticketFilters: TicketFilters): number {
  let scale = 1;
  if (ticketFilters.ticketType !== "all") {
    scale *= TICKET_TYPE_PLAN_SHARE[ticketFilters.ticketType];
  }
  if (ticketFilters.priceZone !== "all") scale *= 1 / ALL_PRICE_ZONES.length;
  if (ticketFilters.orderSource !== "all") scale *= 1 / 3;
  return scale;
}

function getMatchSaleDayCount(salesWindowDays: number): number {
  return salesWindowDays + 1;
}

function sumTicketPlanMetrics(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): { revenue: number; tickets: number } {
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const scale = ticketPlanScale(ticketFilters);
  let totalRevenue = 0;
  let totalTickets = 0;

  for (const match of allowedMatches) {
    const salesWindowDays = getMatchTicketSalesWindowDays(match);
    const saleDayCount = getMatchSaleDayCount(salesWindowDays);
    const matchPlanTickets = Math.round(getMatchPlanTickets(match) * scale);
    const matchPlanRevenue = Math.round(getMatchPlanRevenue(match) * scale);
    const dailyPlanTickets = matchPlanTickets / saleDayCount;
    const dailyPlanRevenue = matchPlanRevenue / saleDayCount;

    for (let offset = salesWindowDays; offset >= 0; offset -= 1) {
      const saleDay = subDays(match.date, offset);
      if (saleDay < cutoff || saleDay > now) continue;
      totalRevenue += dailyPlanRevenue;
      totalTickets += dailyPlanTickets;
    }
  }

  return {
    revenue: Math.round(totalRevenue),
    tickets: Math.round(totalTickets),
  };
}

function sumTicketPlanRevenue(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): number {
  return sumTicketPlanMetrics(filters, ticketFilters).revenue;
}

function addPlanFactValue(
  map: Map<string, { sortKey: number; value: number }>,
  date: Date,
  grouping: TicketFilters["timeGrouping"],
  delta: number,
) {
  const { period, sortKey } = periodKeyAndSort(date, grouping);
  const existing = map.get(period) ?? { sortKey, value: 0 };
  existing.value += delta;
  map.set(period, existing);
}

export function computeTicketsTrend(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): WeeklyPoint[] {
  return computeTicketsPlanFactTrend(filters, ticketFilters).map((point) => ({
    period: point.period,
    value: point.factRevenue,
  }));
}

export function computeSubscriptionsPlanFactTrend(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionsPlanFactTrendPoint[] {
  const grouping = subscriptionFilters?.timeGrouping ?? "week";
  const trendFilters = subscriptionFilters
    ? { ...subscriptionFilters, tournamentStage: "all" as const }
    : undefined;
  const factRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const regularFactRevenueMap = new Map<
    string,
    { sortKey: number; value: number }
  >();
  const playoffFactRevenueMap = new Map<
    string,
    { sortKey: number; value: number }
  >();
  const factCountMap = new Map<string, { sortKey: number; value: number }>();

  for (const sub of filterSubscriptions(filters, trendFilters)) {
    addPlanFactValue(factRevenueMap, sub.purchasedAt, grouping, sub.price);
    addPlanFactValue(factCountMap, sub.purchasedAt, grouping, 1);
    if (sub.tournamentStage === "playoff") {
      addPlanFactValue(
        playoffFactRevenueMap,
        sub.purchasedAt,
        grouping,
        sub.price,
      );
    } else {
      addPlanFactValue(
        regularFactRevenueMap,
        sub.purchasedAt,
        grouping,
        sub.price,
      );
    }
  }

  const totalFactRevenue = Array.from(factRevenueMap.values()).reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const totalFactCount = Array.from(factCountMap.values()).reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const totalPlanRevenue = Math.round(
    totalFactRevenue / SUBSCRIPTION_PLAN_EXECUTION_RATE,
  );
  const totalPlanCount = Math.round(
    totalFactCount / SUBSCRIPTION_PLAN_EXECUTION_RATE,
  );

  const trendPeriod = getSubscriptionsTrendDisplayPeriod(subscriptionFilters);
  const bucketDates = getSubscriptionPeriodBuckets(
    subscriptionFilters,
    grouping,
    trendPeriod,
  );
  const factWeights = bucketDates.map((bucketDate) => {
    const { period } = periodKeyAndSort(bucketDate, grouping);
    return factRevenueMap.get(period)?.value ?? 0;
  });
  const hasFactDistribution = factWeights.some((weight) => weight > 0);
  const launchWeights = bucketDates.map((_, index) => {
    const progress = index / Math.max(bucketDates.length - 1, 1);
    return 0.7 + 0.3 * Math.sin(progress * Math.PI);
  });
  const weights = hasFactDistribution
    ? factWeights.map(
        (weight, index) => weight + launchWeights[index] * 0.05 * totalPlanRevenue,
      )
    : launchWeights;
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const planRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const planCountMap = new Map<string, { sortKey: number; value: number }>();

  for (let index = 0; index < bucketDates.length; index += 1) {
    const { period, sortKey } = periodKeyAndSort(bucketDates[index], grouping);
    planRevenueMap.set(period, {
      sortKey,
      value: Math.round((weights[index] / weightSum) * totalPlanRevenue),
    });
    planCountMap.set(period, {
      sortKey,
      value: Math.round((weights[index] / weightSum) * totalPlanCount),
    });
  }

  const periods = new Set([
    ...factRevenueMap.keys(),
    ...regularFactRevenueMap.keys(),
    ...playoffFactRevenueMap.keys(),
    ...factCountMap.keys(),
    ...planRevenueMap.keys(),
    ...planCountMap.keys(),
  ]);

  return Array.from(periods)
    .map((period) => ({
      period,
      sortKey:
        factRevenueMap.get(period)?.sortKey ??
        regularFactRevenueMap.get(period)?.sortKey ??
        playoffFactRevenueMap.get(period)?.sortKey ??
        planRevenueMap.get(period)?.sortKey ??
        factCountMap.get(period)?.sortKey ??
        planCountMap.get(period)?.sortKey ??
        0,
      planRevenue: Math.round(planRevenueMap.get(period)?.value ?? 0),
      factRevenue: Math.round(factRevenueMap.get(period)?.value ?? 0),
      regularFactRevenue: Math.round(
        regularFactRevenueMap.get(period)?.value ?? 0,
      ),
      playoffFactRevenue: Math.round(
        playoffFactRevenueMap.get(period)?.value ?? 0,
      ),
      planTickets: Math.round(planCountMap.get(period)?.value ?? 0),
      factTickets: Math.round(factCountMap.get(period)?.value ?? 0),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeTicketsPlanFactTrend(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): PlanFactTrendPoint[] {
  const timeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);
  const factRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const factTicketsMap = new Map<string, { sortKey: number; value: number }>();
  const planRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const planTicketsMap = new Map<string, { sortKey: number; value: number }>();

  for (const tx of filterTicketTransactions(filters, ticketFilters)) {
    addPlanFactValue(
      factRevenueMap,
      tx.date,
      timeGrouping,
      tx.amount,
    );
    addPlanFactValue(
      factTicketsMap,
      tx.date,
      timeGrouping,
      tx.quantity,
    );
  }

  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const scale = ticketPlanScale(ticketFilters);

  for (const match of allowedMatches) {
    const salesWindowDays = getMatchTicketSalesWindowDays(match);
    const saleDayCount = getMatchSaleDayCount(salesWindowDays);
    const matchPlanTickets = Math.round(getMatchPlanTickets(match) * scale);
    const matchPlanRevenue = Math.round(getMatchPlanRevenue(match) * scale);
    const dailyPlanTickets = matchPlanTickets / saleDayCount;
    const dailyPlanRevenue = matchPlanRevenue / saleDayCount;

    for (let offset = salesWindowDays; offset >= 0; offset -= 1) {
      const saleDay = subDays(match.date, offset);
      if (saleDay < cutoff || saleDay > now) continue;

      addPlanFactValue(
        planTicketsMap,
        saleDay,
        timeGrouping,
        dailyPlanTickets,
      );
      addPlanFactValue(
        planRevenueMap,
        saleDay,
        timeGrouping,
        dailyPlanRevenue,
      );
    }
  }

  const periods = new Set([
    ...factRevenueMap.keys(),
    ...factTicketsMap.keys(),
    ...planRevenueMap.keys(),
    ...planTicketsMap.keys(),
  ]);

  return Array.from(periods)
    .map((period) => ({
      period,
      sortKey:
        factRevenueMap.get(period)?.sortKey ??
        planRevenueMap.get(period)?.sortKey ??
        factTicketsMap.get(period)?.sortKey ??
        planTicketsMap.get(period)?.sortKey ??
        0,
      planRevenue: Math.round(planRevenueMap.get(period)?.value ?? 0),
      factRevenue: Math.round(factRevenueMap.get(period)?.value ?? 0),
      planTickets: Math.round(planTicketsMap.get(period)?.value ?? 0),
      factTickets: Math.round(factTicketsMap.get(period)?.value ?? 0),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

const LEAGUE_COLOR_BANDS: Record<League, { start: number; end: number }> = {
  KHL: { start: 350, end: 28 },
  VHL: { start: 138, end: 198 },
  MHL: { start: 208, end: 286 },
};

function hueInBand(band: { start: number; end: number }, t: number): number {
  const { start, end } = band;
  if (end >= start) {
    return start + t * (end - start);
  }
  const span = 360 - start + end;
  return (start + t * span) % 360;
}

function getMatchLineColor(league: League, index: number, total: number): string {
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const hue = hueInBand(LEAGUE_COLOR_BANDS[league], t);
  const saturation = index % 2 === 0 ? 78 : 64;
  const lightness = 34 + (index % 5) * 9;
  return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
}

export function computeTicketsMatchCumulativeSeries(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): TicketMatchCumulativeSeries[] {
  const selectedMatchId =
    ticketFilters.matchId.length === 1 ? ticketFilters.matchId[0] : null;
  const matchesWithoutMatchIdFilter = filterMatchesByTicketFilters({
    ...ticketFilters,
    matchId: [],
  }).sort((left, right) => left.date.getTime() - right.date.getTime());

  let chartMatches = filterMatchesByTicketFilters(ticketFilters).sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );
  const comparisonMatchIds = new Set<string>();

  if (selectedMatchId) {
    const selectedMatch = matchesWithoutMatchIdFilter.find(
      (match) => match.id === selectedMatchId,
    );

    if (selectedMatch) {
      const comparisonMatches = matchesWithoutMatchIdFilter.filter(
        (match) =>
          match.id !== selectedMatchId &&
          match.matchClass === selectedMatch.matchClass &&
          match.date.getTime() < selectedMatch.date.getTime(),
      );

      for (const match of comparisonMatches) {
        comparisonMatchIds.add(match.id);
      }

      chartMatches = [...comparisonMatches, selectedMatch];
    }
  }

  let txs = filterTicketTransactions(filters, ticketFilters);
  if (selectedMatchId && comparisonMatchIds.size > 0) {
    const expandedMatchIds = new Set([
      selectedMatchId,
      ...comparisonMatchIds,
    ]);
    txs = filterTicketTransactions(filters, {
      ...ticketFilters,
      matchId: [],
    }).filter((tx) => tx.matchId != null && expandedMatchIds.has(tx.matchId));
  }

  const txsByMatchId = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (!tx.matchId) continue;
    const matchTxs = txsByMatchId.get(tx.matchId);
    if (matchTxs) {
      matchTxs.push(tx);
    } else {
      txsByMatchId.set(tx.matchId, [tx]);
    }
  }

  const leagueTotals: Record<League, number> = { KHL: 0, VHL: 0, MHL: 0 };
  const leagueColorIndex: Record<League, number> = { KHL: 0, VHL: 0, MHL: 0 };

  for (const match of chartMatches) {
    leagueTotals[match.league] += 1;
  }

  const scale = ticketPlanScale(ticketFilters);
  const today = startOfDay(MOCK_TODAY);
  const series: TicketMatchCumulativeSeries[] = [];

  for (const match of chartMatches) {
    const matchTxs = txsByMatchId.get(match.id) ?? [];
    const salesWindowDays = getMatchTicketSalesWindowDays(match);
    const saleDayCount = getMatchSaleDayCount(salesWindowDays);
    const matchPlanTickets = Math.round(getMatchPlanTickets(match) * scale);
    const matchPlanRevenue = Math.round(getMatchPlanRevenue(match) * scale);
    const dailyPlanTickets = matchPlanTickets / saleDayCount;
    const dailyPlanRevenue = matchPlanRevenue / saleDayCount;

    const matchDay = startOfDay(match.date);
    const daysUntilMatch = differenceInCalendarDays(matchDay, today);

    let currentDaysBeforeMatch: number | null = null;
    if (!match.eventCompleted) {
      if (daysUntilMatch >= 0 && daysUntilMatch <= salesWindowDays) {
        currentDaysBeforeMatch = daysUntilMatch;
      }
    }

    const factByDay = new Map<number, { revenue: number; tickets: number }>();
    for (const tx of matchTxs) {
      const txDay = startOfDay(tx.date);
      const daysBefore = differenceInCalendarDays(matchDay, txDay);
      if (daysBefore < 0 || daysBefore > salesWindowDays) continue;
      const entry = factByDay.get(daysBefore) ?? { revenue: 0, tickets: 0 };
      entry.revenue += tx.amount;
      if (tx.amount > 0) {
        entry.tickets += tx.quantity;
      }
      factByDay.set(daysBefore, entry);
    }

    let cumulativeRevenue = 0;
    let cumulativeTickets = 0;
    let cumulativePlanRevenue = 0;
    let cumulativePlanTickets = 0;
    const points: TicketMatchCumulativeSeries["points"] = [];

    for (
      let daysBeforeMatch = salesWindowDays;
      daysBeforeMatch >= 0;
      daysBeforeMatch -= 1
    ) {
      if (daysBeforeMatch > 0) {
        cumulativePlanRevenue += dailyPlanRevenue;
        cumulativePlanTickets += dailyPlanTickets;
      }

      const planRevenue =
        daysBeforeMatch === 0
          ? matchPlanRevenue
          : Math.round(cumulativePlanRevenue);
      const planTickets =
        daysBeforeMatch === 0
          ? matchPlanTickets
          : Math.round(cumulativePlanTickets);

      const isFuturePoint =
        !match.eventCompleted &&
        currentDaysBeforeMatch != null &&
        daysBeforeMatch < currentDaysBeforeMatch;

      const dayFact = factByDay.get(daysBeforeMatch);
      if (dayFact && !isFuturePoint) {
        cumulativeRevenue += dayFact.revenue;
        cumulativeTickets += dayFact.tickets;
      }

      const saleDay = subDays(matchDay, daysBeforeMatch);

      points.push({
        daysBeforeMatch,
        date: format(saleDay, "dd.MM.yy"),
        dateKey: saleDay.getTime(),
        revenue: isFuturePoint ? null : cumulativeRevenue,
        tickets: isFuturePoint ? null : cumulativeTickets,
        planRevenue,
        planTickets,
      });
    }

    const hasFactSales = points.some(
      (point) => (point.revenue ?? 0) > 0 || (point.tickets ?? 0) > 0,
    );

    const colorIndex = leagueColorIndex[match.league];
    const color = getMatchLineColor(
      match.league,
      colorIndex,
      leagueTotals[match.league],
    );
    leagueColorIndex[match.league] += 1;

    series.push({
      matchId: match.id,
      label: `${match.opponent} · ${format(match.date, "dd.MM.yy")}`,
      color,
      league: match.league,
      season: match.season,
      matchClass: match.matchClass,
      matchDateKey: matchDay.getTime(),
      eventCompleted: match.eventCompleted,
      hasFactSales,
      planRevenue: matchPlanRevenue,
      planTickets: matchPlanTickets,
      currentDaysBeforeMatch,
      points,
      seriesRole: comparisonMatchIds.has(match.id)
        ? "comparison"
        : match.id === selectedMatchId
          ? "selected"
          : undefined,
    });
  }

  return series;
}

function buildGroupedTrend(
  items: { date: Date; value: number }[],
  timeGrouping: TicketFilters["timeGrouping"],
): WeeklyPoint[] {
  const periodMap = new Map<string, { sortKey: number; value: number }>();

  for (const item of items) {
    const { period, sortKey } = periodKeyAndSort(item.date, timeGrouping);
    const existing = periodMap.get(period) ?? { sortKey, value: 0 };
    existing.value += item.value;
    periodMap.set(period, existing);
  }

  return Array.from(periodMap.entries())
    .map(([period, { sortKey, value }]) => ({ period, value, sortKey }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ period, value }) => ({ period, value }));
}

export function computeMerchTrend(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): WeeklyPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);

  return buildGroupedTrend(
    txs.map((tx) => ({
      date: tx.date,
      value: tx.isReturn ? -tx.amount : tx.amount,
    })),
    merchFilters.timeGrouping,
  );
}

export function computeWeeklyTrend(
  filters: DashboardFilters,
  tab: DashboardTab,
  tabFilters?: TicketFilters | MerchFilters | SubscriptionFilters,
): WeeklyPoint[] {
  const periodMap = new Map<string, number>();

  if (tab === "subscriptions") {
    const subscriptionFilters = tabFilters as SubscriptionFilters | undefined;
    for (const sub of filterSubscriptions(filters, subscriptionFilters)) {
      const key = format(startOfWeek(sub.purchasedAt, { locale: ru }), "dd MMM", {
        locale: ru,
      });
      periodMap.set(key, (periodMap.get(key) ?? 0) + sub.price);
    }
  } else if (tab === "tickets" && tabFilters) {
    for (const tx of filterTicketTransactions(filters, tabFilters as TicketFilters)) {
      const key = format(startOfWeek(tx.date, { locale: ru }), "dd MMM", {
        locale: ru,
      });
      periodMap.set(key, (periodMap.get(key) ?? 0) + tx.amount);
    }
  } else if (tab === "merch" && tabFilters) {
    return computeMerchTrend(filters, tabFilters as MerchFilters);
  } else {
    const stream = tab === "tickets" ? "tickets" : "merch";
    for (const tx of filterTransactions(filters, stream)) {
      const key = format(startOfWeek(tx.date, { locale: ru }), "dd MMM", {
        locale: ru,
      });
      periodMap.set(key, (periodMap.get(key) ?? 0) + tx.amount);
    }
  }

  return Array.from(periodMap.entries())
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period, "ru"));
}

export function computeMatchRevenueForTab(
  filters: DashboardFilters,
  tab: "tickets" | "merch",
  tabFilters?: TicketFilters | MerchFilters,
) {
  const txs =
    tab === "tickets" && tabFilters
      ? filterTicketTransactions(filters, tabFilters as TicketFilters)
      : tab === "merch" && tabFilters
        ? filterMerchTransactions(filters, tabFilters as MerchFilters)
        : filterTransactions(filters, tab);

  const filteredMatches =
    tab === "tickets" && tabFilters
      ? filterMatchesByTicketFilters(tabFilters as TicketFilters)
      : tab === "merch" && tabFilters
        ? filterMatchesByMerchFilters(tabFilters as MerchFilters, filters.dateRange)
        : filterMatches(filters);

  return filteredMatches.map((match) => ({
    match: match.opponent,
    value: sumAmount(txs.filter((tx) => tx.matchId === match.id)),
  }));
}

export function computeSectorSales(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
) {
  const txs = filterTicketTransactions(filters, ticketFilters);

  return ALL_PRICE_ZONES.map((zone) => ({
    sector: zone,
    value: txs
      .filter((tx) => tx.priceZone === zone)
      .reduce((s, tx) => s + tx.quantity, 0),
  }));
}

const TICKET_TYPES: TicketType[] = ["arena", "parking"];
const ORDER_SOURCES: OrderSource[] = [
  "box_office",
  "official_site",
  "yandex_afisha",
];

export function computeTicketTypeSales(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): TicketTypeSalesPoint[] {
  const txs = filterTicketTransactions(filters, ticketFilters);

  const rows = TICKET_TYPES.map((type) => {
    const typeTxs = txs.filter((tx) => tx.ticketType === type);
    const revenue = sumAmount(typeTxs);
    const tickets = countTickets(typeTxs);

    return {
      type,
      label: TICKET_TYPE_LABELS[type],
      tickets,
      revenue,
      share: 0,
    };
  }).filter((row) => row.tickets > 0 || row.revenue > 0);

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  return rows.map((row) => ({
    ...row,
    share: totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0,
  }));
}

export function computePriceZoneSales(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): PriceZoneSalesPoint[] {
  const txs = filterTicketTransactions(filters, ticketFilters);
  const arenaTxs = txs.filter(
    (tx) => tx.ticketType !== "parking" && tx.priceZone,
  );

  return ALL_PRICE_ZONES.map((zone) => {
    const zoneTxs = arenaTxs.filter((tx) => tx.priceZone === zone);
    const revenue = sumAmount(zoneTxs);
    const tickets = countTickets(zoneTxs);

    return {
      zone,
      label: zone,
      tickets,
      revenue,
    };
  }).filter((row) => row.tickets > 0);
}

export function computeOrderSourceSales(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): OrderSourceSalesPoint[] {
  const txs = filterTicketTransactions(filters, ticketFilters);

  const rows = ORDER_SOURCES.map((source) => {
    const sourceTxs = txs.filter((tx) => tx.orderSource === source);
    const revenue = sumAmount(sourceTxs);
    const tickets = countTickets(sourceTxs);

    return {
      source,
      label: ORDER_SOURCE_LABELS[source],
      tickets,
      revenue,
      share: 0,
    };
  }).filter((row) => row.tickets > 0 || row.revenue > 0);

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  return rows.map((row) => ({
    ...row,
    share: totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0,
  }));
}

export function computeTicketsSalesChannelTrend(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): TicketsSalesChannelTrendPoint[] {
  const txs = filterTicketTransactions(filters, ticketFilters);
  const timeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);
  const activeSources =
    ticketFilters.orderSource !== "all"
      ? [ticketFilters.orderSource]
      : ORDER_SOURCES;

  const periodMap = new Map<
    string,
    { sortKey: number; channels: Map<OrderSource, number> }
  >();

  for (const tx of txs) {
    if (!tx.orderSource) continue;
    if (!activeSources.includes(tx.orderSource)) continue;

    const { period, sortKey } = periodKeyAndSort(tx.date, timeGrouping);
    const entry =
      periodMap.get(period) ??
      ({
        sortKey,
        channels: new Map(
          activeSources.map((source) => [source, 0] as const),
        ),
      } as { sortKey: number; channels: Map<OrderSource, number> });

    const delta = tx.isReturn ? -tx.amount : tx.amount;
    entry.channels.set(
      tx.orderSource,
      (entry.channels.get(tx.orderSource) ?? 0) + delta,
    );
    periodMap.set(period, entry);
  }

  return Array.from(periodMap.entries())
    .map(([period, { sortKey, channels }]) => ({
      period,
      sortKey,
      channels: Object.fromEntries(
        activeSources.map((source) => [
          source,
          Math.max(0, channels.get(source) ?? 0),
        ]),
      ) as Record<OrderSource, number>,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeTicketsPriceZoneTrend(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): TicketsPriceZoneTrendPoint[] {
  const txs = filterTicketTransactions(filters, ticketFilters);
  const timeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);
  const activeGroups: PriceZoneGroup[] =
    ticketFilters.priceZone !== "all"
      ? [getPriceZoneGroup(ticketFilters.priceZone)]
      : ALL_PRICE_ZONE_GROUPS;

  const periodMap = new Map<
    string,
    { sortKey: number; groups: Map<PriceZoneGroup, number> }
  >();

  for (const tx of txs) {
    if (tx.ticketType === "parking" || !tx.priceZone) continue;
    const group = getPriceZoneGroup(tx.priceZone);
    if (!activeGroups.includes(group)) continue;

    const { period, sortKey } = periodKeyAndSort(tx.date, timeGrouping);
    const entry =
      periodMap.get(period) ??
      ({
        sortKey,
        groups: new Map(
          activeGroups.map((g) => [g, 0] as const),
        ),
      } as { sortKey: number; groups: Map<PriceZoneGroup, number> });

    const delta = tx.isReturn ? -tx.amount : tx.amount;
    entry.groups.set(
      group,
      (entry.groups.get(group) ?? 0) + delta,
    );
    periodMap.set(period, entry);
  }

  return Array.from(periodMap.entries())
    .map(([period, { sortKey, groups }]) => ({
      period,
      sortKey,
      groups: Object.fromEntries(
        activeGroups.map((group) => [
          group,
          Math.max(0, groups.get(group) ?? 0),
        ]),
      ) as Record<PriceZoneGroup, number>,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeMerchSalesChannelTrend(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchSalesChannelTrendPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const timeGrouping = getEffectiveMerchTimeGrouping(merchFilters);
  const activeChannels =
    merchFilters.salesChannels.length > 0
      ? merchFilters.salesChannels
      : ALL_MERCH_SALES_POINTS;

  const periodMap = new Map<
    string,
    { sortKey: number; channels: Map<MerchSalesPoint, number> }
  >();

  for (const tx of txs) {
    if (!tx.merchSalesPoint) continue;
    if (!activeChannels.includes(tx.merchSalesPoint)) continue;

    const { period, sortKey } = periodKeyAndSort(
      tx.date,
      timeGrouping,
    );
    const entry =
      periodMap.get(period) ??
      ({
        sortKey,
        channels: new Map(
          activeChannels.map((channel) => [channel, 0] as const),
        ),
      } as { sortKey: number; channels: Map<MerchSalesPoint, number> });

    const delta = tx.isReturn ? -tx.amount : tx.amount;
    entry.channels.set(
      tx.merchSalesPoint,
      (entry.channels.get(tx.merchSalesPoint) ?? 0) + delta,
    );
    periodMap.set(period, entry);
  }

  return Array.from(periodMap.entries())
    .map(([period, { sortKey, channels }]) => ({
      period,
      sortKey,
      channels: Object.fromEntries(
        activeChannels.map((channel) => [
          channel,
          Math.max(0, channels.get(channel) ?? 0),
        ]),
      ) as Record<MerchSalesPoint, number>,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeMerchSalesChannelRevenue(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchSalesChannelPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const revenueByPoint = new Map<MerchSalesPoint, number>();

  for (const point of ALL_MERCH_SALES_POINTS) {
    revenueByPoint.set(point, 0);
  }

  for (const tx of txs) {
    if (!tx.merchSalesPoint) continue;
    const delta = tx.isReturn ? -tx.amount : tx.amount;
    revenueByPoint.set(
      tx.merchSalesPoint,
      (revenueByPoint.get(tx.merchSalesPoint) ?? 0) + delta,
    );
  }

  const rows = ALL_MERCH_SALES_POINTS.map((point) => ({
    channel: MERCH_SALES_POINT_LABELS[point],
    channelKey: point,
    value: Math.max(0, revenueByPoint.get(point) ?? 0),
    share: 0,
  }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? (row.value / total) * 100 : 0,
  }));
}

export function computeMerchSalesSegmentTrend(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchSalesSegmentTrendPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const timeGrouping = getEffectiveMerchTimeGrouping(merchFilters);
  const matchDatesById = buildMatchDateById(merchFilters);
  const arenaMatchDayTimestamps = buildArenaMatchDayTimestamps(merchFilters);

  const periodMap = new Map<
    string,
    { sortKey: number; segments: Map<MerchSalesSegment, number> }
  >();

  for (const tx of txs) {
    const segment = classifyMerchSalesSegment(
      tx,
      matchDatesById,
      arenaMatchDayTimestamps,
    );
    if (!segment) continue;

    const { period, sortKey } = periodKeyAndSort(
      tx.date,
      timeGrouping,
    );
    const entry =
      periodMap.get(period) ??
      ({
        sortKey,
        segments: new Map(
          ALL_MERCH_SALES_SEGMENTS.map((s) => [s, 0] as const),
        ),
      } as { sortKey: number; segments: Map<MerchSalesSegment, number> });

    const delta = tx.isReturn ? -tx.amount : tx.amount;
    entry.segments.set(
      segment,
      (entry.segments.get(segment) ?? 0) + delta,
    );
    periodMap.set(period, entry);
  }

  return Array.from(periodMap.entries())
    .map(([period, { sortKey, segments }]) => ({
      period,
      sortKey,
      segments: Object.fromEntries(
        ALL_MERCH_SALES_SEGMENTS.map((segment) => [
          segment,
          Math.max(0, segments.get(segment) ?? 0),
        ]),
      ) as Record<MerchSalesSegment, number>,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeMerchProductCategoryTrend(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchProductCategoryTrendPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const timeGrouping = getEffectiveMerchTimeGrouping(merchFilters);
  const activeCategories = ALL_MERCH_PRODUCT_CATEGORIES;

  const periodMap = new Map<
    string,
    { sortKey: number; categories: Map<MerchProductCategory, number> }
  >();

  for (const tx of txs) {
    const category = getMerchProductCategory(tx);
    if (!category) continue;

    const { period, sortKey } = periodKeyAndSort(
      tx.date,
      timeGrouping,
    );
    const entry =
      periodMap.get(period) ??
      ({
        sortKey,
        categories: new Map(
          activeCategories.map((item) => [item, 0] as const),
        ),
      } as { sortKey: number; categories: Map<MerchProductCategory, number> });

    const delta = tx.isReturn ? -tx.amount : tx.amount;
    entry.categories.set(
      category,
      (entry.categories.get(category) ?? 0) + delta,
    );
    periodMap.set(period, entry);
  }

  return Array.from(periodMap.entries())
    .map(([period, { sortKey, categories }]) => ({
      period,
      sortKey,
      categories: Object.fromEntries(
        activeCategories.map((category) => [
          category,
          Math.max(0, categories.get(category) ?? 0),
        ]),
      ) as Record<MerchProductCategory, number>,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeMerchProductCategoryRevenue(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchProductCategoryPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const revenueByCategory = new Map<
    MerchProductCategory,
    { value: number; units: number }
  >();

  for (const category of ALL_MERCH_PRODUCT_CATEGORIES) {
    revenueByCategory.set(category, { value: 0, units: 0 });
  }

  for (const tx of txs) {
    const category = getMerchProductCategory(tx);
    if (!category) continue;

    const existing = revenueByCategory.get(category) ?? { value: 0, units: 0 };
    if (tx.isReturn) {
      existing.value -= tx.amount;
      existing.units -= tx.quantity;
    } else {
      existing.value += tx.amount;
      existing.units += tx.quantity;
    }
    revenueByCategory.set(category, existing);
  }

  const rows = ALL_MERCH_PRODUCT_CATEGORIES.map((categoryKey) => ({
    category: MERCH_PRODUCT_CATEGORY_LABELS[categoryKey],
    categoryKey,
    value: Math.max(0, revenueByCategory.get(categoryKey)?.value ?? 0),
    units: Math.max(0, revenueByCategory.get(categoryKey)?.units ?? 0),
    share: 0,
  }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? (row.value / total) * 100 : 0,
  }));
}

export function computeChannelMix(
  filters: DashboardFilters,
  tab: DashboardTab,
  tabFilters?: TicketFilters | MerchFilters | SubscriptionFilters,
): ChannelMixPoint[] {
  if (tab === "subscriptions") {
    const subs = filterSubscriptions(
      filters,
      tabFilters as SubscriptionFilters | undefined,
    );
    const channels = ["box_office", "official_site"] as const;
    return channels.map((channel) => ({
      channel: SUBSCRIPTION_CHANNEL_LABELS[channel],
      value: subs
        .filter((s) => s.channel === channel)
        .reduce((sum, s) => sum + s.price, 0),
    }));
  }

  if (tab === "tickets" && tabFilters) {
    const txs = filterTicketTransactions(filters, tabFilters as TicketFilters);
    const sources = ["box_office", "official_site", "yandex_afisha"] as const;

    return sources
      .map((source) => ({
        channel: ORDER_SOURCE_LABELS[source],
        value: sumAmount(txs.filter((tx) => tx.orderSource === source)),
      }))
      .filter((item) => item.value > 0);
  }

  const txs =
    tab === "merch" && tabFilters
      ? filterMerchTransactions(filters, tabFilters as MerchFilters)
      : filterTransactions(filters, "merch");

  return ALL_MERCH_SALES_POINTS.map((point) => ({
    channel: MERCH_SALES_POINT_LABELS[point],
    value: sumAmount(txs.filter((tx) => tx.merchSalesPoint === point)),
  })).filter((item) => item.value > 0);
}

export function computeTopProducts(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): TopProductPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const productMap = new Map<string, TopProductPoint>();

  for (const tx of txs) {
    const productName = tx.description.replace(/^Возврат:\s*/, "");
    const existing = productMap.get(productName) ?? {
      name: productName,
      revenue: 0,
      units: 0,
    };

    if (tx.isReturn) {
      existing.revenue -= tx.amount;
      existing.units -= tx.quantity;
    } else {
      existing.revenue += tx.amount;
      existing.units += tx.quantity;
    }

    productMap.set(productName, existing);
  }

  return Array.from(productMap.values())
    .filter((item) => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7);
}

const SUBSCRIPTION_TARIFF_STAGES = TOURNAMENT_STAGE_OPTIONS.filter(
  (opt): opt is { value: TournamentStage; label: string } => opt.value !== "all",
);

export function computeSubscriptionTariffStats(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionPlanStat[] {
  const subs = filterSubscriptions(filters, subscriptionFilters);

  return SUBSCRIPTION_TARIFF_STAGES.map(({ value: stage, label }) => {
    const stageSubs = subs.filter((s) => s.tournamentStage === stage);
    const totalMatches = stageSubs.reduce((s, sub) => s + sub.matchesTotal, 0);
    const usedMatches = stageSubs.reduce((s, sub) => s + sub.matchesUsed, 0);

    return {
      plan: label,
      sold: stageSubs.length,
      revenue: stageSubs.reduce((s, sub) => s + sub.price, 0),
      utilization: totalMatches > 0 ? (usedMatches / totalMatches) * 100 : 0,
    };
  });
}

export function getTabTransactions(
  filters: DashboardFilters,
  tab: "tickets" | "merch",
  tabFilters?: TicketFilters | MerchFilters,
): Transaction[] {
  if (tab === "tickets" && tabFilters) {
    return filterTicketTransactions(filters, tabFilters as TicketFilters);
  }
  if (tab === "merch" && tabFilters) {
    return filterMerchTransactions(filters, tabFilters as MerchFilters);
  }
  return filterTransactions(filters, tab);
}

export function getTabSubscriptions(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): Subscription[] {
  return filterSubscriptions(filters, subscriptionFilters);
}

export function getFilteredMatchCount(ticketFilters: TicketFilters): number {
  return filterMatchesByTicketFilters(ticketFilters).length;
}

export function computeMatchSalesTable(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): MatchSalesRow[] {
  const txs = filterTicketTransactions(filters, ticketFilters);
  const issuedTxs = filterTicketTransactions(
    filters,
    matchLevelTicketFilters(ticketFilters),
  );
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);

  type MatchAgg = {
    revenue: number;
    loyaltyDiscount: number;
    ticketsSold: number;
    freeTickets: number;
  };

  const aggByMatch = new Map<string, MatchAgg>();
  const issuedByMatch = new Map<string, number>();

  for (const tx of issuedTxs) {
    if (!tx.matchId) continue;
    const current = issuedByMatch.get(tx.matchId) ?? 0;
    const freeQty = tx.freeQuantity ?? (tx.amount === 0 ? tx.quantity : 0);
    let issued = current + freeQty;
    if (tx.amount > 0) {
      issued += tx.quantity;
    }
    issuedByMatch.set(tx.matchId, issued);
  }

  for (const tx of txs) {
    if (!tx.matchId) continue;

    const agg = aggByMatch.get(tx.matchId) ?? {
      revenue: 0,
      loyaltyDiscount: 0,
      ticketsSold: 0,
      freeTickets: 0,
    };

    const freeQty =
      tx.freeQuantity ?? (tx.amount === 0 ? tx.quantity : 0);
    agg.freeTickets += freeQty;

    if (tx.amount > 0) {
      agg.revenue += tx.amount;
      agg.ticketsSold += tx.quantity;
    }

    agg.loyaltyDiscount += tx.loyaltyDiscount ?? 0;
    aggByMatch.set(tx.matchId, agg);
  }

  const rows: MatchSalesRow[] = [];

  const scale = ticketPlanScale(ticketFilters);

  for (const match of allowedMatches) {
    const issuedTickets = issuedByMatch.get(match.id) ?? 0;
    const agg = aggByMatch.get(match.id) ?? {
      revenue: 0,
      loyaltyDiscount: 0,
      ticketsSold: 0,
      freeTickets: 0,
    };
    if (
      issuedTickets === 0 &&
      agg.revenue === 0 &&
      agg.ticketsSold === 0 &&
      agg.freeTickets === 0
    ) {
      continue;
    }

    const gross = agg.revenue + agg.loyaltyDiscount;
    const planRevenue = Math.round(getMatchPlanRevenue(match) * scale);

    rows.push({
      matchId: match.id,
      eventLabel: `${match.opponent} ${format(match.date, "dd-MM-yy", { locale: ru })}`,
      date: match.date,
      revenue: agg.revenue,
      planRevenue,
      avgPrice: agg.ticketsSold > 0 ? agg.revenue / agg.ticketsSold : 0,
      ticketsSold: agg.ticketsSold,
      freeTickets: agg.freeTickets,
      issuedTickets,
      capacity: match.capacity,
      loyaltyDiscountPct: gross > 0 ? (agg.loyaltyDiscount / gross) * 100 : 0,
    });
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function getMatchAttendance(match: { attendance: number; capacity: number }): number {
  return match.attendance > 0 ? match.attendance : Math.round(match.capacity * 0.6);
}

export function computeMerchMatchSalesTable(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchMatchSalesRow[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const allowedMatches = filterMatchesByMerchFilters(merchFilters);

  type MatchAgg = MerchAggregateMetrics & { latestDate: Date };

  const aggByMatch = new Map<string, MatchAgg>();

  for (const tx of txs) {
    if (!tx.matchId) continue;
    if (
      tx.merchSalesPoint &&
      MERCH_MATCH_TABLE_EXCLUDED_POINTS.has(tx.merchSalesPoint)
    ) {
      continue;
    }

    const key = tx.matchId;
    const agg = aggByMatch.get(key) ?? {
      ...createMerchMetrics(),
      latestDate: tx.date,
    };

    applyMerchTransaction(agg, tx);
    if (tx.date > agg.latestDate) {
      agg.latestDate = tx.date;
    }

    aggByMatch.set(key, agg);
  }

  const rows: MerchMatchSalesRow[] = [];

  for (const match of allowedMatches) {
    const agg = aggByMatch.get(match.id);
    if (!agg || agg.revenue <= 0 || agg.receipts <= 0) continue;

    const attendance = getMatchAttendance(match);

    rows.push({
      matchId: match.id,
      eventLabel: `vs ${match.opponent}`,
      date: match.date,
      revenue: agg.revenue,
      avgCheck: agg.revenue / agg.receipts,
      receipts: agg.receipts,
      units: agg.units,
      upt: agg.units / agg.receipts,
      attendance,
      purchaseConversionPct:
        attendance > 0 ? (agg.receipts / attendance) * 100 : 0,
    });
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function computeMerchSkuSalesTable(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchSkuSalesRow[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);

  type SkuAgg = MerchAggregateMetrics & {
    receiptsWithProduct: number;
    listRevenue: number;
  };

  const aggByProduct = new Map<string, SkuAgg>();

  for (const tx of txs) {
    const productName = tx.description.replace(/^Возврат:\s*/, "");
    const agg = aggByProduct.get(productName) ?? {
      ...createMerchMetrics(),
      receiptsWithProduct: 0,
      listRevenue: 0,
    };

    const listAmount = getMerchListAmount(tx);

    if (tx.isReturn) {
      applyMerchTransaction(agg, tx);
      agg.receiptsWithProduct = Math.max(0, agg.receiptsWithProduct - 1);
      agg.listRevenue -= listAmount;
    } else {
      applyMerchTransaction(agg, tx);
      agg.receiptsWithProduct += 1;
      agg.listRevenue += listAmount;
    }

    aggByProduct.set(productName, agg);
  }

  return Array.from(aggByProduct.entries())
    .map(([productName, agg]) => ({
      productName,
      units: agg.units,
      revenue: agg.revenue,
      receiptsWithProduct: agg.receiptsWithProduct,
      marginPct:
        agg.revenue > 0 ? ((agg.revenue - agg.cost) / agg.revenue) * 100 : 0,
      actualToListPricePct:
        agg.listRevenue > 0 ? (agg.revenue / agg.listRevenue) * 100 : 100,
    }))
    .filter((row) => row.units > 0)
    .sort((a, b) => b.units - a.units);
}

export function filterMatchesByMatchSalesFilters(
  matchSalesFilters: MatchSalesFilters,
  dateRange?: number,
) {
  return filterMatchesByTicketFilters(
    matchSalesFiltersToTicketFilters(matchSalesFilters),
    dateRange,
  );
}

export function computeCombinedMatchSalesTable(
  filters: DashboardFilters,
  matchSalesFilters: MatchSalesFilters,
): CombinedMatchSalesRow[] {
  const ticketFilters = matchSalesFiltersToTicketFilters(matchSalesFilters);
  const merchFilters = matchSalesFiltersToMerchFilters(matchSalesFilters);

  const ticketRows = computeMatchSalesTable(filters, ticketFilters);
  const merchRows = computeMerchMatchSalesTable(filters, merchFilters);

  const ticketByMatch = new Map(ticketRows.map((row) => [row.matchId, row]));
  const merchByMatch = new Map(merchRows.map((row) => [row.matchId, row]));

  const matchIds = new Set([
    ...ticketByMatch.keys(),
    ...merchByMatch.keys(),
  ]);

  const allowedMatches = filterMatchesByMatchSalesFilters(matchSalesFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));

  const rows: CombinedMatchSalesRow[] = [];

  for (const matchId of matchIds) {
    if (!allowedMatchIds.has(matchId)) continue;

    const ticket = ticketByMatch.get(matchId);
    const merch = merchByMatch.get(matchId);
    const match = getMatchById().get(matchId);
    if (!match) continue;

    const ticketRevenue = ticket?.revenue ?? 0;
    const merchRevenue = merch?.revenue ?? 0;
    const totalRevenue = ticketRevenue + merchRevenue;

    if (totalRevenue <= 0 && (ticket?.ticketsSold ?? 0) <= 0) continue;

    const issuedTickets = ticket?.issuedTickets ?? 0;
    const capacity = ticket?.capacity ?? match.capacity;
    const fillRate = capacity > 0 ? (issuedTickets / capacity) * 100 : 0;

    rows.push({
      matchId,
      eventLabel: `${match.opponent} ${format(match.date, "dd-MM-yy", { locale: ru })}`,
      date: match.date,
      ticketRevenue,
      merchRevenue,
      totalRevenue,
      planRevenue: ticket?.planRevenue ?? 0,
      ticketsSold: ticket?.ticketsSold ?? 0,
      issuedTickets,
      capacity,
      fillRate,
      merchReceipts: merch?.receipts ?? 0,
    });
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

type MatchSalesKpiMetrics = {
  totalRevenue: number;
  ticketRevenue: number;
  merchRevenue: number;
  ticketsSold: number;
  fillRate: number;
  matchCount: number;
};

function computeMatchSalesKpiMetrics(
  filters: DashboardFilters,
  matchSalesFilters: MatchSalesFilters,
): MatchSalesKpiMetrics {
  const rows = computeCombinedMatchSalesTable(filters, matchSalesFilters);

  const ticketRevenue = rows.reduce((sum, row) => sum + row.ticketRevenue, 0);
  const merchRevenue = rows.reduce((sum, row) => sum + row.merchRevenue, 0);
  const ticketsSold = rows.reduce((sum, row) => sum + row.ticketsSold, 0);
  const totalIssued = rows.reduce((sum, row) => sum + row.issuedTickets, 0);
  const totalCapacity = rows.reduce((sum, row) => sum + row.capacity, 0);
  const fillRate = totalCapacity > 0 ? (totalIssued / totalCapacity) * 100 : 0;

  return {
    totalRevenue: ticketRevenue + merchRevenue,
    ticketRevenue,
    merchRevenue,
    ticketsSold,
    fillRate,
    matchCount: rows.length,
  };
}

function buildMatchSalesSeasonComparison(
  filters: DashboardFilters,
  current: MatchSalesKpiMetrics,
  matchSalesFilters: MatchSalesFilters,
): MatchSalesSeasonComparison | undefined {
  if (matchSalesFilters.season === "all") {
    return undefined;
  }

  const previousSeason = getPreviousSeason(matchSalesFilters.season);
  if (!previousSeason) return undefined;

  const prevFilters: MatchSalesFilters = {
    ...matchSalesFilters,
    season: previousSeason,
  };
  const prevMetrics = computeMatchSalesKpiMetrics(filters, prevFilters);

  return {
    previousSeason,
    totalRevenueChange: pctChange(current.totalRevenue, prevMetrics.totalRevenue),
    ticketRevenueChange: pctChange(
      current.ticketRevenue,
      prevMetrics.ticketRevenue,
    ),
    merchRevenueChange: pctChange(current.merchRevenue, prevMetrics.merchRevenue),
    ticketsSoldChange: pctChange(current.ticketsSold, prevMetrics.ticketsSold),
    fillRateChange: pctChange(current.fillRate, prevMetrics.fillRate),
    matchCountChange: pctChange(current.matchCount, prevMetrics.matchCount),
  };
}

export function computeMatchSalesKpis(
  filters: DashboardFilters,
  matchSalesFilters: MatchSalesFilters,
): MatchSalesKpiData {
  const metrics = computeMatchSalesKpiMetrics(filters, matchSalesFilters);
  const seasonComparison = buildMatchSalesSeasonComparison(
    filters,
    metrics,
    matchSalesFilters,
  );

  return {
    ...metrics,
    seasonComparison,
  };
}

export function computeMatchRevenueChart(
  filters: DashboardFilters,
  matchSalesFilters: MatchSalesFilters,
): MatchRevenuePoint[] {
  const rows = computeCombinedMatchSalesTable(filters, matchSalesFilters);

  return rows
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((row) => ({
      match: row.eventLabel,
      tickets: row.ticketRevenue,
      merch: row.merchRevenue,
    }));
}

/** Ticket transactions for season benchmark — ignores purchase-date filter. */
export function filterTicketTransactionsForSeasonBenchmark(
  ticketFilters: TicketFilters,
  seasonId: string,
): Transaction[] {
  const benchmarkFilters: TicketFilters = {
    ...ticketFilters,
    season: seasonId,
    transactionDateRange: { from: null, to: null },
  };
  const allowedMatches = filterMatchesByTicketFilters(benchmarkFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));
  const cutoff = getTicketsSeasonCutoff(seasonId);

  return getTransactions().filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    return passesTicketFilters(tx, benchmarkFilters, allowedMatchIds);
  });
}

export { getMatchById };

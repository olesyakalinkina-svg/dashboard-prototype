import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
  subYears,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  TICKET_SALES_WINDOW_MAX_DAYS,
  getMatchTicketSalesWindowDays,
} from "@/lib/ticket-sales-window";
import { yieldToMain } from "@/lib/idle";
import { MOCK_TODAY } from "@/lib/mock/constants";
import {
  getFirstPlayoffMatchDate,
  getPlayoffSubscriptionSalesWindow,
  getMatchById,
  getMatches,
  getMerchTransactions,
  getSubscriptionRedemptions,
  getSubscriptions,
  getTicketTransactionsByMatchId,
  getTransactions,
  PREV_SEASON_START,
  SUBSCRIPTIONS_PERIOD_END,
  SUBSCRIPTIONS_PERIOD_START,
} from "@/lib/mock/hockey";
import {
  ORDER_SOURCE_LABELS,
  ALL_PRICE_ZONES,
  ALL_SECTORS,
  NO_MATCHES_FILTER_VALUE,
  TICKET_TYPE_LABELS,
  TOURNAMENT_STAGE_OPTIONS,
  getEffectiveTicketTimeGrouping,
  getPreviousSeason,
} from "@/lib/ticket-filter-options";
import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  getMerchProductCategory,
  isMerchMatchTablePoint,
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
  getEffectiveMerchTimeGrouping,
} from "@/lib/merch-filter-options";
import { getMerchListAmount } from "@/lib/merch-catalog";
import {
  getMatchPlanRevenue,
  getMatchPlanTickets,
  issuedOccupancyPercent,
  occupancyMassCapacity,
  LEGACY_TICKET_PLAN_AVG_PRICE,
  TICKET_PLAN_AVG_PRICE,
} from "@/lib/ticket-plan";
import {
  explicitMerchPlanFulfillment,
  getMatchMerchPlanRevenue,
  merchPlanRevenueForTarget,
  merchPlanScale,
} from "@/lib/merch-plan";
import {
  getPurchaseDateBounds,
  isDateInTournamentStage,
  passesOrderDateRange,
} from "@/lib/season-dates";
import {
  matchSalesFiltersToMerchFilters,
  matchSalesFiltersToTicketFilters,
} from "@/lib/match-sales-filter-options";
import {
  ALL_SUBSCRIPTION_PRICE_CATEGORIES,
  getSubscriptionPriceCategory,
  SUBSCRIPTION_CHANNEL_LABELS,
  SUBSCRIPTION_PRICE_CATEGORY_LABELS,
  subscriptionMatchesPriceCategory,
} from "@/lib/subscription-filter-options";
import {
  applyTicketSalesTransaction,
  createTicketSalesAgg,
  getTicketIssuedQuantity,
  isEmptyTicketSalesAgg,
  ticketSalesAvgPrice,
  ticketSalesLoyaltyDiscountPct,
} from "@/lib/ticket-sales-metrics";
import type {
  ChannelMixPoint,
  DashboardFilters,
  DashboardTab,
  League,
  MerchKpiData,
  Subscription,
  SubscriptionPlanStat,
  SubscriptionPriceCategory,
  SubscriptionPriceCategoryPoint,
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
  PriceZone,
  MerchSalesPoint,
  MerchSkuSalesRow,
  OrderSource,
  OrderSourceSalesPoint,
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

function createEmptyFilterPassCache(): FilterPassCache {
  return {
    ticket: new Map(),
    merch: new Map(),
    ticketPrevious: new Map(),
    ticketToday: new Map(),
  };
}

export function runWithFilterCache<T>(fn: () => T): T {
  filterPassCache = createEmptyFilterPassCache();
  try {
    return fn();
  } finally {
    filterPassCache = null;
  }
}

/** Shared filter-pass cache that survives yields between compute chunks. */
export function openFilterCacheSession(): {
  run<T>(fn: () => T): T;
  runAsync<T>(fn: () => Promise<T>): Promise<T>;
  close(): void;
} {
  const session = createEmptyFilterPassCache();
  return {
    run<T>(fn: () => T): T {
      const prev = filterPassCache;
      filterPassCache = session;
      try {
        return fn();
      } finally {
        filterPassCache = prev;
      }
    },
    async runAsync<T>(fn: () => Promise<T>): Promise<T> {
      const prev = filterPassCache;
      filterPassCache = session;
      try {
        return await fn();
      } finally {
        filterPassCache = prev;
      }
    },
    close() {
      session.ticket.clear();
      session.merch.clear();
      session.ticketPrevious.clear();
      session.ticketToday.clear();
    },
  };
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
    merchFilters.productCategories.join(","),
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

function passesMerchSeasonDateBounds(date: Date, season: string): boolean {
  // Start is already enforced by the ticket-sales cutoff. Cap the end so
  // 2024/25 off-match YoY does not include 2025/26 store sales.
  const bounds = getPurchaseDateBounds(season);
  return startOfDay(date) <= startOfDay(bounds.max);
}

function getDateCutoff(days: number): Date {
  return startOfDay(subDays(MOCK_TODAY, days));
}

type SubscriptionDateRange = { start: Date; end: Date };

const CURRENT_SEASON = "2025/26";

function regularSalesWindowOffsetYears(season?: string): number {
  if (!season || season === "all") return 0;
  const currentYear = Number.parseInt(CURRENT_SEASON.slice(0, 4), 10);
  const seasonYear = Number.parseInt(season.slice(0, 4), 10);
  if (!Number.isFinite(currentYear) || !Number.isFinite(seasonYear)) return 0;
  return Math.max(0, currentYear - seasonYear);
}

function getRegularSubscriptionPeriod(season?: string): SubscriptionDateRange {
  const yearsBack = regularSalesWindowOffsetYears(season);
  return {
    start: startOfDay(subYears(SUBSCRIPTIONS_PERIOD_START, yearsBack)),
    end: endOfDay(subYears(SUBSCRIPTIONS_PERIOD_END, yearsBack)),
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

  return getRegularSubscriptionPeriod(
    subscriptionFilters?.season && subscriptionFilters.season !== "all"
      ? subscriptionFilters.season
      : CURRENT_SEASON,
  );
}

function getSubscriptionsTrendDisplayPeriod(
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionDateRange {
  const regular = getRegularSubscriptionPeriod(
    subscriptionFilters?.season && subscriptionFilters.season !== "all"
      ? subscriptionFilters.season
      : CURRENT_SEASON,
  );
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
      getRegularSubscriptionPeriod(
        subscriptionFilters.season !== "all"
          ? subscriptionFilters.season
          : sub.season,
      ),
    );
  }

  if (sub.tournamentStage === "playoff") {
    const playoffPeriod = getPlayoffSubscriptionPeriod(sub.season);
    if (!playoffPeriod) return false;
    return isDateInSubscriptionPeriod(sub.purchasedAt, playoffPeriod);
  }

  return isDateInSubscriptionPeriod(
    sub.purchasedAt,
    getRegularSubscriptionPeriod(sub.season),
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

function passesMerchProductCategories(
  tx: Transaction,
  productCategories: MerchFilters["productCategories"],
): boolean {
  if (productCategories.length === 0) return false;
  if (productCategories.length >= ALL_MERCH_PRODUCT_CATEGORIES.length) return true;
  const category = getMerchProductCategory(tx);
  return Boolean(category && productCategories.includes(category));
}


const MERCH_PLAN_EXECUTION_RATE = 0.93;

function getMerchTrendDisplayPeriod(merchFilters: MerchFilters): {
  start: Date;
  end: Date;
} {
  const bounds = getPurchaseDateBounds(merchFilters.season);
  let start = startOfDay(bounds.min);
  let end = startOfDay(bounds.max);

  if (merchFilters.orderDateRange.from) {
    const fromDate = startOfDay(parseISO(merchFilters.orderDateRange.from));
    if (fromDate > start) start = fromDate;
  }
  if (merchFilters.orderDateRange.to) {
    const toDate = startOfDay(parseISO(merchFilters.orderDateRange.to));
    if (toDate < end) end = toDate;
  }
  if (end < start) end = start;
  return { start, end };
}

function getMerchPeriodBuckets(
  merchFilters: MerchFilters,
  grouping: TimeGrouping,
): Date[] {
  const { start: periodStart, end: periodEnd } =
    getMerchTrendDisplayPeriod(merchFilters);
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

  if (grouping === "quarter") {
    let current = startOfQuarter(periodStart);
    while (current <= periodEnd) {
      buckets.push(current);
      current = addMonths(current, 3);
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
  const end = endOfDay(MOCK_TODAY);

  return getMerchTransactions().filter((tx) => {
    if (tx.date < cutoff || tx.date > end) return false;
    if (!passesMerchSalesChannels(tx, merchFilters.salesChannels)) return false;
    if (!passesMerchProductCategories(tx, merchFilters.productCategories)) {
      return false;
    }
    if (!passesMerchOrderDate(tx, merchFilters.orderDateRange)) {
      return false;
    }
    if (!tx.matchId) {
      if (merchFilters.matchId.length > 0) return false;
      // Off-match merch has no match.season; keep YoY from swallowing the next season.
      if (
        merchFilters.season !== "all" &&
        !passesMerchSeasonDateBounds(tx.date, merchFilters.season)
      ) {
        return false;
      }
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

function passesTicketFieldFilters(
  tx: Transaction,
  ticketFilters: TicketFilters,
): boolean {
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

function collectTicketTransactionsForMatchIds(
  matchIds: Iterable<string>,
  ticketFilters: TicketFilters,
  includeTx: (tx: Transaction) => boolean,
): Transaction[] {
  const byMatch = getTicketTransactionsByMatchId();
  const result: Transaction[] = [];
  for (const matchId of matchIds) {
    const txs = byMatch.get(matchId);
    if (!txs) continue;
    for (const tx of txs) {
      if (!includeTx(tx)) continue;
      if (!passesTicketFieldFilters(tx, ticketFilters)) continue;
      result.push(tx);
    }
  }
  return result;
}

async function collectTicketTransactionsForMatchIdsIdle(
  matchIds: Iterable<string>,
  ticketFilters: TicketFilters,
  includeTx: (tx: Transaction) => boolean,
  isCancelled: () => boolean,
  chunkSize = 400,
): Promise<Transaction[] | null> {
  const byMatch = getTicketTransactionsByMatchId();
  const result: Transaction[] = [];
  let processed = 0;
  for (const matchId of matchIds) {
    const txs = byMatch.get(matchId);
    if (txs) {
      for (const tx of txs) {
        if (!includeTx(tx)) continue;
        if (!passesTicketFieldFilters(tx, ticketFilters)) continue;
        result.push(tx);
        processed += 1;
        if (processed % chunkSize === 0) {
          await yieldToMain(0);
          if (isCancelled()) return null;
        }
      }
    }
  }
  return result;
}

async function filterTicketTransactionsIdle(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  isCancelled: () => boolean,
): Promise<Transaction[] | null> {
  const key = ticketFilterCacheKey(filters, ticketFilters);
  if (filterPassCache) {
    const cached = filterPassCache.ticket.get(key);
    if (cached) return cached;
  }
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const end = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const result = await collectTicketTransactionsForMatchIdsIdle(
    allowedMatches.map((match) => match.id),
    ticketFilters,
    (tx) => tx.date >= cutoff && tx.date <= end,
    isCancelled,
  );
  if (result == null) return null;
  filterPassCache?.ticket.set(key, result);
  return result;
}

async function filterTicketTransactionsTodayIdle(
  ticketFilters: TicketFilters,
  isCancelled: () => boolean,
): Promise<Transaction[] | null> {
  const key = ticketTodayCacheKey(ticketFilters);
  if (filterPassCache) {
    const cached = filterPassCache.ticketToday.get(key);
    if (cached) return cached;
  }
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const now = MOCK_TODAY;
  const result = await collectTicketTransactionsForMatchIdsIdle(
    allowedMatches.map((match) => match.id),
    ticketFilters,
    (tx) => isSameDay(tx.date, now),
    isCancelled,
  );
  if (result == null) return null;
  filterPassCache?.ticketToday.set(key, result);
  return result;
}

async function previousPeriodTicketTransactionsIdle(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  isCancelled: () => boolean,
): Promise<Transaction[] | null> {
  const key = `${ticketFilterCacheKey(filters, ticketFilters)}|previous`;
  if (filterPassCache) {
    const cached = filterPassCache.ticketPrevious.get(key);
    if (cached) return cached;
  }
  const prevCutoff = getDateCutoff(filters.dateRange * 2);
  const midCutoff = getDateCutoff(filters.dateRange);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const result = await collectTicketTransactionsForMatchIdsIdle(
    allowedMatches.map((match) => match.id),
    ticketFilters,
    (tx) => tx.date >= prevCutoff && tx.date < midCutoff,
    isCancelled,
  );
  if (result == null) return null;
  filterPassCache?.ticketPrevious.set(key, result);
  return result;
}

/** Chunked scans so KPI/table/series compute does not freeze the tab. */
export async function warmTicketFilterPassesIdle(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  isCancelled: () => boolean,
): Promise<boolean> {
  const current = await filterTicketTransactionsIdle(
    filters,
    ticketFilters,
    isCancelled,
  );
  if (current == null) return false;
  await yieldToMain(16);
  if (isCancelled()) return false;

  const previous = await previousPeriodTicketTransactionsIdle(
    filters,
    ticketFilters,
    isCancelled,
  );
  if (previous == null) return false;
  await yieldToMain(16);
  if (isCancelled()) return false;

  const today = await filterTicketTransactionsTodayIdle(
    ticketFilters,
    isCancelled,
  );
  if (today == null) return false;
  await yieldToMain(16);
  if (isCancelled()) return false;

  const matchLevel = await filterTicketTransactionsIdle(
    filters,
    matchLevelTicketFilters(ticketFilters),
    isCancelled,
  );
  if (matchLevel == null) return false;

  if (ticketFilters.season !== "all") {
    const previousSeason = getPreviousSeason(ticketFilters.season);
    if (previousSeason) {
      await yieldToMain(16);
      if (isCancelled()) return false;
      const prevFilters: TicketFilters = {
        ...ticketFilters,
        season: previousSeason,
      };
      const prevSeasonTxs = await filterTicketTransactionsIdle(
        filters,
        prevFilters,
        isCancelled,
      );
      if (prevSeasonTxs == null) return false;
      await yieldToMain(16);
      if (isCancelled()) return false;
      const prevMatchLevel = await filterTicketTransactionsIdle(
        filters,
        matchLevelTicketFilters(prevFilters),
        isCancelled,
      );
      if (prevMatchLevel == null) return false;
    }
  }

  if (ticketFilters.matchId.length === 1) {
    await yieldToMain(16);
    if (isCancelled()) return false;
    const expanded = await filterTicketTransactionsIdle(
      filters,
      { ...ticketFilters, matchId: [] },
      isCancelled,
    );
    if (expanded == null) return false;
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

export function filterTicketTransactionsForMatchIds(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  matchIds: Iterable<string>,
): Transaction[] {
  void filters;
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const end = endOfDay(MOCK_TODAY);
  return collectTicketTransactionsForMatchIds(
    matchIds,
    ticketFilters,
    (tx) => tx.date >= cutoff && tx.date <= end,
  );
}

function filterTicketTransactionsImpl(
  _filters: DashboardFilters,
  ticketFilters: TicketFilters,
): Transaction[] {
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const end = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  return collectTicketTransactionsForMatchIds(
    allowedMatches.map((match) => match.id),
    ticketFilters,
    (tx) => tx.date >= cutoff && tx.date <= end,
  );
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
      !subscriptionMatchesPriceCategory(sub, subscriptionFilters.priceCategory)
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
    total += getTicketIssuedQuantity(tx);
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
  const now = MOCK_TODAY;
  return collectTicketTransactionsForMatchIds(
    allowedMatches.map((match) => match.id),
    ticketFilters,
    (tx) => isSameDay(tx.date, now),
  );
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
  return collectTicketTransactionsForMatchIds(
    allowedMatches.map((match) => match.id),
    ticketFilters,
    (tx) => tx.date >= prevCutoff && tx.date < midCutoff,
  );
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
      !subscriptionMatchesPriceCategory(sub, subscriptionFilters.priceCategory)
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
    planTicketsSold: metrics.planTicketsSold,
    planFactTicketsSold: metrics.planFactTicketsSold,
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
  planTicketsSold: number;
  planFactTicketsSold: number;
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

  const eligibleCapacity = sumEligibleOccupancyCapacity(matchLevelFilters);
  const ticketsIssued = countIssuedTickets(planFactTxs);
  const fillRate =
    eligibleCapacity > 0
      ? Math.min(100, (ticketsIssued / eligibleCapacity) * 100)
      : 0;

  const planRevenue = sumTicketPlanRevenue(filters, matchLevelFilters);
  const planFactRevenue = sumAmount(planFactTxs);
  const planCompletionPct =
    planRevenue > 0 ? (planFactRevenue / planRevenue) * 100 : 0;
  const planTicketsSold = sumTicketPlanMetrics(filters, matchLevelFilters).tickets;
  const planFactTicketsSold = countTickets(planFactTxs);

  return {
    revenue,
    ticketsSold,
    avgPrice,
    loyaltyDiscount,
    loyaltyDiscountPct,
    fillRate,
    planCompletionPct,
    planTicketsSold,
    planFactTicketsSold,
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

function countUniqueSubscriptionCustomers(subs: Subscription[]): number {
  const ids = new Set<string>();
  for (const sub of subs) {
    const buyerId = sub.customerId || sub.id;
    if (buyerId) ids.add(buyerId);
  }
  return ids.size;
}

type SubscriptionsKpiMetrics = {
  revenue: number;
  sold: number;
  uniqueCustomers: number;
  avgCheck: number;
};

function computeSubscriptionsKpiMetrics(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionsKpiMetrics {
  const current = filterSubscriptions(filters, subscriptionFilters);
  const revenue = current.reduce((s, sub) => s + sub.price, 0);
  const sold = current.length;
  const uniqueCustomers = countUniqueSubscriptionCustomers(current);
  const avgCheck = sold > 0 ? revenue / sold : 0;

  return { revenue, sold, uniqueCustomers, avgCheck };
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
    uniqueCustomersChange: pctChange(
      current.uniqueCustomers,
      prevMetrics.uniqueCustomers,
    ),
    avgCheckChange: pctChange(current.avgCheck, prevMetrics.avgCheck),
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
  const prevUniqueCustomers = countUniqueSubscriptionCustomers(previous);
  const prevAvgCheck = prevSold > 0 ? prevRevenue / prevSold : 0;
  const seasonComparison = subscriptionFilters
    ? buildSubscriptionsSeasonComparison(filters, metrics, subscriptionFilters)
    : undefined;

  return {
    ...metrics,
    revenueChange: pctChange(metrics.revenue, prevRevenue),
    soldChange: pctChange(metrics.sold, prevSold),
    uniqueCustomersChange: pctChange(
      metrics.uniqueCustomers,
      prevUniqueCustomers,
    ),
    avgCheckChange: pctChange(metrics.avgCheck, prevAvgCheck),
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

function sumEligibleOccupancyCapacity(ticketFilters: TicketFilters): number {
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);

  return allowedMatches.reduce((total, match) => {
    if (!matchHasEligibleTicketSaleDay(match, cutoff, now)) {
      return total;
    }
    return total + occupancyMassCapacity(match.capacity);
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

export async function computeTicketsPlanFactTrendIdle(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  isCancelled: () => boolean,
): Promise<PlanFactTrendPoint[] | null> {
  const txs = filterTicketTransactions(filters, ticketFilters);
  await yieldToMain(0);
  if (isCancelled()) return null;

  const timeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);
  const factRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const factTicketsMap = new Map<string, { sortKey: number; value: number }>();
  const planRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const planTicketsMap = new Map<string, { sortKey: number; value: number }>();

  for (let i = 0; i < txs.length; i += 1) {
    const tx = txs[i];
    addPlanFactValue(factRevenueMap, tx.date, timeGrouping, tx.amount);
    addPlanFactValue(factTicketsMap, tx.date, timeGrouping, tx.quantity);
    if (i > 0 && i % 8000 === 0) {
      await yieldToMain(0);
      if (isCancelled()) return null;
    }
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
      addPlanFactValue(planTicketsMap, saleDay, timeGrouping, dailyPlanTickets);
      addPlanFactValue(planRevenueMap, saleDay, timeGrouping, dailyPlanRevenue);
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

function buildOneTicketMatchCumulativeSeries(
  match: Match,
  matchTxs: Transaction[],
  options: {
    scale: number;
    today: Date;
    selectedMatchId: string | null;
    comparisonMatchIds: Set<string>;
    leagueTotals: Record<League, number>;
    leagueColorIndex: Record<League, number>;
  },
): TicketMatchCumulativeSeries {
  const {
    scale,
    today,
    selectedMatchId,
    comparisonMatchIds,
    leagueTotals,
    leagueColorIndex,
  } = options;
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

  return {
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
  };
}

function resolveTicketsMatchCumulativeChartMeta(
  ticketFilters: TicketFilters,
): {
  chartMatches: Match[];
  comparisonMatchIds: Set<string>;
  selectedMatchId: string | null;
} {
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

  return { chartMatches, comparisonMatchIds, selectedMatchId };
}

function collectTicketsMatchCumulativeTransactions(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  selectedMatchId: string | null,
  comparisonMatchIds: Set<string>,
): Transaction[] {
  if (selectedMatchId && comparisonMatchIds.size > 0) {
    const expandedMatchIds = new Set([
      selectedMatchId,
      ...comparisonMatchIds,
    ]);
    return filterTicketTransactions(filters, {
      ...ticketFilters,
      matchId: [],
    }).filter((tx) => tx.matchId != null && expandedMatchIds.has(tx.matchId));
  }
  return filterTicketTransactions(filters, ticketFilters);
}

function prepareTicketsMatchCumulativeSeries(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): {
  chartMatches: Match[];
  comparisonMatchIds: Set<string>;
  selectedMatchId: string | null;
  txs: Transaction[];
} {
  const meta = resolveTicketsMatchCumulativeChartMeta(ticketFilters);
  return {
    ...meta,
    txs: collectTicketsMatchCumulativeTransactions(
      filters,
      ticketFilters,
      meta.selectedMatchId,
      meta.comparisonMatchIds,
    ),
  };
}

export function computeTicketsMatchCumulativeSeries(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): TicketMatchCumulativeSeries[] {
  const prepared = prepareTicketsMatchCumulativeSeries(filters, ticketFilters);
  const txsByMatchId = new Map<string, Transaction[]>();
  for (const tx of prepared.txs) {
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
  for (const match of prepared.chartMatches) {
    leagueTotals[match.league] += 1;
  }

  const scale = ticketPlanScale(ticketFilters);
  const today = startOfDay(MOCK_TODAY);
  const series: TicketMatchCumulativeSeries[] = [];

  for (const match of prepared.chartMatches) {
    series.push(
      buildOneTicketMatchCumulativeSeries(match, txsByMatchId.get(match.id) ?? [], {
        scale,
        today,
        selectedMatchId: prepared.selectedMatchId,
        comparisonMatchIds: prepared.comparisonMatchIds,
        leagueTotals,
        leagueColorIndex,
      }),
    );
  }

  return series;
}

export async function computeTicketsMatchCumulativeSeriesIdle(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  isCancelled: () => boolean,
): Promise<TicketMatchCumulativeSeries[] | null> {
  await yieldToMain(0);
  if (isCancelled()) return null;
  const meta = resolveTicketsMatchCumulativeChartMeta(ticketFilters);
  await yieldToMain(0);
  if (isCancelled()) return null;

  let txs: Transaction[] | null;
  if (meta.selectedMatchId && meta.comparisonMatchIds.size > 0) {
    const expandedMatchIds = new Set([
      meta.selectedMatchId,
      ...meta.comparisonMatchIds,
    ]);
    const unscoped = await filterTicketTransactionsIdle(
      filters,
      { ...ticketFilters, matchId: [] },
      isCancelled,
    );
    if (unscoped == null) return null;
    txs = unscoped.filter(
      (tx) => tx.matchId != null && expandedMatchIds.has(tx.matchId),
    );
  } else {
    txs = await filterTicketTransactionsIdle(
      filters,
      ticketFilters,
      isCancelled,
    );
  }
  if (txs == null) return null;
  const prepared = { ...meta, txs };
  await yieldToMain(0);
  if (isCancelled()) return null;

  const txsByMatchId = new Map<string, Transaction[]>();
  let grouped = 0;
  for (const tx of prepared.txs) {
    if (!tx.matchId) continue;
    const matchTxs = txsByMatchId.get(tx.matchId);
    if (matchTxs) {
      matchTxs.push(tx);
    } else {
      txsByMatchId.set(tx.matchId, [tx]);
    }
    grouped += 1;
    if (grouped % 300 === 0) {
      await yieldToMain(0);
      if (isCancelled()) return null;
    }
  }

  const leagueTotals: Record<League, number> = { KHL: 0, VHL: 0, MHL: 0 };
  const leagueColorIndex: Record<League, number> = { KHL: 0, VHL: 0, MHL: 0 };
  for (const match of prepared.chartMatches) {
    leagueTotals[match.league] += 1;
  }

  const scale = ticketPlanScale(ticketFilters);
  const today = startOfDay(MOCK_TODAY);
  const series: TicketMatchCumulativeSeries[] = [];

  for (let i = 0; i < prepared.chartMatches.length; i += 1) {
    const match = prepared.chartMatches[i];
    series.push(
      buildOneTicketMatchCumulativeSeries(match, txsByMatchId.get(match.id) ?? [], {
        scale,
        today,
        selectedMatchId: prepared.selectedMatchId,
        comparisonMatchIds: prepared.comparisonMatchIds,
        leagueTotals,
        leagueColorIndex,
      }),
    );
    await yieldToMain(0);
    if (isCancelled()) return null;
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
  return computeMerchPlanFactTrend(filters, merchFilters).map((point) => ({
    period: point.period,
    value: point.factRevenue,
  }));
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

  return ALL_SECTORS.map((sector) => ({
    sector,
    value: txs
      .filter((tx) => tx.sector === sector)
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

export async function computeTicketsSalesChannelTrendIdle(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  isCancelled: () => boolean,
): Promise<TicketsSalesChannelTrendPoint[] | null> {
  const txs = filterTicketTransactions(filters, ticketFilters);
  await yieldToMain(0);
  if (isCancelled()) return null;

  const timeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);
  const activeSources =
    ticketFilters.orderSource !== "all"
      ? [ticketFilters.orderSource]
      : ORDER_SOURCES;
  const periodMap = new Map<
    string,
    { sortKey: number; channels: Map<OrderSource, number> }
  >();

  for (let i = 0; i < txs.length; i += 1) {
    const tx = txs[i];
    if (tx.orderSource && activeSources.includes(tx.orderSource)) {
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
    if (i > 0 && i % 8000 === 0) {
      await yieldToMain(0);
      if (isCancelled()) return null;
    }
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

export function computeMerchPlanFactTrend(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): PlanFactTrendPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const grouping = getEffectiveMerchTimeGrouping(merchFilters);
  const factRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const factUnitsMap = new Map<string, { sortKey: number; value: number }>();

  for (const tx of txs) {
    addPlanFactValue(
      factRevenueMap,
      tx.date,
      grouping,
      tx.isReturn ? -tx.amount : tx.amount,
    );
    addPlanFactValue(
      factUnitsMap,
      tx.date,
      grouping,
      tx.isReturn ? -tx.quantity : tx.quantity,
    );
  }

  const totalFactRevenue = Array.from(factRevenueMap.values()).reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const totalFactUnits = Array.from(factUnitsMap.values()).reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const totalPlanRevenue = Math.round(
    Math.max(0, totalFactRevenue) / MERCH_PLAN_EXECUTION_RATE,
  );
  const totalPlanUnits = Math.round(
    Math.max(0, totalFactUnits) / MERCH_PLAN_EXECUTION_RATE,
  );

  const bucketDates = getMerchPeriodBuckets(merchFilters, grouping);
  const factWeights = bucketDates.map((bucketDate) => {
    const { period } = periodKeyAndSort(bucketDate, grouping);
    return Math.max(0, factRevenueMap.get(period)?.value ?? 0);
  });
  const hasFactDistribution = factWeights.some((weight) => weight > 0);
  const seasonalWeights = bucketDates.map((_, index) => {
    const progress = index / Math.max(bucketDates.length - 1, 1);
    return 0.75 + 0.25 * Math.sin(progress * Math.PI);
  });
  const weights = hasFactDistribution
    ? factWeights.map(
        (weight, index) =>
          weight + seasonalWeights[index] * 0.08 * totalPlanRevenue,
      )
    : seasonalWeights;
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const planRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const planUnitsMap = new Map<string, { sortKey: number; value: number }>();

  for (let index = 0; index < bucketDates.length; index += 1) {
    const { period, sortKey } = periodKeyAndSort(bucketDates[index], grouping);
    planRevenueMap.set(period, {
      sortKey,
      value: Math.round((weights[index] / weightSum) * totalPlanRevenue),
    });
    planUnitsMap.set(period, {
      sortKey,
      value: Math.round((weights[index] / weightSum) * totalPlanUnits),
    });
  }

  const periods = new Set([...factRevenueMap.keys(), ...planRevenueMap.keys()]);

  return Array.from(periods)
    .map((period) => ({
      period,
      sortKey:
        factRevenueMap.get(period)?.sortKey ??
        planRevenueMap.get(period)?.sortKey ??
        0,
      planRevenue: Math.round(planRevenueMap.get(period)?.value ?? 0),
      factRevenue: Math.round(
        Math.max(0, factRevenueMap.get(period)?.value ?? 0),
      ),
      planTickets: Math.round(planUnitsMap.get(period)?.value ?? 0),
      factTickets: Math.round(
        Math.max(0, factUnitsMap.get(period)?.value ?? 0),
      ),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeMerchProductCategoryTrend(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchProductCategoryTrendPoint[] {
  const txs = getFilteredMerchTransactions(filters, merchFilters);
  const timeGrouping = getEffectiveMerchTimeGrouping(merchFilters);
  const activeCategories =
    merchFilters.productCategories.length > 0
      ? merchFilters.productCategories
      : ALL_MERCH_PRODUCT_CATEGORIES;

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

  const activeCategories =
    merchFilters.productCategories.length > 0
      ? merchFilters.productCategories
      : ALL_MERCH_PRODUCT_CATEGORIES;

  for (const category of activeCategories) {
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

  const rows = activeCategories.map((categoryKey) => ({
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

export function computeSubscriptionPriceCategoryShares(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionPriceCategoryPoint[] {
  const subs = filterSubscriptions(filters, subscriptionFilters);
  const soldByCategory = new Map<SubscriptionPriceCategory, number>();

  for (const category of ALL_SUBSCRIPTION_PRICE_CATEGORIES) {
    soldByCategory.set(category, 0);
  }

  for (const sub of subs) {
    const category = getSubscriptionPriceCategory(sub);
    soldByCategory.set(category, (soldByCategory.get(category) ?? 0) + 1);
  }

  const totalSold = subs.length;

  return ALL_SUBSCRIPTION_PRICE_CATEGORIES.map((categoryKey) => {
    const sold = soldByCategory.get(categoryKey) ?? 0;
    return {
      category: SUBSCRIPTION_PRICE_CATEGORY_LABELS[categoryKey],
      categoryKey,
      sold,
      share: totalSold > 0 ? (sold / totalSold) * 100 : 0,
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

  const aggByMatch = new Map<string, ReturnType<typeof createTicketSalesAgg>>();
  const issuedByMatch = new Map<string, number>();

  for (const tx of issuedTxs) {
    if (!tx.matchId) continue;
    const qty = getTicketIssuedQuantity(tx);
    issuedByMatch.set(
      tx.matchId,
      (issuedByMatch.get(tx.matchId) ?? 0) + qty,
    );
  }

  for (const tx of txs) {
    if (!tx.matchId) continue;
    const agg = aggByMatch.get(tx.matchId) ?? createTicketSalesAgg();
    applyTicketSalesTransaction(agg, tx);
    aggByMatch.set(tx.matchId, agg);
  }

  const rows: MatchSalesRow[] = [];

  const scale = ticketPlanScale(ticketFilters);

  for (const match of allowedMatches) {
    const issuedTickets = issuedByMatch.get(match.id) ?? 0;
    const occupancyIssuedTickets = issuedTickets;
    const agg = aggByMatch.get(match.id) ?? createTicketSalesAgg();
    if (isEmptyTicketSalesAgg(agg, issuedTickets)) {
      continue;
    }

    const planRevenue = Math.round(getMatchPlanRevenue(match) * scale);

    rows.push({
      matchId: match.id,
      eventLabel: `${match.opponent} ${format(match.date, "dd-MM-yy", { locale: ru })}`,
      date: match.date,
      revenue: agg.revenue,
      planRevenue,
      avgPrice: ticketSalesAvgPrice(agg),
      ticketsSold: agg.ticketsSold,
      freeTickets: agg.freeTickets,
      issuedTickets,
      occupancyIssuedTickets,
      capacity: match.capacity,
      loyaltyDiscountPct: ticketSalesLoyaltyDiscountPct(agg),
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
    if (!isMerchMatchTablePoint(tx.merchSalesPoint)) {
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
  const scale = merchPlanScale(merchFilters);

  for (const match of allowedMatches) {
    if (!match.eventCompleted) continue;

    const agg = aggByMatch.get(match.id) ?? createMerchMetrics();
    if (agg.receipts <= 0 || agg.revenue <= 0) continue;

    const attendance = getMatchAttendance(match);
    const explicitTarget = explicitMerchPlanFulfillment(match.id);
    const planRevenue =
      explicitTarget != null && agg.revenue > 0
        ? merchPlanRevenueForTarget(agg.revenue, explicitTarget)
        : Math.round(getMatchMerchPlanRevenue(match) * scale);

    rows.push({
      matchId: match.id,
      eventLabel: `vs ${match.opponent}`,
      date: match.date,
      revenue: agg.revenue,
      planRevenue,
      avgCheck: agg.receipts > 0 ? agg.revenue / agg.receipts : 0,
      receipts: agg.receipts,
      units: agg.units,
      upt: agg.receipts > 0 ? agg.units / agg.receipts : 0,
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

function countSubscriptionRedemptionsByMatch(
  allowedMatchIds: Set<string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const redemption of getSubscriptionRedemptions()) {
    if (!allowedMatchIds.has(redemption.matchId)) continue;
    counts.set(
      redemption.matchId,
      (counts.get(redemption.matchId) ?? 0) + 1,
    );
  }
  return counts;
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

  const allowedMatches = filterMatchesByMatchSalesFilters(matchSalesFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));
  const redemptionsByMatch = countSubscriptionRedemptionsByMatch(allowedMatchIds);

  const matchIds = new Set([
    ...ticketByMatch.keys(),
    ...merchByMatch.keys(),
    ...redemptionsByMatch.keys(),
  ]);

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
    const abonementTickets = redemptionsByMatch.get(matchId) ?? 0;
    const ticketsSold = (ticket?.ticketsSold ?? 0) + abonementTickets;
    const issuedTickets = (ticket?.issuedTickets ?? 0) + abonementTickets;

    if (
      totalRevenue <= 0 &&
      ticketsSold <= 0 &&
      issuedTickets <= 0 &&
      (merch?.receipts ?? 0) <= 0
    ) {
      continue;
    }

    const capacity = ticket?.capacity ?? match.capacity;
    const fillRate = issuedOccupancyPercent(issuedTickets, capacity) ?? 0;

    rows.push({
      matchId,
      eventLabel: `${match.opponent} ${format(match.date, "dd-MM-yy", { locale: ru })}`,
      date: match.date,
      ticketRevenue,
      merchRevenue,
      totalRevenue,
      planRevenue: ticket?.planRevenue ?? 0,
      ticketsSold,
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
  const totalOccupancyMass = rows.reduce(
    (sum, row) => sum + occupancyMassCapacity(row.capacity),
    0,
  );
  const fillRate =
    totalOccupancyMass > 0
      ? Math.min(100, (totalIssued / totalOccupancyMass) * 100)
      : 0;

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

export { getMatchById };

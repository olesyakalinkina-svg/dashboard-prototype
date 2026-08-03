import {
  addDays,
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
  matchById,
  matches,
  MOCK_TODAY,
  PREV_SEASON_START,
  SUBSCRIPTIONS_PERIOD_END,
  SUBSCRIPTIONS_PERIOD_START,
  subscriptions,
  transactions,
} from "@/lib/mock/hockey";
import {
  ORDER_SOURCE_LABELS,
  ALL_PRICE_ZONES,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/ticket-filter-options";
import {
  ALL_MERCH_SALES_POINTS,
  MERCH_SALES_POINT_LABELS,
} from "@/lib/merch-filter-options";
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
  TournamentStage,
  MatchSalesRow,
  MerchFilters,
  MerchMatchSalesRow,
  MerchSalesChannelPoint,
  MerchSalesPoint,
  MerchSkuSalesRow,
  SubscriptionFilters,
  TicketFilters,
  TicketsKpiData,
  TopProductPoint,
  Transaction,
  PlanFactTrendPoint,
  TicketMatchCumulativeSeries,
  WeeklyPoint,
} from "@/types/dashboard";

type FilterPassCache = {
  ticket: Map<string, Transaction[]>;
  merch: Map<string, Transaction[]>;
};

let filterPassCache: FilterPassCache | null = null;

export function runWithFilterCache<T>(fn: () => T): T {
  filterPassCache = { ticket: new Map(), merch: new Map() };
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
    ticketFilters.arena,
    ticketFilters.eventCompleted,
    ticketFilters.matchId,
    ticketFilters.ticketType,
    ticketFilters.priceZone,
    ticketFilters.orderSource,
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
    merchFilters.matchId,
    merchFilters.salesChannels.join(","),
  ].join("|");
}

function getDateCutoff(days: number): Date {
  return startOfDay(subDays(MOCK_TODAY, days));
}

function getSubscriptionsPeriodDays(): number {
  return (
    differenceInCalendarDays(SUBSCRIPTIONS_PERIOD_END, SUBSCRIPTIONS_PERIOD_START) +
    1
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
): number[] {
  const days = getSubscriptionsPeriodDays();
  const periodStart = startOfDay(SUBSCRIPTIONS_PERIOD_START);
  const periodEnd = endOfDay(SUBSCRIPTIONS_PERIOD_END);
  const points: number[] = [];
  const step = Math.max(1, Math.floor(days / 7));

  for (let i = days - 1; i >= 0; i -= step) {
    const from = startOfDay(subDays(SUBSCRIPTIONS_PERIOD_END, i + step));
    const to = endOfDay(subDays(SUBSCRIPTIONS_PERIOD_END, i));
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
  const TICKET_SALES_WINDOW_DAYS = 21;
  const seasonMatches = matches.filter((match) =>
    season === "all" ? true : match.season === season,
  );

  if (seasonMatches.length === 0) {
    return startOfDay(PREV_SEASON_START);
  }

  const earliestMatchDate = seasonMatches.reduce(
    (earliest, match) => (match.date < earliest ? match.date : earliest),
    seasonMatches[0].date,
  );

  return startOfDay(subDays(earliestMatchDate, TICKET_SALES_WINDOW_DAYS));
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function buildSparkline<T>(
  items: T[],
  days: number,
  getDate: (item: T) => Date,
  getValue: (slice: T[]) => number,
): number[] {
  const points: number[] = [];
  const step = Math.max(1, Math.floor(days / 7));
  for (let i = days - 1; i >= 0; i -= step) {
    const from = startOfDay(subDays(MOCK_TODAY, i + step));
    const to = endOfDay(subDays(MOCK_TODAY, i));
    const slice = items.filter((item) => {
      const d = getDate(item);
      return d >= from && d <= to;
    });
    points.push(getValue(slice));
  }
  return points;
}

export function filterMatchesByMerchFilters(
  merchFilters: MerchFilters,
  dateRange?: number,
) {
  const cutoff = dateRange ? getDateCutoff(dateRange) : null;

  return matches.filter((match) => {
    if (cutoff && match.date < cutoff && match.eventCompleted) return false;
    if (merchFilters.season !== "all" && match.season !== merchFilters.season) {
      return false;
    }
    if (merchFilters.league !== "all" && match.league !== merchFilters.league) {
      return false;
    }
    if (
      merchFilters.tournamentStage !== "all" &&
      match.tournamentStage !== merchFilters.tournamentStage
    ) {
      return false;
    }
    if (merchFilters.matchId !== "all" && match.id !== merchFilters.matchId) {
      return false;
    }
    return true;
  });
}

function hasMerchMatchFilter(merchFilters: MerchFilters): boolean {
  return (
    merchFilters.season !== "all" ||
    merchFilters.league !== "all" ||
    merchFilters.tournamentStage !== "all" ||
    merchFilters.matchId !== "all"
  );
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
  const useSeasonRange = options?.useSeasonRange ?? false;
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
  const hasMatchFilter = hasMerchMatchFilter(merchFilters);

  return transactions.filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    if (tx.stream !== "merch") return false;
    if (!passesMerchSalesChannels(tx, merchFilters.salesChannels)) return false;
    if (!tx.matchId) {
      return !hasMatchFilter;
    }
    return allowedMatchIds.has(tx.matchId);
  });
}

export function filterMatchesByTicketFilters(
  ticketFilters: TicketFilters,
  dateRange?: number,
) {
  const cutoff = dateRange ? getDateCutoff(dateRange) : null;

  return matches.filter((match) => {
    if (cutoff && match.date < cutoff && match.eventCompleted) return false;
    if (ticketFilters.season !== "all" && match.season !== ticketFilters.season) {
      return false;
    }
    if (ticketFilters.league !== "all" && match.league !== ticketFilters.league) {
      return false;
    }
    if (
      ticketFilters.tournamentStage !== "all" &&
      match.tournamentStage !== ticketFilters.tournamentStage
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
    if (ticketFilters.matchId !== "all" && match.id !== ticketFilters.matchId) {
      return false;
    }
    return true;
  });
}

function isTicketTransactionAllowed(
  tx: Transaction,
  allowedMatchIds: Set<string>,
): boolean {
  if (tx.stream !== "tickets" || !tx.matchId) return false;
  return allowedMatchIds.has(tx.matchId);
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

  return transactions.filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    return passesTicketFilters(tx, ticketFilters, allowedMatchIds);
  });
}

function filterMatches(filters: DashboardFilters) {
  const cutoff = getDateCutoff(filters.dateRange);
  return matches.filter((m) => {
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

  return transactions.filter((tx) => {
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
  const periodStart = startOfDay(SUBSCRIPTIONS_PERIOD_START);
  const periodEnd = endOfDay(SUBSCRIPTIONS_PERIOD_END);

  return subscriptions.filter((sub) => {
    if (sub.purchasedAt < periodStart || sub.purchasedAt > periodEnd) return false;
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

function countArenaTicketsIssued(txs: Transaction[]): number {
  return txs
    .filter((tx) => tx.ticketType !== "parking")
    .reduce((sum, tx) => sum + tx.quantity, 0);
}

function sumLoyaltyDiscount(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => sum + (tx.loyaltyDiscount ?? 0), 0);
}

function avgTicketPrice(txs: Transaction[]): number {
  const tickets = countTickets(txs);
  return tickets > 0 ? sumAmount(txs) / tickets : 0;
}

function passesTicketFilters(
  tx: Transaction,
  ticketFilters: TicketFilters,
  allowedMatchIds: Set<string>,
): boolean {
  if (!isTicketTransactionAllowed(tx, allowedMatchIds)) return false;
  if (ticketFilters.ticketType !== "all" && tx.ticketType !== ticketFilters.ticketType) {
    return false;
  }
  if (ticketFilters.priceZone !== "all" && tx.priceZone !== ticketFilters.priceZone) {
    return false;
  }
  if (ticketFilters.orderSource !== "all" && tx.orderSource !== ticketFilters.orderSource) {
    return false;
  }
  return true;
}

export function filterTicketTransactionsToday(
  ticketFilters: TicketFilters,
): Transaction[] {
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));
  const now = MOCK_TODAY;

  return transactions.filter((tx) => {
    if (!isSameDay(tx.date, now)) return false;
    return passesTicketFilters(tx, ticketFilters, allowedMatchIds);
  });
}

function previousPeriodTicketTransactions(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): Transaction[] {
  const prevCutoff = getDateCutoff(filters.dateRange * 2);
  const midCutoff = getDateCutoff(filters.dateRange);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));

  return transactions.filter((tx) => {
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

  return transactions.filter((tx) => {
    if (tx.date < prevCutoff || tx.date >= midCutoff) return false;
    if (tx.stream !== stream) return false;
    if (filters.matchId !== "all" && tx.matchId !== filters.matchId) return false;
    return true;
  });
}

function previousPeriodSubscriptions(
  subscriptionFilters?: SubscriptionFilters,
): Subscription[] {
  const periodDays = getSubscriptionsPeriodDays();
  const prevEnd = endOfDay(subDays(startOfDay(SUBSCRIPTIONS_PERIOD_START), 1));
  const prevStart = startOfDay(subDays(prevEnd, periodDays - 1));

  return subscriptions.filter((sub) => {
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

  const revenue = sumAmount(current);
  const prevRevenue = sumAmount(previous);
  const ticketsSold = countTickets(current);
  const prevTickets = countTickets(previous);
  const avgPrice = avgTicketPrice(current);
  const prevAvgPrice = avgTicketPrice(previous);
  const loyaltyDiscount = sumLoyaltyDiscount(current);
  const prevLoyaltyDiscount = sumLoyaltyDiscount(previous);
  const grossRevenue = revenue + loyaltyDiscount;
  const loyaltyDiscountPct =
    grossRevenue > 0 ? (loyaltyDiscount / grossRevenue) * 100 : 0;

  const eligibleCapacity = sumEligibleTicketCapacity(ticketFilters);
  const ticketsIssued = countArenaTicketsIssued(current);
  const rawFillRate =
    eligibleCapacity > 0 ? (ticketsIssued / eligibleCapacity) * 100 : 0;

  const planRevenue = sumTicketPlanRevenue(filters, ticketFilters);
  const planCompletionPct =
    planRevenue > 0 ? (revenue / planRevenue) * 100 : 0;
  const fillRate = linkFillRateToPlanCompletion(rawFillRate, planCompletionPct);

  return {
    revenue,
    revenueChange: pctChange(revenue, prevRevenue),
    ticketsSold,
    ticketsChange: pctChange(ticketsSold, prevTickets),
    avgPrice,
    avgPriceChange: pctChange(avgPrice, prevAvgPrice),
    loyaltyDiscount,
    loyaltyDiscountPct,
    loyaltyDiscountChange: pctChange(loyaltyDiscount, prevLoyaltyDiscount),
    fillRate,
    planCompletionPct,
    revenueToday: sumAmount(todayTxs),
    ticketsToday: countTickets(todayTxs),
    revenueSparkline: buildSparkline(
      current,
      filters.dateRange,
      (tx) => tx.date,
      sumAmount,
    ),
    ticketsSparkline: buildSparkline(
      current,
      filters.dateRange,
      (tx) => tx.date,
      countTickets,
    ),
  };
}

export function computeMerchKpis(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchKpiData {
  const metrics = computeMerchTotals(filters, merchFilters);

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

export function computeSubscriptionsKpis(
  filters: DashboardFilters,
  subscriptionFilters?: SubscriptionFilters,
): SubscriptionsKpiData {
  const current = filterSubscriptions(filters, subscriptionFilters);
  const previous = previousPeriodSubscriptions(subscriptionFilters);

  const revenue = current.reduce((s, sub) => s + sub.price, 0);
  const prevRevenue = previous.reduce((s, sub) => s + sub.price, 0);
  const sold = current.length;
  const prevSold = previous.length;

  const totalMatches = current.reduce((s, sub) => s + sub.matchesTotal, 0);
  const usedMatches = current.reduce((s, sub) => s + sub.matchesUsed, 0);
  const avgUtilization = totalMatches > 0 ? (usedMatches / totalMatches) * 100 : 0;
  const activeCount = current.filter((sub) =>
    isSubscriptionActive(sub, SUBSCRIPTIONS_PERIOD_END),
  ).length;

  return {
    revenue,
    revenueChange: pctChange(revenue, prevRevenue),
    sold,
    soldChange: pctChange(sold, prevSold),
    avgUtilization,
    activeCount,
    revenueSparkline: buildSubscriptionsSparkline(
      current,
      (sub) => sub.purchasedAt,
      (slice) => slice.reduce((s, sub) => s + sub.price, 0),
    ),
    soldSparkline: buildSubscriptionsSparkline(
      current,
      (sub) => sub.purchasedAt,
      (slice) => slice.length,
    ),
  };
}

function periodKeyAndSort(
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

const TICKET_PLAN_FILL_RATE = 0.82;
const TICKET_PLAN_AVG_PRICE = 1750;
const TICKET_SALES_WINDOW_DAYS = 21;
const SUBSCRIPTION_PLAN_EXECUTION_RATE = 0.94;

function getMatchTicketPlanProfile(match: {
  league: League;
}): { fillRate: number; avgPrice: number } {
  switch (match.league) {
    case "VHL":
      return { fillRate: TICKET_PLAN_FILL_RATE, avgPrice: 1100 };
    case "MHL":
      return { fillRate: TICKET_PLAN_FILL_RATE, avgPrice: 700 };
    default:
      return { fillRate: TICKET_PLAN_FILL_RATE, avgPrice: TICKET_PLAN_AVG_PRICE };
  }
}

function matchHasEligibleTicketSaleDay(
  matchDate: Date,
  cutoff: Date,
  now: Date,
): boolean {
  for (let offset = TICKET_SALES_WINDOW_DAYS; offset >= 1; offset -= 1) {
    const saleDay = subDays(matchDate, offset);
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
    if (!matchHasEligibleTicketSaleDay(match.date, cutoff, now)) {
      return total;
    }
    return total + match.capacity;
  }, 0);
}

function linkFillRateToPlanCompletion(
  fillRate: number,
  planCompletionPct: number,
): number {
  if (planCompletionPct >= 97) {
    return Math.max(fillRate, 80);
  }
  if (planCompletionPct >= 85) {
    const minFill = 70 + ((planCompletionPct - 85) / 12) * 10;
    return Math.max(fillRate, minFill);
  }
  if (planCompletionPct > 0) {
    return Math.max(fillRate, planCompletionPct * 0.82);
  }
  return fillRate;
}

function getSubscriptionPeriodWeeks(): Date[] {
  const weeks: Date[] = [];
  let current = startOfWeek(SUBSCRIPTIONS_PERIOD_START, { locale: ru });
  const periodEnd = endOfDay(SUBSCRIPTIONS_PERIOD_END);

  while (current <= periodEnd) {
    weeks.push(current);
    current = addDays(current, 7);
  }

  return weeks;
}

function ticketPlanScale(ticketFilters: TicketFilters): number {
  let scale = 1;
  if (ticketFilters.ticketType === "parking") scale *= 0.12;
  else if (ticketFilters.ticketType === "arena") scale *= 0.88;
  if (ticketFilters.priceZone !== "all") scale *= 1 / ALL_PRICE_ZONES.length;
  if (ticketFilters.orderSource !== "all") scale *= 1 / 3;
  return scale;
}

function sumTicketPlanRevenue(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): number {
  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const scale = ticketPlanScale(ticketFilters);
  let total = 0;

  for (const match of allowedMatches) {
    const planProfile = getMatchTicketPlanProfile(match);
    const matchPlanTickets = Math.round(
      match.capacity * planProfile.fillRate * scale,
    );
    const matchPlanRevenue = Math.round(matchPlanTickets * planProfile.avgPrice);
    const dailyPlanRevenue = matchPlanRevenue / TICKET_SALES_WINDOW_DAYS;

    for (let offset = TICKET_SALES_WINDOW_DAYS; offset >= 1; offset -= 1) {
      const saleDay = subDays(match.date, offset);
      if (saleDay < cutoff || saleDay > now) continue;
      total += dailyPlanRevenue;
    }
  }

  return Math.round(total);
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
): PlanFactTrendPoint[] {
  const grouping = "week" as const;
  const factRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const factCountMap = new Map<string, { sortKey: number; value: number }>();

  for (const sub of filterSubscriptions(filters, subscriptionFilters)) {
    addPlanFactValue(factRevenueMap, sub.purchasedAt, grouping, sub.price);
    addPlanFactValue(factCountMap, sub.purchasedAt, grouping, 1);
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

  const weekDates = getSubscriptionPeriodWeeks();
  const factWeights = weekDates.map((weekDate) => {
    const { period } = periodKeyAndSort(weekDate, grouping);
    return factRevenueMap.get(period)?.value ?? 0;
  });
  const hasFactDistribution = factWeights.some((weight) => weight > 0);
  const launchWeights = weekDates.map((_, index) => {
    const progress = index / Math.max(weekDates.length - 1, 1);
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

  for (let index = 0; index < weekDates.length; index += 1) {
    const { period, sortKey } = periodKeyAndSort(weekDates[index], grouping);
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
    ...factCountMap.keys(),
    ...planRevenueMap.keys(),
    ...planCountMap.keys(),
  ]);

  return Array.from(periods)
    .map((period) => ({
      period,
      sortKey:
        factRevenueMap.get(period)?.sortKey ??
        planRevenueMap.get(period)?.sortKey ??
        factCountMap.get(period)?.sortKey ??
        planCountMap.get(period)?.sortKey ??
        0,
      planRevenue: Math.round(planRevenueMap.get(period)?.value ?? 0),
      factRevenue: Math.round(factRevenueMap.get(period)?.value ?? 0),
      planTickets: Math.round(planCountMap.get(period)?.value ?? 0),
      factTickets: Math.round(factCountMap.get(period)?.value ?? 0),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export function computeTicketsPlanFactTrend(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): PlanFactTrendPoint[] {
  const factRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const factTicketsMap = new Map<string, { sortKey: number; value: number }>();
  const planRevenueMap = new Map<string, { sortKey: number; value: number }>();
  const planTicketsMap = new Map<string, { sortKey: number; value: number }>();

  for (const tx of filterTicketTransactions(filters, ticketFilters)) {
    addPlanFactValue(
      factRevenueMap,
      tx.date,
      ticketFilters.timeGrouping,
      tx.amount,
    );
    addPlanFactValue(
      factTicketsMap,
      tx.date,
      ticketFilters.timeGrouping,
      tx.quantity,
    );
  }

  const cutoff = getTicketsSeasonCutoff(ticketFilters.season);
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const scale = ticketPlanScale(ticketFilters);

  for (const match of allowedMatches) {
    const planProfile = getMatchTicketPlanProfile(match);
    const matchPlanTickets = Math.round(match.capacity * planProfile.fillRate * scale);
    const matchPlanRevenue = Math.round(matchPlanTickets * planProfile.avgPrice);
    const dailyPlanTickets = matchPlanTickets / TICKET_SALES_WINDOW_DAYS;
    const dailyPlanRevenue = matchPlanRevenue / TICKET_SALES_WINDOW_DAYS;

    for (let offset = TICKET_SALES_WINDOW_DAYS; offset >= 1; offset -= 1) {
      const saleDay = subDays(match.date, offset);
      if (saleDay < cutoff || saleDay > now) continue;

      addPlanFactValue(
        planTicketsMap,
        saleDay,
        ticketFilters.timeGrouping,
        dailyPlanTickets,
      );
      addPlanFactValue(
        planRevenueMap,
        saleDay,
        ticketFilters.timeGrouping,
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
  const txs = filterTicketTransactions(filters, ticketFilters);
  const chartMatches = filterMatchesByTicketFilters(ticketFilters).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const leagueTotals: Record<League, number> = { KHL: 0, VHL: 0, MHL: 0 };
  const leagueColorIndex: Record<League, number> = { KHL: 0, VHL: 0, MHL: 0 };

  for (const match of chartMatches) {
    const hasSales = txs.some((tx) => tx.matchId === match.id);
    if (hasSales) {
      leagueTotals[match.league] += 1;
    }
  }

  const series: TicketMatchCumulativeSeries[] = [];

  for (const match of chartMatches) {
    const matchTxs = txs.filter((tx) => tx.matchId === match.id);
    if (matchTxs.length === 0) continue;

    const dailyMap = new Map<number, { revenue: number; tickets: number }>();

    for (const tx of matchTxs) {
      const dateKey = startOfDay(tx.date).getTime();
      const entry = dailyMap.get(dateKey) ?? { revenue: 0, tickets: 0 };
      entry.revenue += tx.amount;
      if (tx.amount > 0) {
        entry.tickets += tx.quantity;
      }
      dailyMap.set(dateKey, entry);
    }

    let cumulativeRevenue = 0;
    let cumulativeTickets = 0;
    const points = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dateKey, day]) => {
        cumulativeRevenue += day.revenue;
        cumulativeTickets += day.tickets;
        return {
          date: format(new Date(dateKey), "dd.MM.yy"),
          dateKey,
          revenue: cumulativeRevenue,
          tickets: cumulativeTickets,
        };
      });

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
      points,
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

function getMerchTransactionsBySalesChannel(
  merchFilters: MerchFilters,
): Transaction[] {
  const cutoff = getTicketsSeasonCutoff(merchFilters.season);

  return transactions.filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    if (tx.stream !== "merch") return false;
    return passesMerchSalesChannels(tx, merchFilters.salesChannels);
  });
}

export function computeMerchSalesChannelRevenue(
  merchFilters: MerchFilters,
): MerchSalesChannelPoint[] {
  const txs = getMerchTransactionsBySalesChannel(merchFilters);
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
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);

  type MatchAgg = {
    revenue: number;
    loyaltyDiscount: number;
    ticketsSold: number;
    freeTickets: number;
  };

  const aggByMatch = new Map<string, MatchAgg>();

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

  for (const match of allowedMatches) {
    const agg = aggByMatch.get(match.id);
    if (!agg) continue;

    const gross = agg.revenue + agg.loyaltyDiscount;

    rows.push({
      matchId: match.id,
      eventLabel: `${match.opponent} ${format(match.date, "dd-MM-yy", { locale: ru })}`,
      date: match.date,
      revenue: agg.revenue,
      avgPrice: agg.ticketsSold > 0 ? agg.revenue / agg.ticketsSold : 0,
      ticketsSold: agg.ticketsSold,
      freeTickets: agg.freeTickets,
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

  type SkuAgg = MerchAggregateMetrics & { receiptsWithProduct: number };

  const aggByProduct = new Map<string, SkuAgg>();

  for (const tx of txs) {
    const productName = tx.description.replace(/^Возврат:\s*/, "");
    const agg = aggByProduct.get(productName) ?? {
      ...createMerchMetrics(),
      receiptsWithProduct: 0,
    };

    if (tx.isReturn) {
      applyMerchTransaction(agg, tx);
      agg.receiptsWithProduct = Math.max(0, agg.receiptsWithProduct - 1);
    } else {
      applyMerchTransaction(agg, tx);
      agg.receiptsWithProduct += 1;
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
    }))
    .filter((row) => row.units > 0)
    .sort((a, b) => b.units - a.units);
}

export { matchById };

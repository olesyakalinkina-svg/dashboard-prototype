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
  SEASON_START,
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
  MerchKpiData,
  Subscription,
  SubscriptionPlanStat,
  SubscriptionsKpiData,
  TournamentStage,
  MatchSalesRow,
  MerchFilters,
  MerchMatchSalesRow,
  MerchSkuSalesRow,
  SubscriptionFilters,
  TicketFilters,
  TicketsKpiData,
  TopProductPoint,
  Transaction,
  PlanFactTrendPoint,
  WeeklyPoint,
} from "@/types/dashboard";

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

function getTicketsSeasonCutoff(): Date {
  return startOfDay(SEASON_START);
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

export function filterMerchTransactions(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  options?: { useSeasonRange?: boolean },
): Transaction[] {
  const useSeasonRange = options?.useSeasonRange ?? false;
  const cutoff = useSeasonRange
    ? getTicketsSeasonCutoff()
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
  const cutoff = getTicketsSeasonCutoff();
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

  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const totalCapacity = allowedMatches.reduce((sum, match) => sum + match.capacity, 0);
  const ticketsIssued = countArenaTicketsIssued(current);
  const fillRate =
    totalCapacity > 0 ? (ticketsIssued / totalCapacity) * 100 : 0;

  const planRevenue = sumTicketPlanRevenue(filters, ticketFilters);
  const planCompletionPct =
    planRevenue > 0 ? (revenue / planRevenue) * 100 : 0;

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

function sumMerchCost(txs: Transaction[]): number {
  return txs.reduce(
    (sum, tx) => sum + (tx.costAmount ?? Math.round(tx.amount * 0.55)),
    0,
  );
}

export function computeMerchKpis(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchKpiData {
  const current = filterMerchTransactions(filters, merchFilters);
  const salesTxs = current.filter((tx) => !tx.isReturn);
  const returnTxs = current.filter((tx) => tx.isReturn);

  const revenue = sumAmount(salesTxs);
  const returnsValue = sumAmount(returnTxs);
  const grossSales = revenue + returnsValue;
  const receipts = salesTxs.length;
  const unitsSold = countUnits(salesTxs);
  const totalCost = sumMerchCost(salesTxs);

  return {
    revenue,
    avgCheck: receipts > 0 ? revenue / receipts : 0,
    upt: receipts > 0 ? unitsSold / receipts : 0,
    receipts,
    returnsPct: grossSales > 0 ? (returnsValue / grossSales) * 100 : 0,
    marginPct: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0,
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
  const cutoff = getTicketsSeasonCutoff();
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const scale = ticketPlanScale(ticketFilters);
  let total = 0;

  for (const match of allowedMatches) {
    const matchPlanTickets = Math.round(
      match.capacity * TICKET_PLAN_FILL_RATE * scale,
    );
    const matchPlanRevenue = Math.round(matchPlanTickets * TICKET_PLAN_AVG_PRICE);
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

  const cutoff = getTicketsSeasonCutoff();
  const now = endOfDay(MOCK_TODAY);
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const scale = ticketPlanScale(ticketFilters);

  for (const match of allowedMatches) {
    const matchPlanTickets = Math.round(match.capacity * TICKET_PLAN_FILL_RATE * scale);
    const matchPlanRevenue = Math.round(matchPlanTickets * TICKET_PLAN_AVG_PRICE);
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
  const useSeasonRange =
    merchFilters.timeGrouping === "month" ||
    merchFilters.timeGrouping === "quarter";
  const txs = filterMerchTransactions(filters, merchFilters, {
    useSeasonRange,
  }).filter((tx) => !tx.isReturn);

  return buildGroupedTrend(
    txs.map((tx) => ({ date: tx.date, value: tx.amount })),
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
  const txs = filterMerchTransactions(filters, merchFilters);
  const productMap = new Map<string, TopProductPoint>();

  for (const tx of txs) {
    const existing = productMap.get(tx.description) ?? {
      name: tx.description,
      revenue: 0,
      units: 0,
    };
    existing.revenue += tx.amount;
    existing.units += tx.quantity;
    productMap.set(tx.description, existing);
  }

  return Array.from(productMap.values())
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

export function computeMerchMatchSalesTable(
  _filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchMatchSalesRow[] {
  const cutoff = getTicketsSeasonCutoff();
  const allowedMatches = filterMatchesByMerchFilters(merchFilters);
  const allowedMatchIds = new Set(allowedMatches.map((m) => m.id));
  const hasMatchFilter = hasMerchMatchFilter(merchFilters);

  const txs = transactions.filter((tx) => {
    if (tx.date < cutoff || tx.date > endOfDay(MOCK_TODAY)) return false;
    if (tx.stream !== "merch") return false;
    if (!passesMerchSalesChannels(tx, merchFilters.salesChannels)) return false;
    if (!tx.matchId) {
      return !hasMatchFilter;
    }
    return allowedMatchIds.has(tx.matchId);
  });

  type MatchAgg = {
    revenue: number;
    receipts: number;
    units: number;
  };

  const aggByMatch = new Map<string, MatchAgg>();

  for (const tx of txs) {
    if (!tx.matchId) continue;

    const agg = aggByMatch.get(tx.matchId) ?? {
      revenue: 0,
      receipts: 0,
      units: 0,
    };

    if (tx.isReturn) {
      agg.revenue -= tx.amount;
      agg.units -= tx.quantity;
    } else {
      agg.revenue += tx.amount;
      agg.receipts += 1;
      agg.units += tx.quantity;
    }

    aggByMatch.set(tx.matchId, agg);
  }

  const rows: MerchMatchSalesRow[] = [];

  for (const match of allowedMatches) {
    const agg = aggByMatch.get(match.id);
    if (!agg || agg.revenue <= 0 || agg.receipts <= 0) continue;

    const attendance =
      match.attendance > 0 ? match.attendance : Math.round(match.capacity * 0.6);

    rows.push({
      matchId: match.id,
      eventLabel: `vs ${match.opponent}`,
      date: match.date,
      revenue: agg.revenue,
      avgCheck: agg.revenue / agg.receipts,
      receipts: agg.receipts,
      units: agg.units,
      upt: agg.units / agg.receipts,
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
  const txs = filterMerchTransactions(filters, merchFilters);

  type SkuAgg = {
    units: number;
    receiptIds: Set<string>;
    revenue: number;
    cost: number;
  };

  const aggByProduct = new Map<string, SkuAgg>();

  for (const tx of txs) {
    const agg = aggByProduct.get(tx.description) ?? {
      units: 0,
      receiptIds: new Set<string>(),
      revenue: 0,
      cost: 0,
    };

    if (tx.isReturn) {
      agg.units -= tx.quantity;
      agg.revenue -= tx.amount;
      agg.cost -= tx.costAmount ?? Math.round(tx.amount * 0.55);
    } else {
      agg.units += tx.quantity;
      agg.receiptIds.add(tx.id);
      agg.revenue += tx.amount;
      agg.cost += tx.costAmount ?? Math.round(tx.amount * 0.55);
    }

    aggByProduct.set(tx.description, agg);
  }

  return Array.from(aggByProduct.entries())
    .map(([productName, agg]) => ({
      productName,
      units: agg.units,
      receiptsWithProduct: agg.receiptIds.size,
      marginPct:
        agg.revenue > 0 ? ((agg.revenue - agg.cost) / agg.revenue) * 100 : 0,
    }))
    .filter((row) => row.units > 0)
    .sort((a, b) => b.units - a.units);
}

export { matchById };

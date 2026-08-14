"use client";

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  computeChannelMix,
  computeMatchSalesTable,
  computeMerchMatchSalesTable,
  computeMerchProductCategoryRevenue,
  computeMerchProductCategoryTrend,
  computeMerchSalesChannelRevenue,
  computeMerchSalesChannelTrend,
  computeMerchSalesSegmentTrend,
  computeMerchSkuSalesTable,
  computeMerchKpis,
  computeOrderSourceSales,
  computePriceZoneSales,
  computeSubscriptionTariffStats,
  computeSubscriptionsKpis,
  computeSubscriptionsPlanFactTrend,
  computeTicketTypeSales,
  computeTicketsKpis,
  computeTicketsMatchCumulativeSeries,
  computeTicketsPlanFactTrend,
  computeTicketsSalesChannelTrend,
  computeTicketsPriceZoneTrend,
  computeTopProducts,
  computeMatchRevenueChart,
  computeMatchSalesKpis,
  computeCombinedMatchSalesTable,
  filterMatchesByMatchSalesFilters,
  filterMatchesByMerchFilters,
  filterMatchesByTicketFilters,
  runWithFilterCache,
} from "@/lib/filters";
import {
  buildMatchFilterOptions,
  DEFAULT_TICKET_FILTERS,
  getEffectiveTicketTimeGrouping,
} from "@/lib/ticket-filter-options";
import {
  DEFAULT_MERCH_FILTERS,
  getEffectiveMerchTimeGrouping,
} from "@/lib/merch-filter-options";
import { DEFAULT_MATCH_SALES_FILTERS } from "@/lib/match-sales-filter-options";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import { loadMockData } from "@/lib/mock/data-store";
import { DashboardLoading } from "@/components/layout/DashboardLoading";
import type {
  ChannelMixPoint,
  DashboardFilters,
  DashboardTab,
  DateRangePreset,
  CombinedMatchSalesRow,
  MatchRevenuePoint,
  MatchSalesFilters,
  MatchSalesKpiData,
  MatchSalesRow,
  MerchFilters,
  MerchKpiData,
  MerchMatchSalesRow,
  MerchProductCategoryPoint,
  MerchProductCategoryTrendPoint,
  MerchSalesChannelPoint,
  MerchSalesChannelTrendPoint,
  MerchSalesSegmentTrendPoint,
  MerchSkuSalesRow,
  OrderSourceSalesPoint,
  PlanFactTrendPoint,
  SubscriptionsPlanFactTrendPoint,
  PriceZoneSalesPoint,
  SubscriptionFilters,
  SubscriptionPlanStat,
  SubscriptionsKpiData,
  TicketFilters,
  TicketMatchCumulativeSeries,
  TicketsSalesChannelTrendPoint,
  TicketsPriceZoneTrendPoint,
  TicketTypeSalesPoint,
  TicketsKpiData,
  TimeGrouping,
  TopProductPoint,
} from "@/types/dashboard";

const TREND_TIME_GROUPINGS: TimeGrouping[] = ["day", "week", "month"];

type TicketsTrendSlice = {
  ticketsPlanFactTrend: PlanFactTrendPoint[];
  ticketsSalesChannelTrend: TicketsSalesChannelTrendPoint[];
  ticketsPriceZoneTrend: TicketsPriceZoneTrendPoint[];
};

type TicketsTabCachedData = {
  base: Omit<
    FilterDataContextValue,
    "ticketsPlanFactTrend" | "ticketsSalesChannelTrend" | "ticketsPriceZoneTrend"
  >;
  trendsByGrouping: Record<TimeGrouping, TicketsTrendSlice>;
};

type MerchTrendSlice = {
  merchSalesChannelTrend: MerchSalesChannelTrendPoint[];
  merchSalesSegmentTrend: MerchSalesSegmentTrendPoint[];
  merchProductCategoryTrend: MerchProductCategoryTrendPoint[];
};

type MerchTabCachedData = {
  base: Omit<
    FilterDataContextValue,
    | "merchSalesChannelTrend"
    | "merchSalesSegmentTrend"
    | "merchProductCategoryTrend"
  >;
  trendsByGrouping: Record<TimeGrouping, MerchTrendSlice>;
};

type SubscriptionsTabCachedData = {
  base: Omit<FilterDataContextValue, "subscriptionsPlanFactTrend">;
  trendsByGrouping: Record<TimeGrouping, SubscriptionsPlanFactTrendPoint[]>;
};

type FilterStateContextValue = {
  filters: DashboardFilters;
  ticketFilters: TicketFilters;
  merchFilters: MerchFilters;
  matchSalesFilters: MatchSalesFilters;
  subscriptionFilters: SubscriptionFilters;
  activeTab: DashboardTab;
  lastUpdated: Date | null;
  setDateRange: (range: DateRangePreset) => void;
  setMatchId: (matchId: string | "all") => void;
  setTicketFilters: (patch: Partial<TicketFilters>) => void;
  setMerchFilters: (patch: Partial<MerchFilters>) => void;
  setMatchSalesFilters: (patch: Partial<MatchSalesFilters>) => void;
  setSubscriptionFilters: (patch: Partial<SubscriptionFilters>) => void;
  setActiveTab: (tab: DashboardTab) => void;
  resetFilters: () => void;
  resetTicketFilters: () => void;
  resetMerchFilters: () => void;
  resetMatchSalesFilters: () => void;
  resetSubscriptionFilters: () => void;
  refresh: () => void;
  ticketMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
  merchMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
  matchSalesMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
};

type FilterDataContextValue = {
  ticketsKpis: TicketsKpiData;
  merchKpis: MerchKpiData;
  subscriptionsKpis: SubscriptionsKpiData;
  ticketsMatchCumulativeSeries: TicketMatchCumulativeSeries[];
  ticketsPlanFactTrend: PlanFactTrendPoint[];
  ticketsSalesChannelTrend: TicketsSalesChannelTrendPoint[];
  ticketsPriceZoneTrend: TicketsPriceZoneTrendPoint[];
  subscriptionsPlanFactTrend: SubscriptionsPlanFactTrendPoint[];
  channelMix: ChannelMixPoint[];
  topProducts: TopProductPoint[];
  subscriptionTariffStats: SubscriptionPlanStat[];
  matchSales: MatchSalesRow[];
  combinedMatchSales: CombinedMatchSalesRow[];
  matchSalesKpis: MatchSalesKpiData;
  matchRevenueChart: MatchRevenuePoint[];
  ticketTypeSales: TicketTypeSalesPoint[];
  priceZoneSales: PriceZoneSalesPoint[];
  orderSourceSales: OrderSourceSalesPoint[];
  merchMatchSales: MerchMatchSalesRow[];
  merchSalesChannelRevenue: MerchSalesChannelPoint[];
  merchSalesChannelTrend: MerchSalesChannelTrendPoint[];
  merchSalesSegmentTrend: MerchSalesSegmentTrendPoint[];
  merchProductCategoryRevenue: MerchProductCategoryPoint[];
  merchProductCategoryTrend: MerchProductCategoryTrendPoint[];
  merchSkuSales: MerchSkuSalesRow[];
};

export type FilterContextValue = FilterStateContextValue & FilterDataContextValue;

const defaultFilters: DashboardFilters = {
  dateRange: 30,
  stream: "all",
  matchId: "all",
  promotionId: "all",
};

const EMPTY_TICKETS_KPIS: TicketsKpiData = {
  revenue: 0,
  revenueChange: 0,
  ticketsSold: 0,
  ticketsChange: 0,
  avgPrice: 0,
  avgPriceChange: 0,
  loyaltyDiscount: 0,
  loyaltyDiscountPct: 0,
  loyaltyDiscountChange: 0,
  fillRate: 0,
  planCompletionPct: 0,
  revenueToday: 0,
  ticketsToday: 0,
  revenueSparkline: [],
  ticketsSparkline: [],
};

const EMPTY_MERCH_KPIS: MerchKpiData = {
  revenue: 0,
  avgCheck: 0,
  upt: 0,
  receipts: 0,
  returnsPct: 0,
  marginPct: 0,
};

const EMPTY_SUBSCRIPTIONS_KPIS: SubscriptionsKpiData = {
  revenue: 0,
  revenueChange: 0,
  sold: 0,
  soldChange: 0,
  avgUtilization: 0,
  activeCount: 0,
  revenueSparkline: [],
  soldSparkline: [],
};

const EMPTY_MATCH_SALES_KPIS: MatchSalesKpiData = {
  totalRevenue: 0,
  ticketRevenue: 0,
  merchRevenue: 0,
  ticketsSold: 0,
  fillRate: 0,
  matchCount: 0,
};

const FilterStateContext = createContext<FilterStateContextValue | null>(null);
const FilterDataContext = createContext<FilterDataContextValue | null>(null);

function computeTicketsTabDataCached(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): TicketsTabCachedData {
  return runWithFilterCache(() => {
    const trendsByGrouping = {} as Record<TimeGrouping, TicketsTrendSlice>;
    for (const grouping of TREND_TIME_GROUPINGS) {
      const withGrouping = { ...ticketFilters, timeGrouping: grouping };
      trendsByGrouping[grouping] = {
        ticketsPlanFactTrend: computeTicketsPlanFactTrend(filters, withGrouping),
        ticketsSalesChannelTrend: computeTicketsSalesChannelTrend(
          filters,
          withGrouping,
        ),
        ticketsPriceZoneTrend: computeTicketsPriceZoneTrend(filters, withGrouping),
      };
    }

    return {
      base: {
        ticketsKpis: computeTicketsKpis(filters, ticketFilters),
        merchKpis: EMPTY_MERCH_KPIS,
        subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
        ticketsMatchCumulativeSeries: computeTicketsMatchCumulativeSeries(
          filters,
          ticketFilters,
        ),
        subscriptionsPlanFactTrend: [],
        channelMix: [],
        topProducts: [],
        subscriptionTariffStats: [],
        matchSales: computeMatchSalesTable(filters, ticketFilters),
        combinedMatchSales: [],
        matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
        matchRevenueChart: [],
        ticketTypeSales: computeTicketTypeSales(filters, ticketFilters),
        priceZoneSales: computePriceZoneSales(filters, ticketFilters),
        orderSourceSales: computeOrderSourceSales(filters, ticketFilters),
        merchMatchSales: [],
        merchSalesChannelRevenue: [],
        merchSalesChannelTrend: [],
        merchSalesSegmentTrend: [],
        merchProductCategoryRevenue: [],
        merchProductCategoryTrend: [],
        merchSkuSales: [],
      },
      trendsByGrouping,
    };
  });
}

function computeMerchTabDataCached(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): MerchTabCachedData {
  return runWithFilterCache(() => {
    const trendsByGrouping = {} as Record<TimeGrouping, MerchTrendSlice>;
    for (const grouping of TREND_TIME_GROUPINGS) {
      const withGrouping = { ...merchFilters, timeGrouping: grouping };
      trendsByGrouping[grouping] = {
        merchSalesChannelTrend: computeMerchSalesChannelTrend(
          filters,
          withGrouping,
        ),
        merchSalesSegmentTrend: computeMerchSalesSegmentTrend(
          filters,
          withGrouping,
        ),
        merchProductCategoryTrend: computeMerchProductCategoryTrend(
          filters,
          withGrouping,
        ),
      };
    }

    return {
      base: {
        ticketsKpis: EMPTY_TICKETS_KPIS,
        merchKpis: computeMerchKpis(filters, merchFilters),
        subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
        ticketsMatchCumulativeSeries: [],
        ticketsPlanFactTrend: [],
        ticketsSalesChannelTrend: [],
        ticketsPriceZoneTrend: [],
        subscriptionsPlanFactTrend: [],
        channelMix: [],
        topProducts: computeTopProducts(filters, merchFilters),
        subscriptionTariffStats: [],
        matchSales: [],
        combinedMatchSales: [],
        matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
        matchRevenueChart: [],
        ticketTypeSales: [],
        priceZoneSales: [],
        orderSourceSales: [],
        merchMatchSales: computeMerchMatchSalesTable(filters, merchFilters),
        merchSalesChannelRevenue: computeMerchSalesChannelRevenue(
          filters,
          merchFilters,
        ),
        merchProductCategoryRevenue: computeMerchProductCategoryRevenue(
          filters,
          merchFilters,
        ),
        merchSkuSales: computeMerchSkuSalesTable(filters, merchFilters),
      },
      trendsByGrouping,
    };
  });
}

function computeSubscriptionsTabDataCached(
  filters: DashboardFilters,
  subscriptionFilters: SubscriptionFilters,
): SubscriptionsTabCachedData {
  return runWithFilterCache(() => {
    const trendsByGrouping = {} as Record<
      TimeGrouping,
      SubscriptionsPlanFactTrendPoint[]
    >;
    for (const grouping of TREND_TIME_GROUPINGS) {
      const withGrouping = { ...subscriptionFilters, timeGrouping: grouping };
      trendsByGrouping[grouping] = computeSubscriptionsPlanFactTrend(
        filters,
        withGrouping,
      );
    }

    return {
      base: {
        ticketsKpis: EMPTY_TICKETS_KPIS,
        merchKpis: EMPTY_MERCH_KPIS,
        subscriptionsKpis: computeSubscriptionsKpis(filters, subscriptionFilters),
        ticketsMatchCumulativeSeries: [],
        ticketsPlanFactTrend: [],
        ticketsSalesChannelTrend: [],
        ticketsPriceZoneTrend: [],
        channelMix: computeChannelMix(
          filters,
          "subscriptions",
          subscriptionFilters,
        ),
        topProducts: [],
        subscriptionTariffStats: computeSubscriptionTariffStats(
          filters,
          subscriptionFilters,
        ),
        matchSales: [],
        combinedMatchSales: [],
        matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
        matchRevenueChart: [],
        ticketTypeSales: [],
        priceZoneSales: [],
        orderSourceSales: [],
        merchMatchSales: [],
        merchSalesChannelRevenue: [],
        merchSalesChannelTrend: [],
        merchSalesSegmentTrend: [],
        merchProductCategoryRevenue: [],
        merchProductCategoryTrend: [],
        merchSkuSales: [],
      },
      trendsByGrouping,
    };
  });
}

function computeMatchesTabData(
  filters: DashboardFilters,
  matchSalesFiltersForData: MatchSalesFilters,
): FilterDataContextValue {
  return runWithFilterCache(() => ({
    ticketsKpis: EMPTY_TICKETS_KPIS,
    merchKpis: EMPTY_MERCH_KPIS,
    subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
    ticketsMatchCumulativeSeries: [],
    ticketsPlanFactTrend: [],
    ticketsSalesChannelTrend: [],
    ticketsPriceZoneTrend: [],
    subscriptionsPlanFactTrend: [],
    channelMix: [],
    topProducts: [],
    subscriptionTariffStats: [],
    matchSales: [],
    combinedMatchSales: computeCombinedMatchSalesTable(
      filters,
      matchSalesFiltersForData,
    ),
    matchSalesKpis: computeMatchSalesKpis(filters, matchSalesFiltersForData),
    matchRevenueChart: computeMatchRevenueChart(
      filters,
      matchSalesFiltersForData,
    ),
    ticketTypeSales: [],
    priceZoneSales: [],
    orderSourceSales: [],
    merchMatchSales: [],
    merchSalesChannelRevenue: [],
    merchSalesChannelTrend: [],
    merchSalesSegmentTrend: [],
    merchProductCategoryRevenue: [],
    merchProductCategoryTrend: [],
    merchSkuSales: [],
  }));
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [ticketFilters, setTicketFiltersState] =
    useState<TicketFilters>(DEFAULT_TICKET_FILTERS);
  const [merchFilters, setMerchFiltersState] =
    useState<MerchFilters>(DEFAULT_MERCH_FILTERS);
  const [matchSalesFilters, setMatchSalesFiltersState] =
    useState<MatchSalesFilters>(DEFAULT_MATCH_SALES_FILTERS);
  const [subscriptionFilters, setSubscriptionFiltersState] =
    useState<SubscriptionFilters>(DEFAULT_SUBSCRIPTION_FILTERS);
  const [activeTab, setActiveTabState] = useState<DashboardTab>("tickets");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Always false on the first render so SSR HTML matches client hydration.
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMockData()
      .then(() => {
        if (cancelled) return;
        setDataReady(true);
        setLastUpdated(new Date());
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDataError(
            error instanceof Error ? error.message : "Failed to load dashboard data",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setDateRange = useCallback((dateRange: DateRangePreset) => {
    setFilters((prev) => ({ ...prev, dateRange }));
  }, []);

  const setMatchId = useCallback((matchId: string | "all") => {
    setFilters((prev) => ({ ...prev, matchId }));
  }, []);

  const setTicketFilters = useCallback((patch: Partial<TicketFilters>) => {
    setTicketFiltersState((prev) => {
      const next = { ...prev, ...patch };
      const effectiveTimeGrouping = getEffectiveTicketTimeGrouping(next);
      // Persist month→day only; other groupings stay so they restore when
      // purchase-date or single-match overrides are cleared.
      if (effectiveTimeGrouping === "day" && next.timeGrouping === "month") {
        next.timeGrouping = "day";
      }
      return next;
    });
  }, []);

  const setMerchFilters = useCallback((patch: Partial<MerchFilters>) => {
    setMerchFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setMatchSalesFilters = useCallback((patch: Partial<MatchSalesFilters>) => {
    setMatchSalesFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSubscriptionFilters = useCallback((patch: Partial<SubscriptionFilters>) => {
    setSubscriptionFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const resetTicketFilters = useCallback(() => {
    setFilters(defaultFilters);
    setTicketFiltersState(DEFAULT_TICKET_FILTERS);
  }, []);

  const resetMerchFilters = useCallback(() => {
    setFilters(defaultFilters);
    setMerchFiltersState(DEFAULT_MERCH_FILTERS);
  }, []);

  const resetMatchSalesFilters = useCallback(() => {
    setFilters(defaultFilters);
    setMatchSalesFiltersState(DEFAULT_MATCH_SALES_FILTERS);
  }, []);

  const resetSubscriptionFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSubscriptionFiltersState(DEFAULT_SUBSCRIPTION_FILTERS);
  }, []);

  const setActiveTab = useCallback((tab: DashboardTab) => {
    setActiveTabState(tab);
  }, []);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  const ticketMatchOptions = useMemo(
    () =>
      dataReady
        ? buildMatchFilterOptions(
            filterMatchesByTicketFilters({ ...ticketFilters, matchId: [] }),
          )
        : [],
    [
      dataReady,
      ticketFilters.season,
      ticketFilters.league,
      ticketFilters.tournamentStage,
      ticketFilters.matchClass,
      ticketFilters.arena,
      ticketFilters.eventCompleted,
    ],
  );

  const merchMatchOptions = useMemo(
    () =>
      dataReady
        ? buildMatchFilterOptions(
            filterMatchesByMerchFilters({ ...merchFilters, matchId: [] }),
          )
        : [],
    [
      dataReady,
      merchFilters.season,
      merchFilters.league,
      merchFilters.tournamentStage,
      merchFilters.matchClass,
    ],
  );

  const matchSalesMatchOptions = useMemo(
    () =>
      dataReady
        ? buildMatchFilterOptions(
            filterMatchesByMatchSalesFilters({
              ...matchSalesFilters,
              matchId: [],
            }),
          )
        : [],
    [
      dataReady,
      matchSalesFilters.season,
      matchSalesFilters.league,
      matchSalesFilters.tournamentStage,
      matchSalesFilters.matchClass,
      matchSalesFilters.arena,
      matchSalesFilters.eventCompleted,
    ],
  );

  const deferredFilters = useDeferredValue(filters);
  const deferredTicketFilters = useDeferredValue(ticketFilters);
  const deferredMerchFilters = useDeferredValue(merchFilters);
  const deferredMatchSalesFilters = useDeferredValue(matchSalesFilters);
  const deferredSubscriptionFilters = useDeferredValue(subscriptionFilters);

  const ticketFiltersForStableData = useMemo(
    () => ({
      ...deferredTicketFilters,
      matchId: deferredTicketFilters.matchId,
      transactionDateRange: {
        ...deferredTicketFilters.transactionDateRange,
      },
    }),
    [
      deferredTicketFilters.season,
      deferredTicketFilters.league,
      deferredTicketFilters.tournamentStage,
      deferredTicketFilters.matchClass,
      deferredTicketFilters.arena,
      deferredTicketFilters.eventCompleted,
      deferredTicketFilters.matchId,
      deferredTicketFilters.ticketType,
      deferredTicketFilters.priceZone,
      deferredTicketFilters.orderSource,
      deferredTicketFilters.transactionDateRange.from,
      deferredTicketFilters.transactionDateRange.to,
    ],
  );

  const ticketFiltersForData = useMemo(
    () => ({
      ...ticketFiltersForStableData,
      timeGrouping: deferredTicketFilters.timeGrouping,
    }),
    [ticketFiltersForStableData, deferredTicketFilters.timeGrouping],
  );

  const merchFiltersForStableData = useMemo(
    () => ({
      ...deferredMerchFilters,
      matchId: deferredMerchFilters.matchId,
      salesChannels: deferredMerchFilters.salesChannels,
      orderDateRange: { ...deferredMerchFilters.orderDateRange },
    }),
    [
      deferredMerchFilters.season,
      deferredMerchFilters.league,
      deferredMerchFilters.tournamentStage,
      deferredMerchFilters.matchClass,
      deferredMerchFilters.matchId,
      deferredMerchFilters.salesChannels,
      deferredMerchFilters.orderDateRange.from,
      deferredMerchFilters.orderDateRange.to,
    ],
  );

  const merchFiltersForData = useMemo(
    () => ({
      ...merchFiltersForStableData,
      timeGrouping: deferredMerchFilters.timeGrouping,
    }),
    [merchFiltersForStableData, deferredMerchFilters.timeGrouping],
  );

  const subscriptionFiltersForStableData = useMemo(
    () => ({ ...deferredSubscriptionFilters }),
    [
      deferredSubscriptionFilters.season,
      deferredSubscriptionFilters.league,
      deferredSubscriptionFilters.tournamentStage,
      deferredSubscriptionFilters.arena,
      deferredSubscriptionFilters.ticketType,
      deferredSubscriptionFilters.priceZone,
    ],
  );

  const subscriptionFiltersForData = useMemo(
    () => ({
      ...subscriptionFiltersForStableData,
      timeGrouping: deferredSubscriptionFilters.timeGrouping,
    }),
    [
      subscriptionFiltersForStableData,
      deferredSubscriptionFilters.timeGrouping,
    ],
  );

  const matchSalesFiltersForData = useMemo(
    () => ({
      ...deferredMatchSalesFilters,
      matchId: deferredMatchSalesFilters.matchId,
      purchaseDateRange: { ...deferredMatchSalesFilters.purchaseDateRange },
    }),
    [
      deferredMatchSalesFilters.season,
      deferredMatchSalesFilters.league,
      deferredMatchSalesFilters.tournamentStage,
      deferredMatchSalesFilters.matchClass,
      deferredMatchSalesFilters.arena,
      deferredMatchSalesFilters.eventCompleted,
      deferredMatchSalesFilters.matchId,
      deferredMatchSalesFilters.purchaseDateRange.from,
      deferredMatchSalesFilters.purchaseDateRange.to,
    ],
  );

  const stateValue = useMemo<FilterStateContextValue>(
    () => ({
      filters,
      ticketFilters,
      merchFilters,
      matchSalesFilters,
      subscriptionFilters,
      activeTab,
      lastUpdated,
      setDateRange,
      setMatchId,
      setTicketFilters,
      setMerchFilters,
      setMatchSalesFilters,
      setSubscriptionFilters,
      setActiveTab,
      resetFilters,
      resetTicketFilters,
      resetMerchFilters,
      resetMatchSalesFilters,
      resetSubscriptionFilters,
      refresh,
      ticketMatchOptions,
      merchMatchOptions,
      matchSalesMatchOptions,
    }),
    [
      filters,
      ticketFilters,
      merchFilters,
      matchSalesFilters,
      subscriptionFilters,
      activeTab,
      lastUpdated,
      setDateRange,
      setMatchId,
      setTicketFilters,
      setMerchFilters,
      setMatchSalesFilters,
      setSubscriptionFilters,
      setActiveTab,
      resetFilters,
      resetTicketFilters,
      resetMerchFilters,
      resetMatchSalesFilters,
      resetSubscriptionFilters,
      refresh,
      ticketMatchOptions,
      merchMatchOptions,
      matchSalesMatchOptions,
    ],
  );

  const ticketsTabCachedData = useMemo(
    () =>
      dataReady && activeTab === "tickets"
        ? computeTicketsTabDataCached(
            deferredFilters,
            ticketFiltersForStableData,
          )
        : null,
    [dataReady, activeTab, deferredFilters, ticketFiltersForStableData],
  );

  const merchTabCachedData = useMemo(
    () =>
      dataReady && activeTab === "merch"
        ? computeMerchTabDataCached(deferredFilters, merchFiltersForStableData)
        : null,
    [dataReady, activeTab, deferredFilters, merchFiltersForStableData],
  );

  const subscriptionsTabCachedData = useMemo(
    () =>
      dataReady && activeTab === "subscriptions"
        ? computeSubscriptionsTabDataCached(
            deferredFilters,
            subscriptionFiltersForStableData,
          )
        : null,
    [
      dataReady,
      activeTab,
      deferredFilters,
      subscriptionFiltersForStableData,
    ],
  );

  const matchesTabData = useMemo(
    () =>
      dataReady && activeTab === "matches"
        ? computeMatchesTabData(deferredFilters, matchSalesFiltersForData)
        : null,
    [dataReady, activeTab, deferredFilters, matchSalesFiltersForData],
  );

  const effectiveTicketTimeGrouping = getEffectiveTicketTimeGrouping(
    ticketFiltersForData,
  );

  const effectiveMerchTimeGrouping = getEffectiveMerchTimeGrouping(
    merchFiltersForData,
  );

  const dataValue = useMemo(() => {
    if (activeTab === "tickets" && ticketsTabCachedData) {
      return {
        ...ticketsTabCachedData.base,
        ...ticketsTabCachedData.trendsByGrouping[effectiveTicketTimeGrouping],
      };
    }

    if (activeTab === "merch" && merchTabCachedData) {
      return {
        ...merchTabCachedData.base,
        ...merchTabCachedData.trendsByGrouping[effectiveMerchTimeGrouping],
      };
    }

    if (activeTab === "subscriptions" && subscriptionsTabCachedData) {
      return {
        ...subscriptionsTabCachedData.base,
        subscriptionsPlanFactTrend:
          subscriptionsTabCachedData.trendsByGrouping[
            subscriptionFiltersForData.timeGrouping
          ],
      };
    }

    if (activeTab === "matches" && matchesTabData) {
      return matchesTabData;
    }

    return {
      ticketsKpis: EMPTY_TICKETS_KPIS,
      merchKpis: EMPTY_MERCH_KPIS,
      subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
      ticketsMatchCumulativeSeries: [],
      ticketsPlanFactTrend: [],
      ticketsSalesChannelTrend: [],
      ticketsPriceZoneTrend: [],
      subscriptionsPlanFactTrend: [],
      channelMix: [],
      topProducts: [],
      subscriptionTariffStats: [],
      matchSales: [],
      combinedMatchSales: [],
      matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
      matchRevenueChart: [],
      ticketTypeSales: [],
      priceZoneSales: [],
      orderSourceSales: [],
      merchMatchSales: [],
      merchSalesChannelRevenue: [],
      merchSalesChannelTrend: [],
      merchSalesSegmentTrend: [],
      merchProductCategoryRevenue: [],
      merchProductCategoryTrend: [],
      merchSkuSales: [],
    };
  }, [
    activeTab,
    ticketsTabCachedData,
    effectiveTicketTimeGrouping,
    merchTabCachedData,
    effectiveMerchTimeGrouping,
    subscriptionsTabCachedData,
    subscriptionFiltersForData.timeGrouping,
    matchesTabData,
  ]);

  return (
    <FilterStateContext.Provider value={stateValue}>
      <FilterDataContext.Provider value={dataValue}>
        {!dataReady ? (
          dataError ? (
            <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
              <p className="text-sm text-red-600">{dataError}</p>
            </div>
          ) : (
            <DashboardLoading />
          )
        ) : (
          children
        )}
      </FilterDataContext.Provider>
    </FilterStateContext.Provider>
  );
}

export function useFilterState() {
  const ctx = useContext(FilterStateContext);
  if (!ctx) {
    throw new Error("useFilterState must be used within FilterProvider");
  }
  return ctx;
}

export function useFilterData() {
  const ctx = useContext(FilterDataContext);
  if (!ctx) {
    throw new Error("useFilterData must be used within FilterProvider");
  }
  return ctx;
}

export function useFilters(): FilterContextValue {
  return { ...useFilterState(), ...useFilterData() };
}

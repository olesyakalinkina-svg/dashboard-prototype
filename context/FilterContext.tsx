"use client";

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
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
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import { DEFAULT_MATCH_SALES_FILTERS } from "@/lib/match-sales-filter-options";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
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
  TopProductPoint,
} from "@/types/dashboard";

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

function computeFilterData(
  filters: DashboardFilters,
  ticketFiltersForData: TicketFilters,
  merchFiltersForData: MerchFilters,
  matchSalesFiltersForData: MatchSalesFilters,
  subscriptionFilters: SubscriptionFilters,
  activeTab: DashboardTab,
): FilterDataContextValue {
  return runWithFilterCache(() => {
    if (activeTab === "tickets") {
      return {
        ticketsKpis: computeTicketsKpis(filters, ticketFiltersForData),
        merchKpis: EMPTY_MERCH_KPIS,
        subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
        ticketsMatchCumulativeSeries: computeTicketsMatchCumulativeSeries(
          filters,
          ticketFiltersForData,
        ),
        ticketsPlanFactTrend: computeTicketsPlanFactTrend(
          filters,
          ticketFiltersForData,
        ),
        ticketsSalesChannelTrend: computeTicketsSalesChannelTrend(
          filters,
          ticketFiltersForData,
        ),
        ticketsPriceZoneTrend: computeTicketsPriceZoneTrend(
          filters,
          ticketFiltersForData,
        ),
        subscriptionsPlanFactTrend: [],
        channelMix: [],
        topProducts: [],
        subscriptionTariffStats: [],
        matchSales: computeMatchSalesTable(filters, ticketFiltersForData),
        combinedMatchSales: [],
        matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
        matchRevenueChart: [],
        ticketTypeSales: computeTicketTypeSales(filters, ticketFiltersForData),
        priceZoneSales: computePriceZoneSales(filters, ticketFiltersForData),
        orderSourceSales: computeOrderSourceSales(filters, ticketFiltersForData),
        merchMatchSales: [],
        merchSalesChannelRevenue: [],
        merchSalesChannelTrend: [],
        merchSalesSegmentTrend: [],
        merchProductCategoryRevenue: [],
        merchProductCategoryTrend: [],
        merchSkuSales: [],
      };
    }

    if (activeTab === "merch") {
      return {
        ticketsKpis: EMPTY_TICKETS_KPIS,
        merchKpis: computeMerchKpis(filters, merchFiltersForData),
        subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
        ticketsMatchCumulativeSeries: [],
        ticketsPlanFactTrend: [],
        ticketsSalesChannelTrend: [],
        ticketsPriceZoneTrend: [],
        subscriptionsPlanFactTrend: [],
        channelMix: [],
        topProducts: computeTopProducts(filters, merchFiltersForData),
        subscriptionTariffStats: [],
        matchSales: [],
        combinedMatchSales: [],
        matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
        matchRevenueChart: [],
        ticketTypeSales: [],
        priceZoneSales: [],
        orderSourceSales: [],
        merchMatchSales: computeMerchMatchSalesTable(filters, merchFiltersForData),
        merchSalesChannelRevenue: computeMerchSalesChannelRevenue(
          filters,
          merchFiltersForData,
        ),
        merchSalesChannelTrend: computeMerchSalesChannelTrend(
          filters,
          merchFiltersForData,
        ),
        merchSalesSegmentTrend: computeMerchSalesSegmentTrend(
          filters,
          merchFiltersForData,
        ),
        merchProductCategoryRevenue: computeMerchProductCategoryRevenue(
          filters,
          merchFiltersForData,
        ),
        merchProductCategoryTrend: computeMerchProductCategoryTrend(
          filters,
          merchFiltersForData,
        ),
        merchSkuSales: computeMerchSkuSalesTable(filters, merchFiltersForData),
      };
    }

    if (activeTab === "matches") {
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
      };
    }

    return {
      ticketsKpis: EMPTY_TICKETS_KPIS,
      merchKpis: EMPTY_MERCH_KPIS,
      subscriptionsKpis: computeSubscriptionsKpis(filters, subscriptionFilters),
      ticketsMatchCumulativeSeries: [],
      ticketsPlanFactTrend: [],
      ticketsSalesChannelTrend: [],
      ticketsPriceZoneTrend: [],
      subscriptionsPlanFactTrend: computeSubscriptionsPlanFactTrend(
        filters,
        subscriptionFilters,
      ),
      channelMix: computeChannelMix(filters, "subscriptions", subscriptionFilters),
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
    };
  });
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

  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  const setDateRange = useCallback((dateRange: DateRangePreset) => {
    startTransition(() => {
      setFilters((prev) => ({ ...prev, dateRange }));
    });
  }, []);

  const setMatchId = useCallback((matchId: string | "all") => {
    startTransition(() => {
      setFilters((prev) => ({ ...prev, matchId }));
    });
  }, []);

  const setTicketFilters = useCallback((patch: Partial<TicketFilters>) => {
    startTransition(() => {
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
    });
  }, []);

  const setMerchFilters = useCallback((patch: Partial<MerchFilters>) => {
    startTransition(() => {
      setMerchFiltersState((prev) => ({ ...prev, ...patch }));
    });
  }, []);

  const setMatchSalesFilters = useCallback((patch: Partial<MatchSalesFilters>) => {
    startTransition(() => {
      setMatchSalesFiltersState((prev) => ({ ...prev, ...patch }));
    });
  }, []);

  const setSubscriptionFilters = useCallback((patch: Partial<SubscriptionFilters>) => {
    startTransition(() => {
      setSubscriptionFiltersState((prev) => ({ ...prev, ...patch }));
    });
  }, []);

  const resetFilters = useCallback(() => {
    startTransition(() => {
      setFilters(defaultFilters);
    });
  }, []);

  const resetTicketFilters = useCallback(() => {
    startTransition(() => {
      setFilters(defaultFilters);
      setTicketFiltersState(DEFAULT_TICKET_FILTERS);
    });
  }, []);

  const resetMerchFilters = useCallback(() => {
    startTransition(() => {
      setFilters(defaultFilters);
      setMerchFiltersState(DEFAULT_MERCH_FILTERS);
    });
  }, []);

  const resetMatchSalesFilters = useCallback(() => {
    startTransition(() => {
      setFilters(defaultFilters);
      setMatchSalesFiltersState(DEFAULT_MATCH_SALES_FILTERS);
    });
  }, []);

  const resetSubscriptionFilters = useCallback(() => {
    startTransition(() => {
      setFilters(defaultFilters);
      setSubscriptionFiltersState(DEFAULT_SUBSCRIPTION_FILTERS);
    });
  }, []);

  const setActiveTab = useCallback((tab: DashboardTab) => {
    startTransition(() => {
      setActiveTabState(tab);
    });
  }, []);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  const ticketMatchOptions = useMemo(
    () =>
      buildMatchFilterOptions(
        filterMatchesByTicketFilters({ ...ticketFilters, matchId: [] }),
      ),
    [
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
      buildMatchFilterOptions(
        filterMatchesByMerchFilters({ ...merchFilters, matchId: [] }),
      ),
    [
      merchFilters.season,
      merchFilters.league,
      merchFilters.tournamentStage,
      merchFilters.matchClass,
    ],
  );

  const matchSalesMatchOptions = useMemo(
    () =>
      buildMatchFilterOptions(
        filterMatchesByMatchSalesFilters({ ...matchSalesFilters, matchId: [] }),
      ),
    [
      matchSalesFilters.season,
      matchSalesFilters.league,
      matchSalesFilters.tournamentStage,
      matchSalesFilters.matchClass,
      matchSalesFilters.arena,
      matchSalesFilters.eventCompleted,
    ],
  );

  const deferredTicketMatchIds = useDeferredValue(ticketFilters.matchId);
  const deferredMerchMatchIds = useDeferredValue(merchFilters.matchId);
  const deferredMatchSalesMatchIds = useDeferredValue(matchSalesFilters.matchId);

  const ticketFiltersForData = useMemo(
    () => ({ ...ticketFilters, matchId: deferredTicketMatchIds }),
    [ticketFilters, deferredTicketMatchIds],
  );

  const merchFiltersForData = useMemo(
    () => ({ ...merchFilters, matchId: deferredMerchMatchIds }),
    [merchFilters, deferredMerchMatchIds],
  );

  const matchSalesFiltersForData = useMemo(
    () => ({ ...matchSalesFilters, matchId: deferredMatchSalesMatchIds }),
    [matchSalesFilters, deferredMatchSalesMatchIds],
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

  const dataValue = useMemo(
    () =>
      computeFilterData(
        filters,
        ticketFiltersForData,
        merchFiltersForData,
        matchSalesFiltersForData,
        subscriptionFilters,
        activeTab,
      ),
    [
      filters,
      ticketFiltersForData,
      merchFiltersForData,
      merchFiltersForData.orderDateRange.from,
      merchFiltersForData.orderDateRange.to,
      ticketFiltersForData.transactionDateRange.from,
      ticketFiltersForData.transactionDateRange.to,
      matchSalesFiltersForData,
      matchSalesFiltersForData.purchaseDateRange.from,
      matchSalesFiltersForData.purchaseDateRange.to,
      subscriptionFilters,
      activeTab,
    ],
  );

  return (
    <FilterStateContext.Provider value={stateValue}>
      <FilterDataContext.Provider value={dataValue}>
        {children}
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

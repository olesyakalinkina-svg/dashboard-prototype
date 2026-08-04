"use client";

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { subDays } from "date-fns";
import {
  computeChannelMix,
  computeMatchSalesTable,
  computeMerchMatchSalesTable,
  computeMerchProductCategoryRevenue,
  computeMerchProductCategoryTrend,
  computeMerchSalesChannelRevenue,
  computeMerchSalesChannelTrend,
  computeMerchSkuSalesTable,
  computeMerchTotals,
  computeMatchRevenueForTab,
  computeMerchKpis,
  computeOrderSourceSales,
  computePriceZoneSales,
  computeSectorSales,
  computeSubscriptionTariffStats,
  computeSubscriptionsKpis,
  computeSubscriptionsPlanFactTrend,
  computeTicketTypeSales,
  computeTicketsKpis,
  computeTicketsMatchCumulativeSeries,
  computeTicketsPlanFactTrend,
  computeTicketsTrend,
  computeTopProducts,
  computeWeeklyTrend,
  filterMatchesByMerchFilters,
  filterMatchesByTicketFilters,
  getTabTransactions,
  runWithFilterCache,
  type MerchTotals,
} from "@/lib/filters";
import {
  buildMatchFilterOptions,
  DEFAULT_TICKET_FILTERS,
} from "@/lib/ticket-filter-options";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import { matches, MOCK_TODAY } from "@/lib/mock/hockey";
import type {
  DashboardFilters,
  DashboardTab,
  DateRangePreset,
  MerchFilters,
  MerchKpiData,
  SubscriptionFilters,
  SubscriptionsKpiData,
  TicketFilters,
  TicketsKpiData,
} from "@/types/dashboard";

type FilterContextValue = {
  filters: DashboardFilters;
  ticketFilters: TicketFilters;
  merchFilters: MerchFilters;
  subscriptionFilters: SubscriptionFilters;
  activeTab: DashboardTab;
  lastUpdated: Date;
  setDateRange: (range: DateRangePreset) => void;
  setMatchId: (matchId: string | "all") => void;
  setTicketFilters: (patch: Partial<TicketFilters>) => void;
  setMerchFilters: (patch: Partial<MerchFilters>) => void;
  setSubscriptionFilters: (patch: Partial<SubscriptionFilters>) => void;
  setActiveTab: (tab: DashboardTab) => void;
  resetFilters: () => void;
  resetTicketFilters: () => void;
  resetMerchFilters: () => void;
  resetSubscriptionFilters: () => void;
  refresh: () => void;
  ticketsKpis: ReturnType<typeof computeTicketsKpis>;
  merchKpis: ReturnType<typeof computeMerchKpis>;
  subscriptionsKpis: ReturnType<typeof computeSubscriptionsKpis>;
  weeklyTrend: ReturnType<typeof computeWeeklyTrend>;
  ticketsTrend: ReturnType<typeof computeTicketsTrend>;
  ticketsPlanFactTrend: ReturnType<typeof computeTicketsPlanFactTrend>;
  ticketsMatchCumulativeSeries: ReturnType<typeof computeTicketsMatchCumulativeSeries>;
  subscriptionsPlanFactTrend: ReturnType<typeof computeSubscriptionsPlanFactTrend>;
  matchRevenue: ReturnType<typeof computeMatchRevenueForTab>;
  sectorSales: ReturnType<typeof computeSectorSales>;
  channelMix: ReturnType<typeof computeChannelMix>;
  topProducts: ReturnType<typeof computeTopProducts>;
  subscriptionTariffStats: ReturnType<typeof computeSubscriptionTariffStats>;
  ticketTransactions: ReturnType<typeof getTabTransactions>;
  matchSales: ReturnType<typeof computeMatchSalesTable>;
  ticketTypeSales: ReturnType<typeof computeTicketTypeSales>;
  priceZoneSales: ReturnType<typeof computePriceZoneSales>;
  orderSourceSales: ReturnType<typeof computeOrderSourceSales>;
  merchMatchSales: ReturnType<typeof computeMerchMatchSalesTable>;
  merchSalesChannelRevenue: ReturnType<typeof computeMerchSalesChannelRevenue>;
  merchSalesChannelTrend: ReturnType<typeof computeMerchSalesChannelTrend>;
  merchProductCategoryRevenue: ReturnType<typeof computeMerchProductCategoryRevenue>;
  merchProductCategoryTrend: ReturnType<typeof computeMerchProductCategoryTrend>;
  merchSkuSales: ReturnType<typeof computeMerchSkuSalesTable>;
  merchTotals: ReturnType<typeof computeMerchTotals>;
  merchTransactions: ReturnType<typeof getTabTransactions>;
  availableMatches: typeof matches;
  ticketMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
  merchMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
};

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

const EMPTY_MERCH_TOTALS: MerchTotals = {
  revenue: 0,
  receipts: 0,
  units: 0,
  cost: 0,
  returnsValue: 0,
  grossSales: 0,
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [ticketFilters, setTicketFiltersState] =
    useState<TicketFilters>(DEFAULT_TICKET_FILTERS);
  const [merchFilters, setMerchFiltersState] =
    useState<MerchFilters>(DEFAULT_MERCH_FILTERS);
  const [subscriptionFilters, setSubscriptionFiltersState] =
    useState<SubscriptionFilters>(DEFAULT_SUBSCRIPTION_FILTERS);
  const [activeTab, setActiveTabState] = useState<DashboardTab>("tickets");
  const [lastUpdated, setLastUpdated] = useState(new Date());

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
      setTicketFiltersState((prev) => ({ ...prev, ...patch }));
    });
  }, []);

  const setMerchFilters = useCallback((patch: Partial<MerchFilters>) => {
    startTransition(() => {
      setMerchFiltersState((prev) => ({ ...prev, ...patch }));
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

  const deferredTicketMatchIds = useDeferredValue(ticketFilters.matchId);
  const deferredMerchMatchIds = useDeferredValue(merchFilters.matchId);

  const ticketFiltersForData = useMemo(
    () => ({ ...ticketFilters, matchId: deferredTicketMatchIds }),
    [ticketFilters, deferredTicketMatchIds],
  );

  const merchFiltersForData = useMemo(
    () => ({ ...merchFilters, matchId: deferredMerchMatchIds }),
    [merchFilters, deferredMerchMatchIds],
  );

  const value = useMemo<FilterContextValue>(() => {
    return runWithFilterCache(() => {
      const cutoff = subDays(MOCK_TODAY, filters.dateRange);
      const availableMatches = matches.filter((m) => m.date >= cutoff);
      const shared = {
        filters,
        ticketFilters,
        merchFilters,
        subscriptionFilters,
        activeTab,
        lastUpdated,
        setDateRange,
        setMatchId,
        setTicketFilters,
        setMerchFilters,
        setSubscriptionFilters,
        setActiveTab,
        resetFilters,
        resetTicketFilters,
        resetMerchFilters,
        resetSubscriptionFilters,
        refresh,
        availableMatches,
        ticketMatchOptions,
        merchMatchOptions,
      };

      if (activeTab === "tickets") {
        return {
          ...shared,
          ticketsKpis: computeTicketsKpis(filters, ticketFiltersForData),
          merchKpis: EMPTY_MERCH_KPIS,
          subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
          weeklyTrend: [],
          ticketsTrend: computeTicketsTrend(filters, ticketFiltersForData),
          ticketsPlanFactTrend: computeTicketsPlanFactTrend(filters, ticketFiltersForData),
          ticketsMatchCumulativeSeries: computeTicketsMatchCumulativeSeries(
            filters,
            ticketFiltersForData,
          ),
          subscriptionsPlanFactTrend: [],
          matchRevenue: computeMatchRevenueForTab(filters, "tickets", ticketFiltersForData),
          sectorSales: computeSectorSales(filters, ticketFiltersForData),
          channelMix: computeChannelMix(filters, "tickets", ticketFiltersForData),
          topProducts: [],
          subscriptionTariffStats: [],
          ticketTransactions: getTabTransactions(filters, "tickets", ticketFiltersForData),
          matchSales: computeMatchSalesTable(filters, ticketFiltersForData),
          ticketTypeSales: computeTicketTypeSales(filters, ticketFiltersForData),
          priceZoneSales: computePriceZoneSales(filters, ticketFiltersForData),
          orderSourceSales: computeOrderSourceSales(filters, ticketFiltersForData),
          merchMatchSales: [],
          merchSalesChannelRevenue: [],
          merchSalesChannelTrend: [],
          merchProductCategoryRevenue: [],
          merchProductCategoryTrend: [],
          merchSkuSales: [],
          merchTotals: EMPTY_MERCH_TOTALS,
          merchTransactions: [],
        };
      }

      if (activeTab === "merch") {
        return {
          ...shared,
          ticketsKpis: EMPTY_TICKETS_KPIS,
          merchKpis: computeMerchKpis(filters, merchFiltersForData),
          subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
          weeklyTrend: computeWeeklyTrend(filters, "merch", merchFiltersForData),
          ticketsTrend: [],
          ticketsPlanFactTrend: [],
          ticketsMatchCumulativeSeries: [],
          subscriptionsPlanFactTrend: [],
          matchRevenue: computeMatchRevenueForTab(filters, "merch", merchFiltersForData),
          sectorSales: [],
          channelMix: computeChannelMix(filters, "merch", merchFiltersForData),
          topProducts: computeTopProducts(filters, merchFiltersForData),
          subscriptionTariffStats: [],
          ticketTransactions: [],
          matchSales: [],
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
          merchProductCategoryRevenue: computeMerchProductCategoryRevenue(
            filters,
            merchFiltersForData,
          ),
          merchProductCategoryTrend: computeMerchProductCategoryTrend(
            filters,
            merchFiltersForData,
          ),
          merchSkuSales: computeMerchSkuSalesTable(filters, merchFiltersForData),
          merchTotals: computeMerchTotals(filters, merchFiltersForData),
          merchTransactions: getTabTransactions(filters, "merch", merchFiltersForData),
        };
      }

      return {
        ...shared,
        ticketsKpis: EMPTY_TICKETS_KPIS,
        merchKpis: EMPTY_MERCH_KPIS,
        subscriptionsKpis: computeSubscriptionsKpis(filters, subscriptionFilters),
        weeklyTrend: computeWeeklyTrend(filters, "subscriptions", subscriptionFilters),
        ticketsTrend: [],
        ticketsPlanFactTrend: [],
        ticketsMatchCumulativeSeries: [],
        subscriptionsPlanFactTrend: computeSubscriptionsPlanFactTrend(
          filters,
          subscriptionFilters,
        ),
        matchRevenue: [],
        sectorSales: [],
        channelMix: computeChannelMix(filters, "subscriptions", subscriptionFilters),
        topProducts: [],
        subscriptionTariffStats: computeSubscriptionTariffStats(
          filters,
          subscriptionFilters,
        ),
        ticketTransactions: [],
        matchSales: [],
        ticketTypeSales: [],
        priceZoneSales: [],
        orderSourceSales: [],
        merchMatchSales: [],
        merchSalesChannelRevenue: [],
        merchSalesChannelTrend: [],
        merchProductCategoryRevenue: [],
        merchProductCategoryTrend: [],
        merchSkuSales: [],
        merchTotals: EMPTY_MERCH_TOTALS,
        merchTransactions: [],
      };
    });
  }, [
    filters,
    ticketFilters,
    merchFilters,
    subscriptionFilters,
    ticketFiltersForData,
    merchFiltersForData,
    ticketMatchOptions,
    merchMatchOptions,
    activeTab,
    lastUpdated,
    setDateRange,
    setMatchId,
    setTicketFilters,
    setMerchFilters,
    setSubscriptionFilters,
    resetFilters,
    resetTicketFilters,
    resetMerchFilters,
    resetSubscriptionFilters,
    refresh,
  ]);

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error("useFilters must be used within FilterProvider");
  }
  return ctx;
}

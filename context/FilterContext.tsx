"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { subDays } from "date-fns";
import {
  computeChannelMix,
  computeMatchSalesTable,
  computeMerchMatchSalesTable,
  computeMerchSkuSalesTable,
  computeMatchRevenueForTab,
  computeMerchKpis,
  computeSectorSales,
  computeSubscriptionTariffStats,
  computeSubscriptionsKpis,
  computeSubscriptionsPlanFactTrend,
  computeTicketsKpis,
  computeTicketsPlanFactTrend,
  computeTicketsTrend,
  computeTopProducts,
  computeWeeklyTrend,
  filterMatchesByMerchFilters,
  filterMatchesByTicketFilters,
  getTabTransactions,
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
  SubscriptionFilters,
  TicketFilters,
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
  subscriptionsPlanFactTrend: ReturnType<typeof computeSubscriptionsPlanFactTrend>;
  matchRevenue: ReturnType<typeof computeMatchRevenueForTab>;
  sectorSales: ReturnType<typeof computeSectorSales>;
  channelMix: ReturnType<typeof computeChannelMix>;
  topProducts: ReturnType<typeof computeTopProducts>;
  subscriptionTariffStats: ReturnType<typeof computeSubscriptionTariffStats>;
  ticketTransactions: ReturnType<typeof getTabTransactions>;
  matchSales: ReturnType<typeof computeMatchSalesTable>;
  merchMatchSales: ReturnType<typeof computeMerchMatchSalesTable>;
  merchSkuSales: ReturnType<typeof computeMerchSkuSalesTable>;
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

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [ticketFilters, setTicketFiltersState] =
    useState<TicketFilters>(DEFAULT_TICKET_FILTERS);
  const [merchFilters, setMerchFiltersState] =
    useState<MerchFilters>(DEFAULT_MERCH_FILTERS);
  const [subscriptionFilters, setSubscriptionFiltersState] =
    useState<SubscriptionFilters>(DEFAULT_SUBSCRIPTION_FILTERS);
  const [activeTab, setActiveTab] = useState<DashboardTab>("tickets");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const setDateRange = useCallback((dateRange: DateRangePreset) => {
    setFilters((prev) => ({ ...prev, dateRange }));
  }, []);

  const setMatchId = useCallback((matchId: string | "all") => {
    setFilters((prev) => ({ ...prev, matchId }));
  }, []);

  const setTicketFilters = useCallback((patch: Partial<TicketFilters>) => {
    setTicketFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setMerchFilters = useCallback((patch: Partial<MerchFilters>) => {
    setMerchFiltersState((prev) => ({ ...prev, ...patch }));
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

  const resetSubscriptionFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSubscriptionFiltersState(DEFAULT_SUBSCRIPTION_FILTERS);
  }, []);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  const value = useMemo<FilterContextValue>(() => {
    const cutoff = subDays(MOCK_TODAY, filters.dateRange);
    const availableMatches = matches.filter((m) => m.date >= cutoff);
    const ticketMatchOptions = buildMatchFilterOptions(
      filterMatchesByTicketFilters({ ...ticketFilters, matchId: "all" }),
    );
    const merchMatchOptions = buildMatchFilterOptions(
      filterMatchesByMerchFilters({ ...merchFilters, matchId: "all" }),
    );

    const matchTab = activeTab === "merch" ? "merch" : "tickets";
    const merchTabFilters = activeTab === "merch" ? merchFilters : undefined;
    const ticketsTabFilters = activeTab === "tickets" ? ticketFilters : undefined;
    const subscriptionsTabFilters =
      activeTab === "subscriptions" ? subscriptionFilters : undefined;

    return {
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
      ticketsKpis: computeTicketsKpis(filters, ticketFilters),
      merchKpis: computeMerchKpis(filters, merchFilters),
      subscriptionsKpis: computeSubscriptionsKpis(filters, subscriptionFilters),
      weeklyTrend: computeWeeklyTrend(
        filters,
        activeTab,
        subscriptionsTabFilters ?? merchTabFilters ?? ticketsTabFilters,
      ),
      ticketsTrend: computeTicketsTrend(filters, ticketFilters),
      ticketsPlanFactTrend: computeTicketsPlanFactTrend(filters, ticketFilters),
      subscriptionsPlanFactTrend: computeSubscriptionsPlanFactTrend(
        filters,
        subscriptionFilters,
      ),
      matchRevenue:
        activeTab === "subscriptions"
          ? []
          : computeMatchRevenueForTab(
              filters,
              matchTab,
              merchTabFilters ?? ticketsTabFilters,
            ),
      sectorSales: computeSectorSales(filters, ticketFilters),
      channelMix: computeChannelMix(
        filters,
        activeTab,
        subscriptionsTabFilters ?? merchTabFilters ?? ticketsTabFilters,
      ),
      topProducts: computeTopProducts(filters, merchFilters),
      subscriptionTariffStats: computeSubscriptionTariffStats(
        filters,
        subscriptionFilters,
      ),
      ticketTransactions: getTabTransactions(filters, "tickets", ticketFilters),
      matchSales: computeMatchSalesTable(filters, ticketFilters),
      merchMatchSales: computeMerchMatchSalesTable(filters, merchFilters),
      merchSkuSales: computeMerchSkuSalesTable(filters, merchFilters),
      merchTransactions: getTabTransactions(filters, "merch", merchFilters),
      availableMatches,
      ticketMatchOptions,
      merchMatchOptions,
    };
  }, [
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

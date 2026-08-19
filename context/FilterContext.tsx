"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  computeMatchSalesTable,
  computeMerchMatchSalesTable,
  computeMerchPlanFactTrend,
  computeMerchProductCategoryRevenue,
  computeMerchProductCategoryTrend,
  computeMerchSalesChannelRevenue,
  computeMerchSalesChannelTrend,
  computeMerchSkuSalesTable,
  computeMerchKpis,
  computeSubscriptionPriceCategoryShares,
  computeSubscriptionsKpis,
  computeSubscriptionsPlanFactTrend,
  computeTicketsKpis,
  computeTicketsMatchCumulativeSeriesIdle,
  computeTicketsPlanFactTrendIdle,
  computeTicketsSalesChannelTrendIdle,
  computeTopProducts,
  computeMatchRevenueChart,
  computeMatchSalesKpis,
  computeCombinedMatchSalesTable,
  filterMatchesByMatchSalesFilters,
  filterMatchesByMerchFilters,
  filterMatchesByTicketFilters,
  openFilterCacheSession,
  runWithFilterCache,
  warmTicketFilterPassesIdle,
} from "@/lib/filters";
import { yieldToEventLoop, yieldUntilIdle } from "@/lib/idle";
import { beginTicketsUiTurn, noteTicketsCompute } from "@/lib/tickets-compute-trace";
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
import {
  applySubscriptionFilterPatch,
  DEFAULT_SUBSCRIPTION_FILTERS,
} from "@/lib/subscription-filter-options";
import { loadMockData } from "@/lib/mock/data-store";
import { DashboardLoading } from "@/components/layout/DashboardLoading";
import type {
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
  MerchSkuSalesRow,
  PlanFactTrendPoint,
  SubscriptionsPlanFactTrendPoint,
  SubscriptionFilters,
  SubscriptionPriceCategoryPoint,
  SubscriptionsKpiData,
  TicketFilters,
  TicketMatchCumulativeSeries,
  TicketsSalesChannelTrendPoint,
  TicketsKpiData,
  TimeGrouping,
  TopProductPoint,
} from "@/types/dashboard";

const TREND_TIME_GROUPINGS: TimeGrouping[] = ["day", "week", "month"];

type TicketsTrendSlice = {
  ticketsPlanFactTrend: PlanFactTrendPoint[];
  ticketsSalesChannelTrend: TicketsSalesChannelTrendPoint[];
};

type TicketsTabCoreData = {
  ticketsKpis: TicketsKpiData;
  matchSales: MatchSalesRow[];
};

type MerchTrendSlice = {
  merchSalesChannelTrend: MerchSalesChannelTrendPoint[];
  merchPlanFactTrend: PlanFactTrendPoint[];
  merchProductCategoryTrend: MerchProductCategoryTrendPoint[];
};

type MerchTabCachedData = {
  base: Omit<
    FilterDataContextValue,
    | "merchSalesChannelTrend"
    | "merchPlanFactTrend"
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
  displayTab: DashboardTab;
  ticketsKpis: TicketsKpiData;
  merchKpis: MerchKpiData;
  subscriptionsKpis: SubscriptionsKpiData;
  ticketsMatchCumulativeSeries: TicketMatchCumulativeSeries[];
  ticketsPlanFactTrend: PlanFactTrendPoint[];
  ticketsSalesChannelTrend: TicketsSalesChannelTrendPoint[];
  subscriptionsPlanFactTrend: SubscriptionsPlanFactTrendPoint[];
  topProducts: TopProductPoint[];
  subscriptionPriceCategoryShares: SubscriptionPriceCategoryPoint[];
  matchSales: MatchSalesRow[];
  combinedMatchSales: CombinedMatchSalesRow[];
  matchSalesKpis: MatchSalesKpiData;
  matchRevenueChart: MatchRevenuePoint[];
  merchMatchSales: MerchMatchSalesRow[];
  merchSalesChannelRevenue: MerchSalesChannelPoint[];
  merchSalesChannelTrend: MerchSalesChannelTrendPoint[];
  merchPlanFactTrend: PlanFactTrendPoint[];
  merchProductCategoryRevenue: MerchProductCategoryPoint[];
  merchProductCategoryTrend: MerchProductCategoryTrendPoint[];
  merchSkuSales: MerchSkuSalesRow[];
  ticketsChartsPending: boolean;
  ticketsTrendsPending: boolean;
  appliedFilters: DashboardFilters;
  appliedTicketFilters: TicketFilters;
  appliedMerchFilters: MerchFilters;
  appliedSubscriptionFilters: SubscriptionFilters;
  requestTicketsMatchDynamics: () => void;
};

const NOOP_REQUEST_MATCH_DYNAMICS = () => {};

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
  planTicketsSold: 0,
  planFactTicketsSold: 0,
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
  uniqueCustomers: 0,
  uniqueCustomersChange: 0,
  avgCheck: 0,
  avgCheckChange: 0,
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
const TicketsViewResetContext = createContext(0);

function emptyTicketsDataValue(
  appliedTicketFilters: TicketFilters,
): FilterDataContextValue {
  return {
    displayTab: "tickets",
    ticketsKpis: EMPTY_TICKETS_KPIS,
    merchKpis: EMPTY_MERCH_KPIS,
    subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
    ticketsMatchCumulativeSeries: [],
    ticketsPlanFactTrend: [],
    ticketsSalesChannelTrend: [],
    subscriptionsPlanFactTrend: [],
    topProducts: [],
    subscriptionPriceCategoryShares: [],
    matchSales: [],
    combinedMatchSales: [],
    matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
    matchRevenueChart: [],
    merchMatchSales: [],
    merchSalesChannelRevenue: [],
    merchSalesChannelTrend: [],
    merchPlanFactTrend: [],
    merchProductCategoryRevenue: [],
    merchProductCategoryTrend: [],
    merchSkuSales: [],
    ticketsChartsPending: true,
    ticketsTrendsPending: true,
    appliedFilters: defaultFilters,
    appliedTicketFilters,
    appliedMerchFilters: DEFAULT_MERCH_FILTERS,
    appliedSubscriptionFilters: DEFAULT_SUBSCRIPTION_FILTERS,
    requestTicketsMatchDynamics: NOOP_REQUEST_MATCH_DYNAMICS,
  };
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
        merchPlanFactTrend: computeMerchPlanFactTrend(
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
        displayTab: "merch" as const,
        ticketsKpis: EMPTY_TICKETS_KPIS,
        merchKpis: computeMerchKpis(filters, merchFilters),
        subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
        ticketsMatchCumulativeSeries: [],
        ticketsPlanFactTrend: [],
        ticketsSalesChannelTrend: [],
        subscriptionsPlanFactTrend: [],
        topProducts: computeTopProducts(filters, merchFilters),
        subscriptionPriceCategoryShares: [],
        matchSales: [],
        combinedMatchSales: [],
        matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
        matchRevenueChart: [],
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
        ticketsChartsPending: false,
        ticketsTrendsPending: false,
        appliedFilters: filters,
        appliedTicketFilters: DEFAULT_TICKET_FILTERS,
        appliedMerchFilters: merchFilters,
        appliedSubscriptionFilters: DEFAULT_SUBSCRIPTION_FILTERS,
        requestTicketsMatchDynamics: NOOP_REQUEST_MATCH_DYNAMICS,
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
        displayTab: "subscriptions" as const,
        ticketsKpis: EMPTY_TICKETS_KPIS,
        merchKpis: EMPTY_MERCH_KPIS,
        subscriptionsKpis: computeSubscriptionsKpis(filters, subscriptionFilters),
        ticketsMatchCumulativeSeries: [],
        ticketsPlanFactTrend: [],
        ticketsSalesChannelTrend: [],
        topProducts: [],
        subscriptionPriceCategoryShares: computeSubscriptionPriceCategoryShares(
          filters,
          subscriptionFilters,
        ),
        matchSales: [],
        combinedMatchSales: [],
        matchSalesKpis: EMPTY_MATCH_SALES_KPIS,
        matchRevenueChart: [],
        merchMatchSales: [],
        merchSalesChannelRevenue: [],
        merchSalesChannelTrend: [],
        merchPlanFactTrend: [],
        merchProductCategoryRevenue: [],
        merchProductCategoryTrend: [],
        merchSkuSales: [],
        ticketsChartsPending: false,
        ticketsTrendsPending: false,
        appliedFilters: filters,
        appliedTicketFilters: DEFAULT_TICKET_FILTERS,
        appliedMerchFilters: DEFAULT_MERCH_FILTERS,
        appliedSubscriptionFilters: subscriptionFilters,
        requestTicketsMatchDynamics: NOOP_REQUEST_MATCH_DYNAMICS,
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
    displayTab: "matches" as const,
    ticketsKpis: EMPTY_TICKETS_KPIS,
    merchKpis: EMPTY_MERCH_KPIS,
    subscriptionsKpis: EMPTY_SUBSCRIPTIONS_KPIS,
    ticketsMatchCumulativeSeries: [],
    ticketsPlanFactTrend: [],
    ticketsSalesChannelTrend: [],
    subscriptionsPlanFactTrend: [],
    topProducts: [],
    subscriptionPriceCategoryShares: [],
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
    merchMatchSales: [],
    merchSalesChannelRevenue: [],
    merchSalesChannelTrend: [],
    merchPlanFactTrend: [],
    merchProductCategoryRevenue: [],
    merchProductCategoryTrend: [],
    merchSkuSales: [],
    ticketsChartsPending: false,
    ticketsTrendsPending: false,
    appliedFilters: filters,
    appliedTicketFilters: DEFAULT_TICKET_FILTERS,
    appliedMerchFilters: DEFAULT_MERCH_FILTERS,
    appliedSubscriptionFilters: DEFAULT_SUBSCRIPTION_FILTERS,
    requestTicketsMatchDynamics: NOOP_REQUEST_MATCH_DYNAMICS,
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
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [ticketsViewResetEpoch, setTicketsViewResetEpoch] = useState(0);

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
    beginTicketsUiTurn();
    setTicketFiltersState((prev) => {
      const next = { ...prev, ...patch };
      const effectiveTimeGrouping = getEffectiveTicketTimeGrouping(next);
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
    setSubscriptionFiltersState((prev) =>
      applySubscriptionFilterPatch(prev, patch),
    );
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const resetTicketFilters = useCallback(() => {
    beginTicketsUiTurn();
    setFilters(defaultFilters);
    setTicketFiltersState(DEFAULT_TICKET_FILTERS);
    setTicketsViewResetEpoch((epoch) => epoch + 1);
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

  return (
    <FilterStateContext.Provider value={stateValue}>
      <TicketsViewResetContext.Provider value={ticketsViewResetEpoch}>
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
      </TicketsViewResetContext.Provider>
    </FilterStateContext.Provider>
  );
}

function ticketsPayload(
  core: TicketsTabCoreData,
  ticketFilters: TicketFilters,
  filters: DashboardFilters,
  extras: Partial<FilterDataContextValue> = {},
): FilterDataContextValue {
  return {
    ...emptyTicketsDataValue(ticketFilters),
    displayTab: "tickets",
    ticketsKpis: core.ticketsKpis,
    matchSales: core.matchSales,
    appliedFilters: filters,
    appliedTicketFilters: ticketFilters,
    ticketsChartsPending: true,
    ticketsTrendsPending: true,
    ...extras,
  };
}

export function FilterDataRuntime({ children }: { children: ReactNode }) {
  const requestTicketsMatchDynamicsRef = useRef(NOOP_REQUEST_MATCH_DYNAMICS);
  const requestTicketsMatchDynamics = useCallback(() => {
    requestTicketsMatchDynamicsRef.current();
  }, []);
  const [dataValue, setDataValue] = useState<FilterDataContextValue>(() => ({
    ...emptyTicketsDataValue(DEFAULT_TICKET_FILTERS),
    requestTicketsMatchDynamics,
  }));

  const publish = useCallback(
    (value: FilterDataContextValue) => {
      setDataValue({ ...value, requestTicketsMatchDynamics });
    },
    [requestTicketsMatchDynamics],
  );

  return (
    <>
      <TabCompute
        publish={publish}
        requestTicketsMatchDynamicsRef={requestTicketsMatchDynamicsRef}
      />
      <FilterDataContext.Provider value={dataValue}>
        {children}
      </FilterDataContext.Provider>
    </>
  );
}

function TabCompute({
  publish,
  requestTicketsMatchDynamicsRef,
}: {
  publish: (value: FilterDataContextValue) => void;
  requestTicketsMatchDynamicsRef: { current: () => void };
}) {
  const {
    filters,
    ticketFilters,
    merchFilters,
    matchSalesFilters,
    subscriptionFilters,
    activeTab,
  } = useFilterState();
  requestTicketsMatchDynamicsRef.current = NOOP_REQUEST_MATCH_DYNAMICS;

  const ticketsTabCacheRef = useRef<{
    filters: DashboardFilters;
    tabFilters: TicketFilters;
    value: TicketsTabCoreData;
  } | null>(null);
  const ticketsSeriesCacheRef = useRef<{
    filters: DashboardFilters;
    tabFilters: TicketFilters;
    value: TicketMatchCumulativeSeries[];
  } | null>(null);
  const ticketsTrendsCacheRef = useRef<{
    filters: DashboardFilters;
    tabFilters: TicketFilters;
    grouping: TimeGrouping;
    value: TicketsTrendSlice;
  } | null>(null);
  const merchTabCacheRef = useRef<{
    filters: DashboardFilters;
    tabFilters: MerchFilters;
    value: MerchTabCachedData;
  } | null>(null);
  const subscriptionsTabCacheRef = useRef<{
    filters: DashboardFilters;
    tabFilters: SubscriptionFilters;
    value: SubscriptionsTabCachedData;
  } | null>(null);
  const matchesTabCacheRef = useRef<{
    filters: DashboardFilters;
    tabFilters: MatchSalesFilters;
    value: FilterDataContextValue;
  } | null>(null);
  const lastTicketsPayloadRef = useRef<FilterDataContextValue | null>(null);
  const ticketsSessionRef = useRef<ReturnType<
    typeof openFilterCacheSession
  > | null>(null);

  function getTicketsSession() {
    if (!ticketsSessionRef.current) {
      ticketsSessionRef.current = openFilterCacheSession();
    }
    return ticketsSessionRef.current;
  }

  const ticketFiltersForStableData = useMemo(
    () => ({
      ...ticketFilters,
      matchId: ticketFilters.matchId,
      transactionDateRange: { ...ticketFilters.transactionDateRange },
    }),
    [
      ticketFilters.season,
      ticketFilters.league,
      ticketFilters.tournamentStage,
      ticketFilters.matchClass,
      ticketFilters.arena,
      ticketFilters.eventCompleted,
      ticketFilters.matchId,
      ticketFilters.ticketType,
      ticketFilters.priceZone,
      ticketFilters.orderSource,
      ticketFilters.transactionDateRange.from,
      ticketFilters.transactionDateRange.to,
    ],
  );

  const liveTicketTimeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);

  const merchFiltersForStableData = useMemo(
    () => ({
      ...merchFilters,
      matchId: merchFilters.matchId,
      salesChannels: merchFilters.salesChannels,
      productCategories: merchFilters.productCategories,
      orderDateRange: { ...merchFilters.orderDateRange },
    }),
    [
      merchFilters.season,
      merchFilters.league,
      merchFilters.tournamentStage,
      merchFilters.matchClass,
      merchFilters.matchId,
      merchFilters.salesChannels,
      merchFilters.productCategories,
      merchFilters.orderDateRange.from,
      merchFilters.orderDateRange.to,
    ],
  );

  const merchFiltersForData = useMemo(
    () => ({
      ...merchFiltersForStableData,
      timeGrouping: merchFilters.timeGrouping,
    }),
    [merchFiltersForStableData, merchFilters.timeGrouping],
  );

  const subscriptionFiltersForStableData = useMemo(
    () => ({ ...subscriptionFilters }),
    [
      subscriptionFilters.season,
      subscriptionFilters.league,
      subscriptionFilters.tournamentStage,
      subscriptionFilters.arena,
      subscriptionFilters.priceCategory,
    ],
  );

  const subscriptionFiltersForData = useMemo(
    () => ({
      ...subscriptionFiltersForStableData,
      timeGrouping: subscriptionFilters.timeGrouping,
    }),
    [subscriptionFiltersForStableData, subscriptionFilters.timeGrouping],
  );

  const matchSalesFiltersForData = useMemo(
    () => ({
      ...matchSalesFilters,
      matchId: matchSalesFilters.matchId,
      purchaseDateRange: { ...matchSalesFilters.purchaseDateRange },
    }),
    [
      matchSalesFilters.season,
      matchSalesFilters.league,
      matchSalesFilters.tournamentStage,
      matchSalesFilters.matchClass,
      matchSalesFilters.arena,
      matchSalesFilters.eventCompleted,
      matchSalesFilters.matchId,
      matchSalesFilters.purchaseDateRange.from,
      matchSalesFilters.purchaseDateRange.to,
    ],
  );

  useEffect(() => {
    if (activeTab !== "tickets") return;

    let cancelled = false;
    const requestFilters = filters;
    const requestTicketFilters = ticketFiltersForStableData;
    const grouping = liveTicketTimeGrouping;
    // Stable filters omit timeGrouping (KPI/table/series cache). Overlay it
    // so appliedTicketFilters matches the grouping shown on ticket charts.
    const appliedTicketFilters = {
      ...requestTicketFilters,
      timeGrouping: grouping,
    };
    const delay = lastTicketsPayloadRef.current ? 500 : 0;

    const timer = window.setTimeout(() => {
      void (async () => {
        await yieldToEventLoop();
        if (cancelled) return;

        const coreHit =
          ticketsTabCacheRef.current?.filters === requestFilters &&
          ticketsTabCacheRef.current.tabFilters === requestTicketFilters;
        const trendsHit =
          ticketsTrendsCacheRef.current?.filters === requestFilters &&
          ticketsTrendsCacheRef.current.tabFilters === requestTicketFilters &&
          ticketsTrendsCacheRef.current.grouping === grouping;
        const seriesHit =
          ticketsSeriesCacheRef.current?.filters === requestFilters &&
          ticketsSeriesCacheRef.current.tabFilters === requestTicketFilters;

        if (coreHit && trendsHit && seriesHit) {
          const core = ticketsTabCacheRef.current?.value;
          const trends = ticketsTrendsCacheRef.current?.value;
          const series = ticketsSeriesCacheRef.current?.value;
          if (!core || !trends || !series) return;
          const payload = ticketsPayload(
            core,
            appliedTicketFilters,
            requestFilters,
            {
              ...trends,
              ticketsMatchCumulativeSeries: series,
              ticketsTrendsPending: false,
              ticketsChartsPending: false,
            },
          );
          lastTicketsPayloadRef.current = payload;
          publish(payload);
          return;
        }

        const session = getTicketsSession();
        try {
          let core = coreHit ? ticketsTabCacheRef.current?.value : undefined;
          if (!core) {
            const warmDone = noteTicketsCompute("tickets-warm-filter-passes");
            const warmed = await session.runAsync(() =>
              warmTicketFilterPassesIdle(
                requestFilters,
                requestTicketFilters,
                () => cancelled,
              ),
            );
            warmDone();
            if (cancelled || !warmed) return;

            const kpisDone = noteTicketsCompute("computeTicketsKpis");
            const ticketsKpis = session.run(() =>
              computeTicketsKpis(requestFilters, requestTicketFilters),
            );
            kpisDone();
            await yieldToEventLoop();
            if (cancelled) return;

            const tableDone = noteTicketsCompute("computeMatchSalesTable");
            const matchSales = session.run(() =>
              computeMatchSalesTable(requestFilters, requestTicketFilters),
            );
            tableDone();
            if (cancelled) return;

            core = { ticketsKpis, matchSales };
            ticketsTabCacheRef.current = {
              filters: requestFilters,
              tabFilters: requestTicketFilters,
              value: core,
            };
          }

          const corePayload = ticketsPayload(
            core,
            appliedTicketFilters,
            requestFilters,
            {
              ticketsMatchCumulativeSeries:
                lastTicketsPayloadRef.current?.ticketsMatchCumulativeSeries ??
                [],
              ticketsChartsPending: !seriesHit,
              ticketsTrendsPending: !trendsHit,
              ...(trendsHit ? ticketsTrendsCacheRef.current?.value : null),
            },
          );
          lastTicketsPayloadRef.current = corePayload;
          publish(corePayload);

          await yieldToEventLoop();
          if (cancelled) return;

          let series = seriesHit
            ? ticketsSeriesCacheRef.current?.value
            : undefined;
          if (!series) {
            const seriesDone = noteTicketsCompute(
              "computeTicketsMatchCumulativeSeries",
            );
            await yieldUntilIdle(1200);
            if (cancelled) return;
            const computedSeries = await session.runAsync(() =>
              computeTicketsMatchCumulativeSeriesIdle(
                requestFilters,
                requestTicketFilters,
                () => cancelled,
              ),
            );
            seriesDone();
            if (cancelled || computedSeries == null) return;
            series = computedSeries;
            ticketsSeriesCacheRef.current = {
              filters: requestFilters,
              tabFilters: requestTicketFilters,
              value: series,
            };
          }

          const withSeries = {
            ...(lastTicketsPayloadRef.current ?? corePayload),
            ticketsMatchCumulativeSeries: series,
            ticketsChartsPending: false,
          };
          lastTicketsPayloadRef.current = withSeries;
          publish(withSeries);

          if (trendsHit) return;

          await yieldToEventLoop();
          if (cancelled) return;

          const groupingDone = noteTicketsCompute(`tickets-trends-${grouping}`);
          const withGrouping = {
            ...requestTicketFilters,
            timeGrouping: grouping,
          };
          const ticketsPlanFactTrend = await session.runAsync(() =>
            computeTicketsPlanFactTrendIdle(
              requestFilters,
              withGrouping,
              () => cancelled,
            ),
          );
          if (cancelled || ticketsPlanFactTrend == null) return;
          await yieldToEventLoop();
          if (cancelled) return;
          const ticketsSalesChannelTrend = await session.runAsync(() =>
            computeTicketsSalesChannelTrendIdle(
              requestFilters,
              withGrouping,
              () => cancelled,
            ),
          );
          groupingDone();
          if (cancelled || ticketsSalesChannelTrend == null) return;

          const trendSlice = { ticketsPlanFactTrend, ticketsSalesChannelTrend };
          ticketsTrendsCacheRef.current = {
            filters: requestFilters,
            tabFilters: requestTicketFilters,
            grouping,
            value: trendSlice,
          };

          const withTrends = ticketsPayload(
            core,
            appliedTicketFilters,
            requestFilters,
            {
              ...trendSlice,
              ticketsMatchCumulativeSeries: series,
              ticketsTrendsPending: false,
              ticketsChartsPending: false,
            },
          );
          lastTicketsPayloadRef.current = withTrends;
          publish(withTrends);
        } catch (error) {
          console.error("[tickets] core compute failed", error);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    activeTab,
    filters,
    ticketFiltersForStableData,
    liveTicketTimeGrouping,
    publish,
  ]);

  useEffect(() => {
    if (activeTab !== "merch") return;
    const prev = merchTabCacheRef.current;
    const cached =
      prev &&
      prev.filters === filters &&
      prev.tabFilters === merchFiltersForStableData
        ? prev.value
        : null;
    const value =
      cached ?? computeMerchTabDataCached(filters, merchFiltersForStableData);
    if (!cached) {
      merchTabCacheRef.current = {
        filters,
        tabFilters: merchFiltersForStableData,
        value,
      };
    }
    const grouping = getEffectiveMerchTimeGrouping(merchFiltersForData);
    publish({
      ...value.base,
      ...value.trendsByGrouping[grouping],
    });
  }, [
    activeTab,
    filters,
    merchFiltersForStableData,
    merchFiltersForData,
    publish,
  ]);

  useEffect(() => {
    if (activeTab !== "subscriptions") return;
    const prev = subscriptionsTabCacheRef.current;
    const cached =
      prev &&
      prev.filters === filters &&
      prev.tabFilters === subscriptionFiltersForStableData
        ? prev.value
        : null;
    const value =
      cached ??
      computeSubscriptionsTabDataCached(
        filters,
        subscriptionFiltersForStableData,
      );
    if (!cached) {
      subscriptionsTabCacheRef.current = {
        filters,
        tabFilters: subscriptionFiltersForStableData,
        value,
      };
    }
    publish({
      ...value.base,
      subscriptionsPlanFactTrend:
        value.trendsByGrouping[subscriptionFiltersForData.timeGrouping],
    });
  }, [
    activeTab,
    filters,
    subscriptionFiltersForStableData,
    subscriptionFiltersForData.timeGrouping,
    publish,
  ]);

  useEffect(() => {
    if (activeTab !== "matches") return;
    const prev = matchesTabCacheRef.current;
    const cached =
      prev &&
      prev.filters === filters &&
      prev.tabFilters === matchSalesFiltersForData
        ? prev.value
        : null;
    const value =
      cached ?? computeMatchesTabData(filters, matchSalesFiltersForData);
    if (!cached) {
      matchesTabCacheRef.current = {
        filters,
        tabFilters: matchSalesFiltersForData,
        value,
      };
    }
    publish(value);
  }, [activeTab, filters, matchSalesFiltersForData, publish]);

  return null;
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

export function useTicketsViewResetEpoch(): number {
  return useContext(TicketsViewResetContext);
}

export function useFilters(): FilterContextValue {
  return { ...useFilterState(), ...useFilterData() };
}

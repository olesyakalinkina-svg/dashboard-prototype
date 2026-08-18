import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  DEFAULT_MERCH_FILTERS,
  MERCH_PRODUCT_CATEGORY_LABELS,
} from "@/lib/merch-filter-options";
import { DEFAULT_MATCH_SALES_FILTERS } from "@/lib/match-sales-filter-options";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import {
  ARENA_OPTIONS,
  DEFAULT_TICKET_FILTERS,
  EVENT_COMPLETED_OPTIONS,
  LEAGUE_OPTIONS,
  MATCH_CLASS_OPTIONS,
  ORDER_SOURCE_OPTIONS,
  PRICE_ZONE_OPTIONS,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/ticket-filter-options";
import {
  computeCombinedMatchSalesTable,
  computeMatchRevenueChart,
  computeMatchSalesKpis,
  computeMerchKpis,
  computeMerchPlanFactTrend,
  computeMerchProductCategoryRevenue,
  computeMerchSalesChannelRevenue,
  computeSubscriptionsKpis,
  computeSubscriptionsPlanFactTrend,
  computeTicketsKpis,
  computeTicketsMatchCumulativeSeries,
  computeTicketsPlanFactTrend,
  computeTicketsSalesChannelTrend,
  filterMerchTransactions,
  filterSubscriptions,
  filterTicketTransactions,
} from "@/lib/filters";
import type {
  DashboardFilters,
  MatchSalesFilters,
  MerchFilters,
  SubscriptionFilters,
  TicketFilters,
  TimeGrouping,
} from "@/types/dashboard";

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  dateRange: 30,
  stream: "all",
  matchId: "all",
  promotionId: "all",
};

export type FilterCoverageTab = "tickets" | "merch" | "subscriptions" | "matches";

export type FilterCoverageCase = {
  tab: FilterCoverageTab;
  filter: string;
  option: string;
  apply: () => void;
  hasData: () => boolean;
  excluded?: string;
};

export type CriticalComboCase = {
  name: string;
  tab: FilterCoverageTab;
  check: () => boolean;
  excluded?: string;
};

function assertTicketsData(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): boolean {
  const txs = filterTicketTransactions(filters, ticketFilters);
  if (txs.length === 0) return false;

  const matchSeries = computeTicketsMatchCumulativeSeries(
    filters,
    ticketFilters,
  );
  if (matchSeries.length === 0) return false;

  const kpis = computeTicketsKpis(filters, ticketFilters);
  if (kpis.revenue <= 0) return false;

  const channelTrend = computeTicketsSalesChannelTrend(filters, ticketFilters);
  if (channelTrend.length === 0) {
    return false;
  }

  const planFact = computeTicketsPlanFactTrend(filters, ticketFilters);
  return planFact.length > 0;
}

function assertMerchData(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
): boolean {
  const kpis = computeMerchKpis(filters, merchFilters);
  if (kpis.revenue <= 0) return false;

  const channels = computeMerchSalesChannelRevenue(filters, merchFilters);
  const categories = computeMerchProductCategoryRevenue(filters, merchFilters);
  const sales = computeMerchPlanFactTrend(filters, merchFilters);

  return (
    channels.some((row) => row.value > 0) &&
    categories.some((row) => row.value > 0) &&
    sales.some((point) => point.factRevenue > 0 && point.planRevenue > 0)
  );
}

function assertSubscriptionsData(
  filters: DashboardFilters,
  subscriptionFilters: SubscriptionFilters,
): boolean {
  const subs = filterSubscriptions(filters, subscriptionFilters);
  if (subs.length === 0) return false;

  const kpis = computeSubscriptionsKpis(filters, subscriptionFilters);
  if (kpis.revenue <= 0 || kpis.sold <= 0) return false;
  if (kpis.uniqueCustomers <= 0 || kpis.avgCheck <= 0) return false;

  const trend = computeSubscriptionsPlanFactTrend(filters, subscriptionFilters);
  return trend.some((point) => point.factRevenue > 0);
}

function assertMatchSalesData(
  filters: DashboardFilters,
  matchSalesFilters: MatchSalesFilters,
): boolean {
  const kpis = computeMatchSalesKpis(filters, matchSalesFilters);
  if (kpis.totalRevenue <= 0 || kpis.matchCount === 0) return false;

  const table = computeCombinedMatchSalesTable(filters, matchSalesFilters);
  if (!table.some((row) => row.totalRevenue > 0)) return false;

  const chart = computeMatchRevenueChart(filters, matchSalesFilters);
  return chart.length > 0;
}

function ticketCase(
  filter: string,
  option: string,
  ticketFilters: TicketFilters,
): FilterCoverageCase {
  return {
    tab: "tickets",
    filter,
    option,
    apply: () => {},
    hasData: () =>
      assertTicketsData(DEFAULT_DASHBOARD_FILTERS, ticketFilters),
  };
}

function merchCase(
  filter: string,
  option: string,
  merchFilters: MerchFilters,
): FilterCoverageCase {
  return {
    tab: "merch",
    filter,
    option,
    apply: () => {},
    hasData: () => assertMerchData(DEFAULT_DASHBOARD_FILTERS, merchFilters),
  };
}

function subscriptionCase(
  filter: string,
  option: string,
  subscriptionFilters: SubscriptionFilters,
): FilterCoverageCase {
  return {
    tab: "subscriptions",
    filter,
    option,
    apply: () => {},
    hasData: () =>
      assertSubscriptionsData(DEFAULT_DASHBOARD_FILTERS, subscriptionFilters),
  };
}

function matchSalesCase(
  filter: string,
  option: string,
  matchSalesFilters: MatchSalesFilters,
): FilterCoverageCase {
  return {
    tab: "matches",
    filter,
    option,
    apply: () => {},
    hasData: () =>
      assertMatchSalesData(DEFAULT_DASHBOARD_FILTERS, matchSalesFilters),
  };
}

export function buildTicketsFilterCases(): FilterCoverageCase[] {
  const cases: FilterCoverageCase[] = [];

  for (const opt of SEASON_OPTIONS) {
    cases.push(
      ticketCase("season", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        season: opt.value,
      }),
    );
  }

  for (const opt of LEAGUE_OPTIONS) {
    cases.push(
      ticketCase("league", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        league: opt.value,
      }),
    );
  }

  for (const opt of TOURNAMENT_STAGE_OPTIONS) {
    cases.push(
      ticketCase("tournamentStage", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        tournamentStage: opt.value,
      }),
    );
  }

  for (const opt of MATCH_CLASS_OPTIONS) {
    cases.push(
      ticketCase("matchClass", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        matchClass: opt.value,
      }),
    );
  }

  for (const opt of ARENA_OPTIONS) {
    const testCase = ticketCase("arena", opt.label, {
      ...DEFAULT_TICKET_FILTERS,
      arena: opt.value,
    });
    if (opt.value === "secondary" && DEFAULT_TICKET_FILTERS.league === "KHL") {
      testCase.excluded =
        "Secondary arena has no KHL matches in mock data (VHL only)";
    }
    cases.push(testCase);
  }

  for (const opt of EVENT_COMPLETED_OPTIONS) {
    cases.push(
      ticketCase("eventCompleted", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        eventCompleted: opt.value,
      }),
    );
  }

  for (const opt of TICKET_TYPE_OPTIONS) {
    cases.push(
      ticketCase("ticketType", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        ticketType: opt.value,
      }),
    );
  }

  for (const opt of PRICE_ZONE_OPTIONS) {
    cases.push(
      ticketCase("priceZone", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        priceZone: opt.value,
      }),
    );
  }

  for (const opt of ORDER_SOURCE_OPTIONS) {
    cases.push(
      ticketCase("orderSource", opt.label, {
        ...DEFAULT_TICKET_FILTERS,
        orderSource: opt.value,
      }),
    );
  }

  return cases;
}

export function buildMerchFilterCases(): FilterCoverageCase[] {
  const cases: FilterCoverageCase[] = [];

  for (const opt of SEASON_OPTIONS) {
    cases.push(
      merchCase("season", opt.label, {
        ...DEFAULT_MERCH_FILTERS,
        season: opt.value,
      }),
    );
  }

  for (const opt of LEAGUE_OPTIONS) {
    cases.push(
      merchCase("league", opt.label, {
        ...DEFAULT_MERCH_FILTERS,
        league: opt.value,
      }),
    );
  }

  for (const opt of TOURNAMENT_STAGE_OPTIONS) {
    cases.push(
      merchCase("tournamentStage", opt.label, {
        ...DEFAULT_MERCH_FILTERS,
        tournamentStage: opt.value,
      }),
    );
  }

  for (const opt of MATCH_CLASS_OPTIONS) {
    cases.push(
      merchCase("matchClass", opt.label, {
        ...DEFAULT_MERCH_FILTERS,
        matchClass: opt.value,
      }),
    );
  }

  for (const point of ALL_MERCH_SALES_POINTS) {
    cases.push(
      merchCase("salesChannels", point, {
        ...DEFAULT_MERCH_FILTERS,
        salesChannels: [point],
      }),
    );
  }

  for (const cat of ALL_MERCH_PRODUCT_CATEGORIES) {
    cases.push(
      merchCase("productCategory", MERCH_PRODUCT_CATEGORY_LABELS[cat], {
        ...DEFAULT_MERCH_FILTERS,
        productCategories: [cat],
      }),
    );
  }

  cases.push({
    tab: "merch",
    filter: "salesChannels",
    option: "(empty selection)",
    apply: () => {},
    hasData: () => false,
    excluded:
      "Empty multi-select is intentional — no sales channels selected means no data",
  });

  cases.push({
    tab: "merch",
    filter: "productCategory",
    option: "(empty selection)",
    apply: () => {},
    hasData: () => false,
    excluded:
      "Empty multi-select is intentional — no product categories selected means no data",
  });

  return cases;
}

export function buildSubscriptionsFilterCases(): FilterCoverageCase[] {
  const cases: FilterCoverageCase[] = [];

  for (const opt of SEASON_OPTIONS) {
    cases.push(
      subscriptionCase("season", opt.label, {
        ...DEFAULT_SUBSCRIPTION_FILTERS,
        season: opt.value,
      }),
    );
  }

  for (const opt of LEAGUE_OPTIONS) {
    cases.push(
      subscriptionCase("league", opt.label, {
        ...DEFAULT_SUBSCRIPTION_FILTERS,
        league: opt.value,
      }),
    );
  }

  for (const opt of TOURNAMENT_STAGE_OPTIONS) {
    cases.push(
      subscriptionCase("tournamentStage", opt.label, {
        ...DEFAULT_SUBSCRIPTION_FILTERS,
        tournamentStage: opt.value,
      }),
    );
  }

  for (const opt of ARENA_OPTIONS) {
    const testCase = subscriptionCase("arena", opt.label, {
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      arena: opt.value,
    });
    if (
      opt.value === "secondary" &&
      DEFAULT_SUBSCRIPTION_FILTERS.league === "KHL"
    ) {
      testCase.excluded =
        "Secondary arena has no KHL subscriptions in mock data (VHL only)";
    }
    cases.push(testCase);
  }

  for (const opt of TICKET_TYPE_OPTIONS) {
    cases.push(
      subscriptionCase("ticketType", opt.label, {
        ...DEFAULT_SUBSCRIPTION_FILTERS,
        ticketType: opt.value,
      }),
    );
  }

  return cases;
}

export function buildMatchSalesFilterCases(): FilterCoverageCase[] {
  const cases: FilterCoverageCase[] = [];

  for (const opt of SEASON_OPTIONS) {
    cases.push(
      matchSalesCase("season", opt.label, {
        ...DEFAULT_MATCH_SALES_FILTERS,
        season: opt.value,
      }),
    );
  }

  for (const opt of LEAGUE_OPTIONS) {
    cases.push(
      matchSalesCase("league", opt.label, {
        ...DEFAULT_MATCH_SALES_FILTERS,
        league: opt.value,
      }),
    );
  }

  for (const opt of TOURNAMENT_STAGE_OPTIONS) {
    cases.push(
      matchSalesCase("tournamentStage", opt.label, {
        ...DEFAULT_MATCH_SALES_FILTERS,
        tournamentStage: opt.value,
      }),
    );
  }

  for (const opt of MATCH_CLASS_OPTIONS) {
    cases.push(
      matchSalesCase("matchClass", opt.label, {
        ...DEFAULT_MATCH_SALES_FILTERS,
        matchClass: opt.value,
      }),
    );
  }

  for (const opt of ARENA_OPTIONS) {
    const testCase = matchSalesCase("arena", opt.label, {
      ...DEFAULT_MATCH_SALES_FILTERS,
      arena: opt.value,
    });
    if (
      opt.value === "secondary" &&
      DEFAULT_MATCH_SALES_FILTERS.league === "KHL"
    ) {
      testCase.excluded =
        "Secondary arena has no KHL matches in mock data (VHL only)";
    }
    cases.push(testCase);
  }

  for (const opt of EVENT_COMPLETED_OPTIONS) {
    cases.push(
      matchSalesCase("eventCompleted", opt.label, {
        ...DEFAULT_MATCH_SALES_FILTERS,
        eventCompleted: opt.value,
      }),
    );
  }

  return cases;
}

export type TimeGroupingCase = {
  tab: "tickets" | "merch" | "subscriptions";
  grouping: TimeGrouping;
  label: string;
  hasData: () => boolean;
};

export function buildTimeGroupingCases(): TimeGroupingCase[] {
  return [
    ...TREND_TIME_GROUPING_OPTIONS.map((opt) => ({
      tab: "tickets" as const,
      grouping: opt.value,
      label: opt.label,
      hasData: () => {
        const filters: TicketFilters = {
          ...DEFAULT_TICKET_FILTERS,
          timeGrouping: opt.value,
        };
        const trend = computeTicketsPlanFactTrend(
          DEFAULT_DASHBOARD_FILTERS,
          filters,
        );
        return trend.some((point) => point.factRevenue > 0);
      },
    })),
    ...TREND_TIME_GROUPING_OPTIONS.map((opt) => ({
      tab: "merch" as const,
      grouping: opt.value,
      label: opt.label,
      hasData: () => {
        const filters: MerchFilters = {
          ...DEFAULT_MERCH_FILTERS,
          timeGrouping: opt.value,
        };
        const trend = computeMerchPlanFactTrend(DEFAULT_DASHBOARD_FILTERS, filters);
        return trend.some(
          (point) => point.factRevenue > 0 && point.planRevenue > 0,
        );
      },
    })),
    ...TREND_TIME_GROUPING_OPTIONS.map((opt) => ({
      tab: "subscriptions" as const,
      grouping: opt.value,
      label: opt.label,
      hasData: () => {
        const filters: SubscriptionFilters = {
          ...DEFAULT_SUBSCRIPTION_FILTERS,
          timeGrouping: opt.value,
        };
        const trend = computeSubscriptionsPlanFactTrend(
          DEFAULT_DASHBOARD_FILTERS,
          filters,
        );
        return trend.some((point) => point.factRevenue > 0);
      },
    })),
  ];
}

export function buildCriticalComboCases(): CriticalComboCase[] {
  return [
    {
      name: "Tickets: KHL + playoff + class_1",
      tab: "tickets",
      check: () =>
        filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_TICKET_FILTERS,
          league: "KHL",
          tournamentStage: "playoff",
          matchClass: "playoff",
        }).length > 0,
    },
    {
      name: "Tickets: VHL + secondary arena",
      tab: "tickets",
      check: () =>
        filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_TICKET_FILTERS,
          league: "VHL",
          arena: "secondary",
        }).length > 0,
    },
    {
      name: "Tickets: 2024/25 + upcoming matches",
      tab: "tickets",
      check: () =>
        filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_TICKET_FILTERS,
          season: "2024/25",
          eventCompleted: "no",
        }).length > 0,
      excluded:
        "Past season 2024/25 has no upcoming matches at mock today (May 2026)",
    },
    {
      name: "Merch: MHL + mall_raduga",
      tab: "merch",
      check: () =>
        filterMerchTransactions(
          DEFAULT_DASHBOARD_FILTERS,
          {
            ...DEFAULT_MERCH_FILTERS,
            league: "MHL",
            salesChannels: ["mall_raduga"],
          },
          { useSeasonRange: true },
        ).length > 0,
    },
    {
      name: "Merch: playoff + class_3",
      tab: "merch",
      check: () =>
        computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_MERCH_FILTERS,
          tournamentStage: "playoff",
          matchClass: "class_3",
        }).revenue > 0,
    },
    {
      name: "Subscriptions: 2024/25 + VHL + parking",
      tab: "subscriptions",
      check: () =>
        filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_SUBSCRIPTION_FILTERS,
          season: "2024/25",
          league: "VHL",
          ticketType: "parking",
        }).length > 0,
    },
    {
      name: "Subscriptions: playoff + arena",
      tab: "subscriptions",
      check: () =>
        filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_SUBSCRIPTION_FILTERS,
          tournamentStage: "playoff",
          ticketType: "arena",
        }).length > 0,
    },
    {
      name: "Match sales: KHL + playoff",
      tab: "matches",
      check: () =>
        assertMatchSalesData(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_MATCH_SALES_FILTERS,
          league: "KHL",
          tournamentStage: "playoff",
          matchClass: "playoff",
        }),
    },
    {
      name: "Match sales: 2024/25 season",
      tab: "matches",
      check: () =>
        assertMatchSalesData(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_MATCH_SALES_FILTERS,
          season: "2024/25",
        }),
    },
    {
      name: "Match sales: VHL + secondary arena",
      tab: "matches",
      check: () =>
        assertMatchSalesData(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_MATCH_SALES_FILTERS,
          league: "VHL",
          arena: "secondary",
        }),
    },
    {
      name: "Match sales: upcoming matches only",
      tab: "matches",
      check: () =>
        assertMatchSalesData(DEFAULT_DASHBOARD_FILTERS, {
          ...DEFAULT_MATCH_SALES_FILTERS,
          eventCompleted: "no",
        }),
    },
  ];
}

export function getAllFilterCases(): FilterCoverageCase[] {
  return [
    ...buildTicketsFilterCases(),
    ...buildMerchFilterCases(),
    ...buildSubscriptionsFilterCases(),
    ...buildMatchSalesFilterCases(),
  ];
}

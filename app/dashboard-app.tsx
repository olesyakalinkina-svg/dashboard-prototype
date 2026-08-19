"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import {
  FilterDataRuntime,
  FilterProvider,
  useFilterData,
} from "@/context/FilterContext";
import { getEffectiveTicketTimeGrouping } from "@/lib/ticket-filter-options";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardTabs } from "@/components/layout/DashboardTabs";
import { FilterBar } from "@/components/layout/FilterBar";
import { MerchKpiCards, MatchSalesKpiCards, TabKpiCards } from "@/components/widgets/KpiCard";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import type {
  DashboardFilters,
  MatchSalesRow,
  TicketFilters,
} from "@/types/dashboard";

const ResponsiveMatchSalesTable = dynamic(
  () =>
    import("@/components/widgets/DataTableWidget").then((mod) => ({
      default: mod.ResponsiveMatchSalesTable,
    })),
  { loading: () => <ChartSkeleton height={360} /> },
);

const CombinedMatchSalesTable = dynamic(
  () =>
    import("@/components/widgets/DataTableWidget").then((mod) => ({
      default: mod.CombinedMatchSalesTable,
    })),
  { loading: () => <ChartSkeleton height={360} /> },
);

const MerchMatchSalesTable = dynamic(
  () =>
    import("@/components/widgets/DataTableWidget").then((mod) => ({
      default: mod.MerchMatchSalesTable,
    })),
  { loading: () => <ChartSkeleton height={360} /> },
);

const MerchSkuSalesTable = dynamic(
  () =>
    import("@/components/widgets/DataTableWidget").then((mod) => ({
      default: mod.MerchSkuSalesTable,
    })),
  { loading: () => <ChartSkeleton height={360} /> },
);

const MatchRevenueChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.MatchRevenueChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={320} />,
  },
);

const TicketsPlanFactWidget = dynamic(
  () =>
    import("@/components/widgets/TicketsPlanFactWidget").then((mod) => ({
      default: mod.TicketsPlanFactWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={360} />,
  },
);

const TicketsSeasonMatchDynamicsWidget = dynamic(
  () =>
    import("@/components/widgets/TicketsSeasonMatchDynamicsWidget").then(
      (mod) => ({
        default: mod.TicketsSeasonMatchDynamicsWidget,
      }),
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={380} />,
  },
);

const TicketsZoneSectorWidget = dynamic(
  () =>
    import("@/components/widgets/TicketsZoneSectorWidget").then((mod) => ({
      default: mod.TicketsZoneSectorWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={420} />,
  },
);

const SubscriptionCampaignPaceWidget = dynamic(
  () =>
    import("@/components/widgets/SubscriptionCampaignPaceWidget").then(
      (mod) => ({
        default: mod.SubscriptionCampaignPaceWidget,
      }),
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-w-0 grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <ChartSkeleton height={280} />
        <ChartSkeleton height={280} />
      </div>
    ),
  },
);

const SubscriptionPriceCategoryShareChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.SubscriptionPriceCategoryShareChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={360} />,
  },
);

const MerchSalesChannelsChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.MerchSalesChannelsChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={320} />,
  },
);

const MerchProductCategoriesChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.MerchProductCategoriesChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={320} />,
  },
);

const MerchSalesWidget = dynamic(
  () =>
    import("@/components/widgets/MerchSalesWidget").then((mod) => ({
      default: mod.MerchSalesWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={260} />,
  },
);

const TopProductsChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.TopProductsChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={320} />,
  },
);

const DashboardShell = memo(function DashboardShell() {
  return (
    <div className="min-h-screen min-w-0 bg-[var(--background)]">
      <DashboardHeader />
      <DashboardTabs />
      <FilterBar />
      <FilterDataRuntime>
        <DashboardPanels />
      </FilterDataRuntime>
    </div>
  );
});

/** Same 2-col template for Продажи and zone-sector so left-column cards share width. */
const TICKETS_TWO_COL_GRID_CLASS =
  "grid min-w-0 grid-cols-1 items-start gap-4 min-[1024px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]";

const TicketsSalesSection = memo(function TicketsSalesSection({
  matchSales,
  filters,
  ticketFilters,
}: {
  matchSales: MatchSalesRow[];
  filters: DashboardFilters;
  ticketFilters: TicketFilters;
}) {
  return (
    <ResponsiveMatchSalesTable
      data={matchSales}
      filters={filters}
      ticketFilters={ticketFilters}
    />
  );
});

const TicketsMatchDynamicsSection = memo(function TicketsMatchDynamicsSection() {
  const {
    ticketsMatchCumulativeSeries,
    ticketsChartsPending,
    appliedTicketFilters,
  } = useFilterData();
  const ticketChartTimeGrouping = getEffectiveTicketTimeGrouping(
    appliedTicketFilters,
  );

  return (
    <div className="min-w-0">
      {ticketsChartsPending ? (
        <ChartSkeleton height={380} />
      ) : (
        <TicketsSeasonMatchDynamicsWidget
          series={ticketsMatchCumulativeSeries}
          matchIds={appliedTicketFilters.matchId}
          timeGrouping={ticketChartTimeGrouping}
        />
      )}
    </div>
  );
});

function DashboardPanels() {
  const {
    displayTab: activeTab,
    ticketsKpis,
    merchKpis,
    subscriptionsKpis,
    ticketsPlanFactTrend,
    topProducts,
    subscriptionPriceCategoryShares,
    matchSales,
    combinedMatchSales,
    matchSalesKpis,
    matchRevenueChart,
    merchMatchSales,
    merchSalesChannelRevenue,
    merchPlanFactTrend,
    merchProductCategoryRevenue,
    merchSkuSales,
    appliedFilters,
    appliedTicketFilters,
    appliedSubscriptionFilters,
  } = useFilterData();
  const ticketChartTimeGrouping = getEffectiveTicketTimeGrouping(
    appliedTicketFilters,
  );

  return (
    <main
      className="min-w-0 space-y-4 p-4 sm:space-y-6 sm:p-6"
      style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom))" }}
    >
        {activeTab !== "merch" && activeTab !== "matches" && (
          <TabKpiCards
            tab={activeTab}
            ticketsKpis={ticketsKpis}
            subscriptionsKpis={subscriptionsKpis}
          />
        )}

        {activeTab === "subscriptions" && (
          <>
            <SubscriptionCampaignPaceWidget />
            <SubscriptionPriceCategoryShareChart
              data={subscriptionPriceCategoryShares}
              season={appliedSubscriptionFilters.season}
            />
          </>
        )}

        {activeTab === "tickets" && (
          <>
            <div className={TICKETS_TWO_COL_GRID_CLASS}>
              <TicketsSalesSection
                matchSales={matchSales}
                filters={appliedFilters}
                ticketFilters={appliedTicketFilters}
              />
              <div className="flex min-w-0 flex-col gap-4">
                <TicketsMatchDynamicsSection />
                <TicketsPlanFactWidget
                  data={ticketsPlanFactTrend}
                  timeGrouping={ticketChartTimeGrouping}
                />
              </div>
            </div>
            <div className={TICKETS_TWO_COL_GRID_CLASS}>
              <TicketsZoneSectorWidget />
              <div aria-hidden="true" className="hidden min-[1024px]:block" />
            </div>
          </>
        )}

        {activeTab === "merch" && (
          <>
            <MerchKpiCards merchKpis={merchKpis} />
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 min-[1024px]:grid-cols-2">
              <MerchSalesWidget data={merchPlanFactTrend} />
              <TopProductsChart data={topProducts} />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-4">
                <MerchMatchSalesTable data={merchMatchSales} />
                <MerchSalesChannelsChart data={merchSalesChannelRevenue} />
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <MerchSkuSalesTable data={merchSkuSales} />
                <MerchProductCategoriesChart data={merchProductCategoryRevenue} />
              </div>
            </div>
          </>
        )}

        {activeTab === "matches" && (
          <>
            <MatchSalesKpiCards matchSalesKpis={matchSalesKpis} />
            <CombinedMatchSalesTable data={combinedMatchSales} />
            <MatchRevenueChart data={matchRevenueChart} />
          </>
        )}
    </main>
  );
}

export default function DashboardApp() {
  return (
    <FilterProvider>
      <DashboardShell />
    </FilterProvider>
  );
}

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
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 min-[1024px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <ChartSkeleton height={280} />
          <ChartSkeleton height={360} />
        </div>
        <ChartSkeleton height={280} />
      </div>
    ),
  },
);

const SubscriptionRenewalWidget = dynamic(
  () =>
    import("@/components/widgets/SubscriptionRenewalWidget").then((mod) => ({
      default: mod.SubscriptionRenewalWidget,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-w-0 space-y-3">
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
          <ChartSkeleton height={96} />
          <ChartSkeleton height={96} />
          <ChartSkeleton height={96} />
        </div>
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
            <SubscriptionCampaignPaceWidget>
              <SubscriptionPriceCategoryShareChart
                data={subscriptionPriceCategoryShares}
                season={appliedSubscriptionFilters.season}
              />
            </SubscriptionCampaignPaceWidget>
            <SubscriptionRenewalWidget />
          </>
        )}

        {activeTab === "tickets" && (
          <>
            <TicketsSalesSection
              matchSales={matchSales}
              filters={appliedFilters}
              ticketFilters={appliedTicketFilters}
            />
            <TicketsMatchDynamicsSection />
            <TicketsPlanFactWidget
              data={ticketsPlanFactTrend}
              timeGrouping={ticketChartTimeGrouping}
            />
          </>
        )}

        {activeTab === "merch" && (
          <>
            <MerchKpiCards merchKpis={merchKpis} />
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 min-[1024px]:grid-cols-2">
              <MerchSalesWidget data={merchPlanFactTrend} />
              <TopProductsChart data={topProducts} />
            </div>
            <MerchMatchSalesTable data={merchMatchSales} />
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <MerchSkuSalesTable data={merchSkuSales} />
              <div className="flex min-w-0 flex-col gap-4">
                <MerchSalesChannelsChart data={merchSalesChannelRevenue} />
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

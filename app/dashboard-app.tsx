"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import {
  FilterDataRuntime,
  FilterProvider,
  useFilterData,
} from "@/context/FilterContext";
import { getEffectiveMerchTimeGrouping } from "@/lib/merch-filter-options";
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

const SubscriptionsSalesWidget = dynamic(
  () =>
    import("@/components/widgets/SubscriptionsSalesWidget").then((mod) => ({
      default: mod.SubscriptionsSalesWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={360} />,
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
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartSkeleton height={360} />
        <ChartSkeleton height={360} />
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

const MerchSalesChannelsTrendWidget = dynamic(
  () =>
    import("@/components/widgets/MerchSalesChannelsTrendWidget").then((mod) => ({
      default: mod.MerchSalesChannelsTrendWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={360} />,
  },
);

const MerchProductCategoriesTrendWidget = dynamic(
  () =>
    import("@/components/widgets/MerchProductCategoriesTrendWidget").then(
      (mod) => ({
        default: mod.MerchProductCategoriesTrendWidget,
      }),
    ),
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
    <div className="min-h-screen min-w-0 overflow-x-clip bg-[var(--background)]">
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
    <div className="min-w-0 self-start">
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
    subscriptionsPlanFactTrend,
    topProducts,
    subscriptionPriceCategoryShares,
    matchSales,
    combinedMatchSales,
    matchSalesKpis,
    matchRevenueChart,
    merchMatchSales,
    merchSalesChannelRevenue,
    merchSalesChannelTrend,
    merchPlanFactTrend,
    merchProductCategoryRevenue,
    merchProductCategoryTrend,
    merchSkuSales,
    appliedFilters,
    appliedTicketFilters,
    appliedMerchFilters,
    appliedSubscriptionFilters,
  } = useFilterData();
  const merchChartTimeGrouping = getEffectiveMerchTimeGrouping(
    appliedMerchFilters,
  );
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
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[1.6fr_1fr]">
              <SubscriptionsSalesWidget data={subscriptionsPlanFactTrend} />
              <SubscriptionPriceCategoryShareChart
                data={subscriptionPriceCategoryShares}
                season={appliedSubscriptionFilters.season}
              />
            </div>
            <SubscriptionCampaignPaceWidget />
          </>
        )}

        {activeTab === "tickets" && (
          <>
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <TicketsSalesSection
                matchSales={matchSales}
                filters={appliedFilters}
                ticketFilters={appliedTicketFilters}
              />
              <TicketsMatchDynamicsSection />
            </div>
            <TicketsPlanFactWidget
              data={ticketsPlanFactTrend}
              timeGrouping={ticketChartTimeGrouping}
            />
            <TicketsZoneSectorWidget />
          </>
        )}

        {activeTab === "merch" && (
          <>
            <MerchKpiCards merchKpis={merchKpis} />
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <MerchSalesWidget data={merchPlanFactTrend} />
              <TopProductsChart data={topProducts} />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <MerchMatchSalesTable data={merchMatchSales} />
              <MerchSkuSalesTable data={merchSkuSales} />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <MerchSalesChannelsTrendWidget
                data={merchSalesChannelTrend}
                channels={appliedMerchFilters.salesChannels}
                timeGrouping={merchChartTimeGrouping}
              />
              <MerchProductCategoriesTrendWidget
                data={merchProductCategoryTrend}
                timeGrouping={merchChartTimeGrouping}
              />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <MerchSalesChannelsChart data={merchSalesChannelRevenue} />
              <MerchProductCategoriesChart data={merchProductCategoryRevenue} />
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

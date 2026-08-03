"use client";

import dynamic from "next/dynamic";
import { FilterProvider, useFilters } from "@/context/FilterContext";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardTabs } from "@/components/layout/DashboardTabs";
import { FilterBar } from "@/components/layout/FilterBar";
import { TabKpiCards } from "@/components/widgets/KpiCard";
import { getMerchChartsRowHeight } from "@/components/widgets/Charts";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import {
  MerchMatchSalesTable,
  MerchSkuSalesTable,
  MatchSalesTable,
} from "@/components/widgets/DataTableWidget";

const TicketsSalesWidget = dynamic(
  () =>
    import("@/components/widgets/TicketsSalesWidget").then((mod) => ({
      default: mod.TicketsSalesWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={420} />,
  },
);

const TicketsBreakdownWidget = dynamic(
  () =>
    import("@/components/widgets/TicketsBreakdownWidget").then((mod) => ({
      default: mod.TicketsBreakdownWidget,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-md bg-[var(--background)]" />
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            <ChartSkeleton height={220} />
            <ChartSkeleton height={260} />
          </div>
          <ChartSkeleton height={480} />
        </div>
      </div>
    ),
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

const SubscriptionPlansChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.SubscriptionPlansChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={180} />,
  },
);

const ChannelMixChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.ChannelMixChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={180} />,
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

function DashboardContent() {
  const {
    activeTab,
    ticketsKpis,
    merchKpis,
    subscriptionsKpis,
    weeklyTrend,
    ticketsMatchCumulativeSeries,
    subscriptionsPlanFactTrend,
    ticketFilters,
    merchFilters,
    filters,
    channelMix,
    topProducts,
    subscriptionTariffStats,
    matchSales,
    ticketTypeSales,
    priceZoneSales,
    orderSourceSales,
    merchMatchSales,
    merchSalesChannelRevenue,
    merchProductCategoryRevenue,
    merchSkuSales,
  } = useFilters();

  const merchChartsHeight = getMerchChartsRowHeight(
    topProducts,
    merchSalesChannelRevenue,
    merchProductCategoryRevenue,
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DashboardHeader />
      <DashboardTabs />
      <FilterBar />

      <main className="min-w-0 space-y-4 p-4 sm:space-y-6 sm:p-6">
        <TabKpiCards
          tab={activeTab}
          ticketsKpis={ticketsKpis}
          merchKpis={merchKpis}
          subscriptionsKpis={subscriptionsKpis}
          merchWeeklyTrend={activeTab === "merch" ? weeklyTrend : undefined}
          merchTimeGrouping={
            activeTab === "merch" ? merchFilters.timeGrouping : undefined
          }
        />

        {activeTab === "subscriptions" && (
          <>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
              <SubscriptionsSalesWidget
                data={subscriptionsPlanFactTrend}
                refreshKey={filters.dateRange.toString()}
              />
              <div className="flex min-w-0 flex-col gap-4">
                <SubscriptionPlansChart data={subscriptionTariffStats} compact />
                <ChannelMixChart
                  data={channelMix}
                  title="Каналы продаж абонементов"
                  compact
                />
              </div>
            </div>
          </>
        )}

        {activeTab === "tickets" && (
          <>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <MatchSalesTable data={matchSales} />
              <TicketsSalesWidget
                series={ticketsMatchCumulativeSeries}
                ticketFilters={ticketFilters}
                refreshKey={`${ticketFilters.timeGrouping}-${ticketsMatchCumulativeSeries.length}`}
              />
            </div>
            <TicketsBreakdownWidget
              ticketTypeSales={ticketTypeSales}
              priceZoneSales={priceZoneSales}
              orderSourceSales={orderSourceSales}
              refreshKey={[
                ticketFilters.season,
                ticketFilters.league,
                ticketFilters.matchId,
                ticketFilters.ticketType,
                ticketFilters.priceZone,
                ticketFilters.orderSource,
              ].join("-")}
            />
          </>
        )}

        {activeTab === "merch" && (
          <>
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <MerchMatchSalesTable data={merchMatchSales} />
              <MerchSkuSalesTable data={merchSkuSales} />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <MerchSalesChannelsChart
                data={merchSalesChannelRevenue}
                height={merchChartsHeight}
                fillHeight
              />
              <TopProductsChart
                data={topProducts}
                height={merchChartsHeight}
                fillHeight
              />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <MerchProductCategoriesChart
                data={merchProductCategoryRevenue}
                height={merchChartsHeight}
                fillHeight
                className="xl:col-span-2"
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <FilterProvider>
      <DashboardContent />
    </FilterProvider>
  );
}

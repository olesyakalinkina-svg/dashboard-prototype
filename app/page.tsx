"use client";

import dynamic from "next/dynamic";
import { FilterProvider, useFilterData, useFilterState } from "@/context/FilterContext";
import { getEffectiveMerchTimeGrouping } from "@/lib/merch-filter-options";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardTabs } from "@/components/layout/DashboardTabs";
import { FilterBar } from "@/components/layout/FilterBar";
import { MerchKpiCards, MatchSalesKpiCards, TabKpiCards } from "@/components/widgets/KpiCard";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import {
  CombinedMatchSalesTable,
  MerchMatchSalesTable,
  MerchSkuSalesTable,
  MatchSalesTable,
} from "@/components/widgets/DataTableWidget";

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

const TicketsSalesChannelsTrendWidget = dynamic(
  () =>
    import("@/components/widgets/TicketsSalesChannelsTrendWidget").then((mod) => ({
      default: mod.TicketsSalesChannelsTrendWidget,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={360} />,
  },
);

const TicketsPriceZoneTrendWidget = dynamic(
  () =>
    import("@/components/widgets/TicketsPriceZoneTrendWidget").then((mod) => ({
      default: mod.TicketsPriceZoneTrendWidget,
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

const MerchSalesStackedChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.MerchSalesStackedChart,
    })),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={260} />,
  },
);

const MerchSalesSegmentStackedChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.MerchSalesSegmentStackedChart,
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

function DashboardContent() {
  const { activeTab, ticketFilters, merchFilters } = useFilterState();
  const {
    ticketsKpis,
    merchKpis,
    subscriptionsKpis,
    ticketsMatchCumulativeSeries,
    ticketsPlanFactTrend,
    ticketsSalesChannelTrend,
    ticketsPriceZoneTrend,
    subscriptionsPlanFactTrend,
    channelMix,
    topProducts,
    subscriptionTariffStats,
    matchSales,
    combinedMatchSales,
    matchSalesKpis,
    matchRevenueChart,
    ticketTypeSales,
    priceZoneSales,
    orderSourceSales,
    merchMatchSales,
    merchSalesChannelRevenue,
    merchSalesChannelTrend,
    merchSalesSegmentTrend,
    merchProductCategoryRevenue,
    merchProductCategoryTrend,
    merchSkuSales,
  } = useFilterData();
  const merchChartTimeGrouping = getEffectiveMerchTimeGrouping(merchFilters);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-[var(--background)]">
      <DashboardHeader />
      <DashboardTabs />
      <FilterBar />

      <main className="min-w-0 space-y-4 p-4 sm:space-y-6 sm:p-6">
        {activeTab !== "merch" && activeTab !== "matches" && (
          <TabKpiCards
            tab={activeTab}
            ticketsKpis={ticketsKpis}
            subscriptionsKpis={subscriptionsKpis}
          />
        )}

        {activeTab === "subscriptions" && (
          <>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
              <SubscriptionsSalesWidget data={subscriptionsPlanFactTrend} />
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
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <MatchSalesTable data={matchSales} />
              <TicketsSeasonMatchDynamicsWidget
                series={ticketsMatchCumulativeSeries}
                ticketFilters={ticketFilters}
              />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <TicketsPlanFactWidget data={ticketsPlanFactTrend} />
              <TicketsSalesChannelsTrendWidget data={ticketsSalesChannelTrend} />
            </div>
            <TicketsPriceZoneTrendWidget data={ticketsPriceZoneTrend} />
            <TicketsBreakdownWidget
              ticketTypeSales={ticketTypeSales}
              priceZoneSales={priceZoneSales}
              orderSourceSales={orderSourceSales}
            />
          </>
        )}

        {activeTab === "merch" && (
          <>
            <MerchKpiCards merchKpis={merchKpis} />
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <MerchSalesStackedChart
                data={merchSalesChannelTrend}
                timeGrouping={merchChartTimeGrouping}
              />
              <MerchSalesSegmentStackedChart
                data={merchSalesSegmentTrend}
                timeGrouping={merchChartTimeGrouping}
              />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <MerchMatchSalesTable data={merchMatchSales} />
              <MerchSkuSalesTable data={merchSkuSales} />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <MerchSalesChannelsTrendWidget
                data={merchSalesChannelTrend}
                channels={merchFilters.salesChannels}
                timeGrouping={merchChartTimeGrouping}
              />
              <MerchProductCategoriesTrendWidget
                data={merchProductCategoryTrend}
                timeGrouping={merchChartTimeGrouping}
              />
            </div>
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
              <MerchSalesChannelsChart data={merchSalesChannelRevenue} />
              <MerchProductCategoriesChart data={merchProductCategoryRevenue} />
              <TopProductsChart data={topProducts} />
            </div>
          </>
        )}

        {activeTab === "matches" && (
          <>
            <MatchSalesKpiCards matchSalesKpis={matchSalesKpis} />
            <MatchRevenueChart data={matchRevenueChart} />
            <CombinedMatchSalesTable data={combinedMatchSales} />
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

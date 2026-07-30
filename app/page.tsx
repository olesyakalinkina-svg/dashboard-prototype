"use client";

import { FilterProvider, useFilters } from "@/context/FilterContext";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardTabs } from "@/components/layout/DashboardTabs";
import { FilterBar } from "@/components/layout/FilterBar";
import { TabKpiCards } from "@/components/widgets/KpiCard";
import {
  ChannelMixChart,
  MerchSalesChannelsChart,
  SubscriptionPlansChart,
  TopProductsChart,
} from "@/components/widgets/Charts";
import { SubscriptionsSalesWidget } from "@/components/widgets/SubscriptionsSalesWidget";
import {
  MerchMatchSalesTable,
  MerchSkuSalesTable,
  MatchSalesTable,
} from "@/components/widgets/DataTableWidget";
import { TicketsSalesWidget } from "@/components/widgets/TicketsSalesWidget";

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
    merchMatchSales,
    merchSalesChannelRevenue,
    merchSkuSales,
  } = useFilters();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DashboardHeader />
      <DashboardTabs />
      <FilterBar />

      <main className="min-w-0 space-y-6 p-6">
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
          </>
        )}

        {activeTab === "merch" && (
          <>
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
              <MerchMatchSalesTable data={merchMatchSales} />
              <div className="flex min-w-0 flex-col gap-4">
                <MerchSkuSalesTable data={merchSkuSales} />
                <TopProductsChart data={topProducts} />
              </div>
            </div>
            <MerchSalesChannelsChart data={merchSalesChannelRevenue} />
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

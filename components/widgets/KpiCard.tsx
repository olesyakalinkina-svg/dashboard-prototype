"use client";

import dynamic from "next/dynamic";
import clsx from "clsx";
import { Card, CardContent } from "@/components/ui/Card";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { formatCurrency, formatNumber, formatPercent, formatPercentSigned } from "@/lib/format";
import type {
  DashboardTab,
  MerchKpiData,
  SubscriptionsKpiData,
  TicketsKpiData,
  TimeGrouping,
  WeeklyPoint,
} from "@/types/dashboard";

const LazyMerchRevenueTrendChart = dynamic(
  () =>
    import("@/components/widgets/Charts").then((mod) => ({
      default: mod.MerchRevenueTrendChart,
    })),
  {
    ssr: false,
    loading: () => (
      <ChartSkeleton
        height={120}
        className="col-span-full sm:col-span-2 xl:col-span-1"
      />
    ),
  },
);

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  sparkline?: number[];
  positiveIsGood?: boolean;
  hideTrend?: boolean;
};

export function KpiCard({
  title,
  value,
  subtitle,
  change = 0,
  positiveIsGood = true,
  hideTrend = false,
}: KpiCardProps) {
  const isPositive = change >= 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  return (
    <Card className="min-w-0">
      <CardContent className="pt-4">
        <p className="text-xs text-[var(--muted)]">{title}</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
        )}
        {!hideTrend && (
          <div className="mt-2 flex items-end justify-between gap-2">
            <span
              className={clsx(
                "text-xs font-medium",
                isGood ? "text-emerald-600" : "text-red-500",
              )}
            >
              {formatPercentSigned(change)} к пред. периоду
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TabKpiCards({
  tab,
  ticketsKpis,
  merchKpis,
  subscriptionsKpis,
  merchWeeklyTrend,
  merchTimeGrouping,
}: {
  tab: DashboardTab;
  ticketsKpis: TicketsKpiData;
  merchKpis: MerchKpiData;
  subscriptionsKpis: SubscriptionsKpiData;
  merchWeeklyTrend?: WeeklyPoint[];
  merchTimeGrouping?: TimeGrouping;
}) {
  if (tab === "subscriptions") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          title="Выручка"
          value={formatCurrency(subscriptionsKpis.revenue)}
          hideTrend
        />
        <KpiCard
          title="Продано"
          value={formatNumber(subscriptionsKpis.sold)}
          hideTrend
        />
      </div>
    );
  }

  if (tab === "tickets") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Выручка"
          value={formatCurrency(ticketsKpis.revenue)}
          hideTrend
        />
        <KpiCard
          title="Выполнение плана"
          value={formatPercent(ticketsKpis.planCompletionPct)}
          subtitle="Процент выполнения плана продаж"
          hideTrend
        />
        <KpiCard
          title="Проданные билеты"
          value={formatNumber(ticketsKpis.ticketsSold)}
          hideTrend
        />
        <KpiCard
          title="Средняя цена"
          value={formatCurrency(ticketsKpis.avgPrice)}
          hideTrend
        />
        <KpiCard
          title="Скидка ПЛ"
          value={formatPercent(ticketsKpis.loyaltyDiscountPct)}
          subtitle="Программа лояльности"
          hideTrend
        />
        <KpiCard
          title="Заполняемость"
          value={formatPercent(ticketsKpis.fillRate)}
          subtitle="Купленные и бесплатные билеты"
          hideTrend
        />
        <KpiCard
          title="Выручка сегодня"
          value={formatCurrency(ticketsKpis.revenueToday)}
          subtitle="За текущий день"
          hideTrend
        />
        <KpiCard
          title="Билеты сегодня"
          value={formatNumber(ticketsKpis.ticketsToday)}
          subtitle="За текущий день"
          hideTrend
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <KpiCard
        title="Выручка"
        value={formatCurrency(merchKpis.revenue)}
        hideTrend
      />
      {merchWeeklyTrend && (
        <LazyMerchRevenueTrendChart
          data={merchWeeklyTrend}
          timeGrouping={merchTimeGrouping}
          className="col-span-full sm:col-span-2 xl:col-span-1"
        />
      )}
      <KpiCard
        title="Средний чек (руб.)"
        value={formatCurrency(merchKpis.avgCheck)}
        subtitle={`UPT ${merchKpis.upt.toFixed(2).replace(".", ",")} шт`}
        hideTrend
      />
      <KpiCard
        title="Чеки (шт)"
        value={formatNumber(merchKpis.receipts)}
        hideTrend
      />
      <KpiCard
        title="Возвраты (%)"
        value={formatPercent(merchKpis.returnsPct)}
        hideTrend
      />
      <KpiCard
        title="Маржинальность"
        value={formatPercent(merchKpis.marginPct)}
        hideTrend
      />
    </div>
  );
}

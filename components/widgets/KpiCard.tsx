"use client";

import clsx from "clsx";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatNumber, formatPercent, formatPercentSigned } from "@/lib/format";
import type {
  DashboardTab,
  MatchSalesKpiData,
  MerchKpiData,
  SubscriptionsKpiData,
  TicketsKpiData,
} from "@/types/dashboard";

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  sparkline?: number[];
  positiveIsGood?: boolean;
  hideTrend?: boolean;
};

export function KpiCard({
  title,
  value,
  subtitle,
  change = 0,
  changeLabel = "к пред. периоду",
  positiveIsGood = true,
  hideTrend = false,
}: KpiCardProps) {
  const isPositive = change >= 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  return (
    <Card className="min-w-0">
      <CardContent className="pt-4">
        <p className="text-xs leading-snug text-[var(--muted)]">{title}</p>
        <p className="mt-1 break-words text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{subtitle}</p>
        )}
        {!hideTrend && (
          <div className="mt-2 flex items-end justify-between gap-2">
            <span
              className={clsx(
                "text-xs font-medium leading-snug",
                isGood ? "text-emerald-600" : "text-red-500",
              )}
            >
              {formatPercentSigned(change)} {changeLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MerchKpiCards({ merchKpis }: { merchKpis: MerchKpiData }) {
  const sc = merchKpis.seasonComparison;
  const showSeasonComparison = Boolean(sc);
  const seasonChangeLabel = sc ? `к сезону ${sc.previousSeason}` : undefined;

  const kpiProps = { changeLabel: seasonChangeLabel };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5 xl:gap-2">
      <KpiCard
        title="Выручка"
        value={formatCurrency(merchKpis.revenue)}
        change={sc?.revenueChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Средний чек (руб.)"
        value={formatCurrency(merchKpis.avgCheck)}
        subtitle={`UPT ${merchKpis.upt.toFixed(2).replace(".", ",")} шт`}
        change={sc?.avgCheckChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Чеки (шт)"
        value={formatNumber(merchKpis.receipts)}
        change={sc?.receiptsChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Возвраты (%)"
        value={formatPercent(merchKpis.returnsPct)}
        change={sc?.returnsPctChange}
        positiveIsGood={false}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Маржинальность"
        value={formatPercent(merchKpis.marginPct)}
        change={sc?.marginPctChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
    </div>
  );
}

export function MatchSalesKpiCards({
  matchSalesKpis,
}: {
  matchSalesKpis: MatchSalesKpiData;
}) {
  const sc = matchSalesKpis.seasonComparison;
  const showSeasonComparison = Boolean(sc);
  const seasonChangeLabel = sc ? `к сезону ${sc.previousSeason}` : undefined;

  const kpiProps = { changeLabel: seasonChangeLabel };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6 xl:gap-2">
      <KpiCard
        title="Общая выручка"
        value={formatCurrency(matchSalesKpis.totalRevenue)}
        change={sc?.totalRevenueChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Выручка от билетов"
        value={formatCurrency(matchSalesKpis.ticketRevenue)}
        change={sc?.ticketRevenueChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Выручка от мерча"
        value={formatCurrency(matchSalesKpis.merchRevenue)}
        change={sc?.merchRevenueChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Продано билетов"
        value={formatNumber(matchSalesKpis.ticketsSold)}
        change={sc?.ticketsSoldChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Заполняемость"
        value={formatPercent(matchSalesKpis.fillRate)}
        change={sc?.fillRateChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Матчей"
        value={formatNumber(matchSalesKpis.matchCount)}
        change={sc?.matchCountChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
    </div>
  );
}

export function TabKpiCards({
  tab,
  ticketsKpis,
  subscriptionsKpis,
}: {
  tab: DashboardTab;
  ticketsKpis: TicketsKpiData;
  subscriptionsKpis: SubscriptionsKpiData;
}) {
  if (tab === "subscriptions") {
    const sc = subscriptionsKpis.seasonComparison;
    const showSeasonComparison = Boolean(sc);
    const seasonChangeLabel = sc ? `к сезону ${sc.previousSeason}` : undefined;

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          title="Выручка"
          value={formatCurrency(subscriptionsKpis.revenue)}
          change={sc?.revenueChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Продано"
          value={formatNumber(subscriptionsKpis.sold)}
          change={sc?.soldChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
      </div>
    );
  }

  if (tab === "tickets") {
    const sc = ticketsKpis.seasonComparison;
    const showSeasonComparison = Boolean(sc);
    const seasonChangeLabel = sc ? `к сезону ${sc.previousSeason}` : undefined;

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Выручка"
          value={formatCurrency(ticketsKpis.revenue)}
          change={sc?.revenueChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Выполнение плана"
          value={formatPercent(ticketsKpis.planCompletionPct)}
          change={sc?.planCompletionChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Проданные билеты"
          value={formatNumber(ticketsKpis.ticketsSold)}
          change={sc?.ticketsChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Средняя цена"
          value={formatCurrency(ticketsKpis.avgPrice)}
          change={sc?.avgPriceChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Скидка программы лояльности"
          value={formatPercent(ticketsKpis.loyaltyDiscountPct)}
          change={sc?.loyaltyDiscountPctChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Заполняемость"
          value={formatPercent(ticketsKpis.fillRate)}
          subtitle="Купленные и бесплатные билеты"
          change={sc?.fillRateChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
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

  return null;
}

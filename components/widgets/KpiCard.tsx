"use client";

import clsx from "clsx";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
  formatPercentSigned,
} from "@/lib/format";
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
  fullValue?: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  sparkline?: number[];
  positiveIsGood?: boolean;
  hideTrend?: boolean;
  compactCurrency?: boolean;
  rawCurrencyValue?: number;
  className?: string;
};

export const KpiCard = memo(function KpiCard({
  title,
  value,
  fullValue,
  subtitle,
  change = 0,
  changeLabel = "к пред. периоду",
  positiveIsGood = true,
  hideTrend = false,
  compactCurrency = false,
  rawCurrencyValue,
  className,
}: KpiCardProps) {
  const isPositive = change >= 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const displayValue =
    compactCurrency && rawCurrencyValue != null
      ? formatCurrencyCompact(rawCurrencyValue)
      : value;
  const tooltipValue = fullValue ?? (compactCurrency ? value : undefined);

  const body = (
    <>
      <p className="text-xs leading-snug text-[var(--muted)]">{title}</p>
      <p
        className="mt-1 break-words text-lg font-semibold text-[var(--foreground)] min-[480px]:text-xl sm:text-2xl"
        title={tooltipValue}
      >
        {displayValue}
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
    </>
  );

  return (
    <Card className={clsx("min-w-0", className)}>
      <CardContent className="pt-3 sm:pt-4">{body}</CardContent>
    </Card>
  );
});

export function MerchKpiCards({ merchKpis }: { merchKpis: MerchKpiData }) {
  const sc = merchKpis.seasonComparison;
  const showSeasonComparison = Boolean(sc);
  const seasonChangeLabel = sc ? `к сезону ${sc.previousSeason}` : undefined;

  const kpiProps = { changeLabel: seasonChangeLabel };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5 xl:gap-2">
      <KpiCard
        title="Выручка"
        value={formatCurrency(merchKpis.revenue)}
        compactCurrency
        rawCurrencyValue={merchKpis.revenue}
        change={sc?.revenueChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Средний чек (руб.)"
        value={formatCurrency(merchKpis.avgCheck)}
        compactCurrency
        rawCurrencyValue={merchKpis.avgCheck}
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
    <div className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6 xl:gap-2">
      <KpiCard
        title="Общая выручка"
        value={formatCurrency(matchSalesKpis.totalRevenue)}
        compactCurrency
        rawCurrencyValue={matchSalesKpis.totalRevenue}
        change={sc?.totalRevenueChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Выручка от билетов"
        value={formatCurrency(matchSalesKpis.ticketRevenue)}
        compactCurrency
        rawCurrencyValue={matchSalesKpis.ticketRevenue}
        change={sc?.ticketRevenueChange}
        hideTrend={!showSeasonComparison}
        {...kpiProps}
      />
      <KpiCard
        title="Выручка от мерча"
        value={formatCurrency(matchSalesKpis.merchRevenue)}
        compactCurrency
        rawCurrencyValue={matchSalesKpis.merchRevenue}
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
        title="Заполняемость (вся билетная масса/вместимость)"
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

export const TabKpiCards = memo(function TabKpiCards({
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
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Выручка"
          value={formatCurrency(subscriptionsKpis.revenue)}
          compactCurrency
          rawCurrencyValue={subscriptionsKpis.revenue}
          change={sc?.revenueChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Абонементов продано (шт)"
          value={formatNumber(subscriptionsKpis.sold)}
          change={sc?.soldChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Уникальные покупатели"
          value={formatNumber(subscriptionsKpis.uniqueCustomers)}
          change={sc?.uniqueCustomersChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
        <KpiCard
          title="Средний чек"
          value={formatCurrency(subscriptionsKpis.avgCheck)}
          compactCurrency
          rawCurrencyValue={subscriptionsKpis.avgCheck}
          change={sc?.avgCheckChange}
          changeLabel={seasonChangeLabel}
          hideTrend={!showSeasonComparison}
        />
      </div>
    );
  }

  if (tab === "tickets") {
    const ticketsPlanCompletionPct = ticketsKpis.planCompletionPct;
    const ticketsSoldPlanChange =
      ticketsKpis.planTicketsSold > 0
        ? ((ticketsKpis.planFactTicketsSold - ticketsKpis.planTicketsSold) /
            ticketsKpis.planTicketsSold) *
          100
        : 0;

    return (
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Выручка"
          value={formatCurrency(ticketsKpis.revenue)}
          compactCurrency
          rawCurrencyValue={ticketsKpis.revenue}
          change={ticketsPlanCompletionPct - 100}
          changeLabel="к плану"
          hideTrend={false}
        />
        <KpiCard
          title="Проданные билеты"
          value={formatNumber(ticketsKpis.ticketsSold)}
          change={ticketsSoldPlanChange}
          changeLabel="к плану"
          hideTrend={false}
        />
        <KpiCard
          className="md:max-lg:col-start-3 md:max-lg:row-start-1"
          title="Выручка сегодня"
          value={formatCurrency(ticketsKpis.revenueToday)}
          compactCurrency
          rawCurrencyValue={ticketsKpis.revenueToday}
          subtitle="За текущий день"
          hideTrend
        />
        <KpiCard
          className="md:max-lg:col-start-3 md:max-lg:row-start-2"
          title="Билеты сегодня"
          value={formatNumber(ticketsKpis.ticketsToday)}
          subtitle="За текущий день"
          hideTrend
        />
        <KpiCard
          title="Средняя цена"
          value={formatCurrency(ticketsKpis.avgPrice)}
          compactCurrency
          rawCurrencyValue={ticketsKpis.avgPrice}
          hideTrend
        />
        <KpiCard
          title="Скидка программы лояльности"
          value={formatPercent(ticketsKpis.loyaltyDiscountPct)}
          hideTrend
        />
        <KpiCard
          title="Заполняемость (вся билетная масса/вместимость)"
          value={formatPercent(ticketsKpis.fillRate)}
          subtitle="Купленные и бесплатные билеты"
          hideTrend
        />
      </div>
    );
  }

  return null;
});

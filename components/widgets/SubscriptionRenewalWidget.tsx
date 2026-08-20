"use client";

import { useDeferredValue, useMemo } from "react";
import { KpiCard } from "@/components/widgets/KpiCard";
import { RenewalProductChart } from "@/components/widgets/subscription-renewal/RenewalProductChart";
import { useFilterState } from "@/context/FilterContext";
import { formatNumber, formatPercent } from "@/lib/format";
import { getSubscriptions } from "@/lib/mock/hockey";
import {
  computeSubscriptionRenewal,
  getRenewalSectionTitle,
} from "@/lib/subscription-renewal";

const SEASON_FILTER_NOTICE =
  "Фильтр по сезону не применяется: продление считается для перехода 2024/25 → 2025/26.";

export function SubscriptionRenewalWidget() {
  const { subscriptionFilters } = useFilterState();
  const deferredFilters = useDeferredValue(subscriptionFilters);

  const result = useMemo(
    () =>
      computeSubscriptionRenewal({
        subscriptions: getSubscriptions(),
        filters: deferredFilters,
      }),
    [deferredFilters],
  );

  const { kpis } = result;

  return (
    <section className="min-w-0 space-y-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {getRenewalSectionTitle()}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">{SEASON_FILTER_NOTICE}</p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <KpiCard
          title="Продлили"
          value={formatNumber(kpis.renewed)}
          subtitle={formatPercent(kpis.renewedPct)}
          subtitleClassName="font-medium text-emerald-600"
          hideTrend
        />
        <KpiCard
          title="Не продлили"
          value={formatNumber(kpis.notRenewed)}
          subtitle={formatPercent(kpis.notRenewedPct)}
          subtitleClassName="font-medium text-red-500"
          hideTrend
        />
        <KpiCard
          title="Новые клиенты"
          value={formatNumber(kpis.newClients)}
          subtitle={formatPercent(kpis.newClientsPct)}
          hideTrend
        />
      </div>

      <RenewalProductChart data={result.products} />
    </section>
  );
}

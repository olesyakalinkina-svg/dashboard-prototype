"use client";

import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useFilterState } from "@/context/FilterContext";
import { getSubscriptions } from "@/lib/mock/hockey";
import {
  computeCampaignBenchmark,
  getDataAsOfDate,
  listComparableCampaignConfigs,
  resolveBenchmarkCampaignConfig,
  type CampaignBenchmarkComputation,
} from "@/lib/subscription-campaign";
import { CampaignPaceChart } from "@/components/widgets/subscription-campaign/CampaignPaceChart";
import { CampaignPaceCompareSelect } from "@/components/widgets/subscription-campaign/CampaignPaceCompareSelect";
import { CampaignPaceTable } from "@/components/widgets/subscription-campaign/CampaignPaceTable";
import { CampaignPaceStateMessage } from "@/components/widgets/subscription-campaign/CampaignPaceStates";
import type { CampaignPaceHighlight } from "@/components/widgets/subscription-campaign/CampaignPaceTooltip";

const COUNT_TITLE = "Темп кампании: абонементы нарастающим итогом";
const COUNT_SUBTITLE = "Сравнение количества проданных абонементов по дням кампании";
const REVENUE_TITLE = "Темп кампании: выручка нарастающим итогом";
const REVENUE_SUBTITLE = "Сравнение фактической выручки по дням кампании";

const HIDDEN_WARNING_SNIPPETS = [
  "Нет базы для сравнения",
  "Данные не обновлены сегодня",
];

export function SubscriptionCampaignPaceWidget({
  children,
}: {
  children?: ReactNode;
}) {
  const { subscriptionFilters } = useFilterState();
  const deferredFilters = useDeferredValue(subscriptionFilters);
  const [tableOpen, setTableOpen] = useState(false);
  const [benchmarkSeasonId, setBenchmarkSeasonId] = useState<string | null>(null);

  const dataAsOfDate = useMemo(() => getDataAsOfDate(), []);
  const mainSeasonId =
    deferredFilters.season === "all" ? null : deferredFilters.season;

  const comparableCampaigns = useMemo(
    () => (mainSeasonId ? listComparableCampaignConfigs(mainSeasonId) : []),
    [mainSeasonId],
  );

  const resolvedBenchmarkSeasonId = useMemo(() => {
    if (!mainSeasonId) return "";
    return (
      resolveBenchmarkCampaignConfig(mainSeasonId, benchmarkSeasonId)?.seasonId ??
      ""
    );
  }, [mainSeasonId, benchmarkSeasonId]);

  const result = useMemo(
    () =>
      computeCampaignBenchmark({
        subscriptions: getSubscriptions(),
        filters: deferredFilters,
        dataAsOfDate,
        benchmarkSeasonId: resolvedBenchmarkSeasonId || null,
      }),
    [deferredFilters, dataAsOfDate, resolvedBenchmarkSeasonId],
  );

  const notices = [
    result.kind === "ok" && result.dateRangeIgnored
      ? "Фильтр по календарным датам не применяется: сравнение идёт по дням кампании."
      : null,
    ...result.warnings.filter(
      (warning) =>
        !HIDDEN_WARNING_SNIPPETS.some((snippet) => warning.includes(snippet)),
    ),
  ].filter((notice): notice is string => notice != null);

  const compareSelect =
    mainSeasonId && comparableCampaigns.length > 0 ? (
      <CampaignPaceCompareSelect
        options={comparableCampaigns}
        value={resolvedBenchmarkSeasonId}
        onChange={setBenchmarkSeasonId}
      />
    ) : null;

  return (
    <section className="min-w-0 space-y-3">
      {notices.length > 0 ? (
        <div className="min-w-0 text-xs text-[var(--muted)]">
          {notices.map((notice) => (
            <p key={notice}>{notice}</p>
          ))}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 min-[1024px]:grid-cols-2">
        <CampaignPaceCard
          title={COUNT_TITLE}
          subtitle={COUNT_SUBTITLE}
          highlight="count"
          result={result}
          compareSelect={compareSelect}
          table={
            result.kind === "ok" ? (
              <CampaignPaceTable
                open={tableOpen}
                onToggle={() => setTableOpen((open) => !open)}
                points={result.points}
                mainSeasonName={result.mainCampaign.seasonName}
                benchmarkSeasonName={result.benchmarkCampaign.seasonName}
              />
            ) : null
          }
        />
        <CampaignPaceCard
          title={REVENUE_TITLE}
          subtitle={REVENUE_SUBTITLE}
          highlight="revenue"
          result={result}
          compareSelect={compareSelect}
        />
      </div>
      {children ? (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 min-[1024px]:grid-cols-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function CampaignPaceCard({
  title,
  subtitle,
  highlight,
  result,
  compareSelect,
  table,
}: {
  title: string;
  subtitle: string;
  highlight: CampaignPaceHighlight;
  result: CampaignBenchmarkComputation;
  compareSelect: ReactNode;
  table?: ReactNode;
}) {
  const mainName = result.mainCampaign?.seasonName ?? "Текущий сезон";
  const benchmarkName = result.benchmarkCampaign?.seasonName ?? "Сравнение";

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader className="sm:items-start">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
            {subtitle}
          </p>
        </div>
        {compareSelect}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col">
        {result.kind === "ok" ? (
          <>
            <CampaignPaceChart
              points={result.points}
              highlight={highlight}
              mainSeasonName={mainName}
              benchmarkSeasonName={benchmarkName}
            />
            {table}
          </>
        ) : (
          <CampaignPaceStateMessage message={result.message} />
        )}
      </CardContent>
    </Card>
  );
}

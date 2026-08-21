"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  ChartZoomHint,
  ChartZoomResetButton,
} from "@/components/charts/ChartZoom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { NO_MATCHES_FILTER_VALUE } from "@/lib/ticket-filter-options";
import {
  aggregateSeasonMatchChartRowsByGrouping,
  buildSeasonMatchChartRows,
  buildSeasonMatchSelectorOptions,
  buildSeasonMatchSeriesViews,
  fromSeasonMatchSelectorValue,
  SEASON_MATCH_CURRENT_SALES_LABEL,
  selectSeasonMatchChartViews,
} from "@/lib/tickets-season-match-chart";
import type { TicketMatchCumulativeSeries, TimeGrouping } from "@/types/dashboard";
import { MobileMatchSelector } from "./tickets-season-match/MobileMatchSelector";
import { TicketsSeasonMatchChart } from "./tickets-season-match/TicketsSeasonMatchChart";
import { TicketsSeasonMatchLegend } from "./tickets-season-match/TicketsSeasonMatchLegend";

type ChartZoomControl = {
  isZoomed: boolean;
  resetZoom: () => void;
};

export const TicketsSeasonMatchDynamicsWidget = memo(
  function TicketsSeasonMatchDynamicsWidget({
    series,
    matchIds,
    timeGrouping,
    seriesFilter = "all",
  }: {
    series: TicketMatchCumulativeSeries[];
    matchIds: string[];
    timeGrouping: TimeGrouping;
    seriesFilter?: string | "all";
  }) {
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(
    () => new Set(),
  );
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  const [chartZoomControl, setChartZoomControl] =
    useState<ChartZoomControl | null>(null);

  const allViews = useMemo(
    () => buildSeasonMatchSeriesViews(series),
    [series],
  );

  const selectorOptions = useMemo(
    () => buildSeasonMatchSelectorOptions(allViews),
    [allViews],
  );
  const currentSalesOption = selectorOptions[0];
  const matchFilterOptions = selectorOptions.slice(1);

  const availableMatchIdsKey = matchFilterOptions
    .map((option) => option.value)
    .join(",");

  useEffect(() => {
    const valid = new Set(
      availableMatchIdsKey.split(",").filter((id) => id.length > 0),
    );
    setSelectedMatchIds((current) => {
      const next = current.filter((id) => valid.has(id));
      return next.length === current.length ? current : next;
    });
  }, [availableMatchIdsKey]);

  const globalMatchFilterActive =
    matchIds.length > 0 && matchIds[0] !== NO_MATCHES_FILTER_VALUE;

  const filteredViews = useMemo(
    () =>
      selectSeasonMatchChartViews(allViews, {
        selectedMatchIds,
        preserveIncomingViews: globalMatchFilterActive,
        seriesFilter,
      }),
    [allViews, selectedMatchIds, globalMatchFilterActive, seriesFilter],
  );

  const dailyChartRows = useMemo(
    () => buildSeasonMatchChartRows(filteredViews, series),
    [filteredViews, series],
  );

  const chartRows = useMemo(
    () =>
      aggregateSeasonMatchChartRowsByGrouping(
        dailyChartRows,
        filteredViews,
        timeGrouping,
      ),
    [dailyChartRows, filteredViews, timeGrouping],
  );

  const selectedMatchIdsKey = matchIds.join(",");
  const selectedMatchId =
    matchIds.length === 1 && matchIds[0] !== NO_MATCHES_FILTER_VALUE
      ? matchIds[0]
      : null;
  const widgetMatchIdsKey = selectedMatchIds.join(",");

  useEffect(() => {
    setHiddenSeries(new Set());
    setHoveredSeries(null);
    setChartZoomControl(null);
  }, [series, widgetMatchIdsKey, selectedMatchIdsKey, timeGrouping]);

  const toggleSeries = (matchId: string) => {
    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const chartHeight = 260;

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Динамика продаж билетов по матчам</CardTitle>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Накопительная выручка от открытия продаж до даты матча
          </p>
          <ChartZoomHint visible={!chartZoomControl?.isZoomed} />
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          {chartZoomControl?.isZoomed && (
            <ChartZoomResetButton onClick={chartZoomControl.resetZoom} />
          )}
          <MultiSelect
            label="Матчи"
            options={matchFilterOptions}
            value={selectedMatchIds}
            onChange={(nextValue) =>
              setSelectedMatchIds(
                fromSeasonMatchSelectorValue(selectedMatchIds, nextValue),
              )
            }
            leadingExclusiveOption={currentSalesOption}
            selectAllLabel="Все матчи"
            allSelectedLabel="Все матчи"
            emptyLabel={SEASON_MATCH_CURRENT_SALES_LABEL}
            applyOnClose
            className="sm:min-w-[220px] xl:min-w-[220px]"
          />
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-col">
        {series.length === 0 ? (
          <div
            className="flex shrink-0 items-center justify-center text-sm text-[var(--muted)]"
            style={{ height: chartHeight }}
          >
            Нет матчей по выбранным фильтрам
          </div>
        ) : filteredViews.length === 0 ? (
          <div
            className="flex shrink-0 items-center justify-center text-sm text-[var(--muted)]"
            style={{ height: chartHeight }}
          >
            Нет матчей по выбранному фильтру
          </div>
        ) : chartRows.length === 0 ? (
          <div
            className="flex shrink-0 items-center justify-center text-sm text-[var(--muted)]"
            style={{ height: chartHeight }}
          >
            Нет данных для построения графика
          </div>
        ) : (
          <div
            className="relative min-w-0 shrink-0 overflow-visible"
            style={{ height: chartHeight }}
          >
            <TicketsSeasonMatchChart
              rows={chartRows}
              views={filteredViews}
              hiddenSeries={hiddenSeries}
              hoveredSeries={hoveredSeries}
              chartHeight={chartHeight}
              selectedMatchId={selectedMatchId}
              timeGrouping={timeGrouping}
              onZoomStateChange={setChartZoomControl}
            />
          </div>
        )}

        <MobileMatchSelector
          views={filteredViews}
          hiddenSeries={hiddenSeries}
          hoveredSeries={hoveredSeries}
          onToggleSeries={toggleSeries}
          onHoverSeries={setHoveredSeries}
        />

        <TicketsSeasonMatchLegend
          views={filteredViews}
          hiddenSeries={hiddenSeries}
          hoveredSeries={hoveredSeries}
          onToggleSeries={toggleSeries}
          onHoverSeries={setHoveredSeries}
        />
      </CardContent>
    </Card>
  );
});

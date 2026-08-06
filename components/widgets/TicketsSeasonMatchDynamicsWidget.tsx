"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import {
  ChartZoomHint,
  ChartZoomResetButton,
} from "@/components/charts/ChartZoom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { NO_MATCHES_FILTER_VALUE, getEffectiveTicketTimeGrouping } from "@/lib/ticket-filter-options";
import {
  aggregateSeasonMatchChartRowsByGrouping,
  buildSeasonMatchChartRows,
  buildSeasonMatchSeriesViews,
  filterSeasonMatchSeriesViews,
  SEASON_MATCH_QUICK_FILTERS,
} from "@/lib/tickets-season-match-chart";
import type {
  TicketFilters,
  TicketMatchCumulativeSeries,
  TicketsSeasonMatchQuickFilter,
} from "@/types/dashboard";
import { MobileMatchSelector } from "./tickets-season-match/MobileMatchSelector";
import { TicketsSeasonMatchChart } from "./tickets-season-match/TicketsSeasonMatchChart";
import { TicketsSeasonMatchLegend } from "./tickets-season-match/TicketsSeasonMatchLegend";

type ChartZoomControl = {
  isZoomed: boolean;
  resetZoom: () => void;
};

export function TicketsSeasonMatchDynamicsWidget({
  series,
  ticketFilters,
}: {
  series: TicketMatchCumulativeSeries[];
  ticketFilters: TicketFilters;
}) {
  const [quickFilter, setQuickFilter] =
    useState<TicketsSeasonMatchQuickFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(
    () => new Set(),
  );
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  const [chartZoomControl, setChartZoomControl] =
    useState<ChartZoomControl | null>(null);

  const timeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);

  const allViews = useMemo(
    () => buildSeasonMatchSeriesViews(series),
    [series],
  );

  const filteredViews = useMemo(
    () => filterSeasonMatchSeriesViews(allViews, quickFilter, searchQuery),
    [allViews, quickFilter, searchQuery],
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

  const selectedMatchIdsKey = ticketFilters.matchId.join(",");
  const selectedMatchId =
    ticketFilters.matchId.length === 1 &&
    ticketFilters.matchId[0] !== NO_MATCHES_FILTER_VALUE
      ? ticketFilters.matchId[0]
      : null;

  useEffect(() => {
    setHiddenSeries(new Set());
    setHoveredSeries(null);
    setChartZoomControl(null);
  }, [series, quickFilter, searchQuery, selectedMatchIdsKey, timeGrouping]);

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

  const chartHeight = 300;

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Динамика продаж билетов по матчам</CardTitle>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Накопительная выручка от открытия продаж до даты матча
          </p>
          <ChartZoomHint visible={!chartZoomControl?.isZoomed} />
        </div>
        <div className="hidden w-full flex-wrap items-center gap-2 md:flex">
          {chartZoomControl?.isZoomed && (
            <ChartZoomResetButton onClick={chartZoomControl.resetZoom} />
          )}
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск соперника"
            className="w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs sm:w-44"
          />
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-3 hidden shrink-0 flex-wrap gap-2 md:flex">
          {SEASON_MATCH_QUICK_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setQuickFilter(option.value)}
              className={clsx(
                "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                quickFilter === option.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

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
          <div className="min-w-0 shrink-0" style={{ height: chartHeight }}>
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
          quickFilter={quickFilter}
          searchQuery={searchQuery}
          onQuickFilterChange={setQuickFilter}
          onSearchChange={setSearchQuery}
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
}

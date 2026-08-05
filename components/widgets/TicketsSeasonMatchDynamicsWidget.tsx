"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import {
  ChartZoomHint,
  ChartZoomResetButton,
} from "@/components/charts/ChartZoom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
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
import { TicketsSeasonMatchChart } from "./tickets-season-match/TicketsSeasonMatchChart";
import { TicketsSeasonMatchLegend } from "./tickets-season-match/TicketsSeasonMatchLegend";

type ChartZoomControl = {
  isZoomed: boolean;
  resetZoom: () => void;
};

export function TicketsSeasonMatchDynamicsWidget({
  series,
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

  const allViews = useMemo(
    () => buildSeasonMatchSeriesViews(series),
    [series],
  );

  const filteredViews = useMemo(
    () => filterSeasonMatchSeriesViews(allViews, quickFilter, searchQuery),
    [allViews, quickFilter, searchQuery],
  );

  const chartRows = useMemo(
    () => buildSeasonMatchChartRows(filteredViews, series),
    [filteredViews, series],
  );

  useEffect(() => {
    setHiddenSeries(new Set());
    setHoveredSeries(null);
    setChartZoomControl(null);
  }, [series, quickFilter, searchQuery]);

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

  const chartHeight = filteredViews.length > 14 ? 380 : 340;

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
        <div className="flex w-full flex-wrap items-center gap-2">
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
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
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
            className="flex items-center justify-center text-sm text-[var(--muted)]"
            style={{ height: chartHeight }}
          >
            Нет матчей по выбранным фильтрам
          </div>
        ) : filteredViews.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-[var(--muted)]"
            style={{ height: chartHeight }}
          >
            Нет матчей по выбранному фильтру
          </div>
        ) : chartRows.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-[var(--muted)]"
            style={{ height: chartHeight }}
          >
            Нет данных для построения графика
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <TicketsSeasonMatchChart
              rows={chartRows}
              views={filteredViews}
              hiddenSeries={hiddenSeries}
              hoveredSeries={hoveredSeries}
              chartHeight={chartHeight}
              onZoomStateChange={setChartZoomControl}
            />
          </div>
        )}

        <TicketsSeasonMatchLegend
          views={filteredViews}
          hiddenSeries={hiddenSeries}
          hoveredSeries={hoveredSeries}
          onToggleSeries={toggleSeries}
          onHoverSeries={setHoveredSeries}
          mobileDropdown
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

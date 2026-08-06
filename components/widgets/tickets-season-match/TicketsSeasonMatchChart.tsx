"use client";

import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartZoomReferenceArea,
  CHART_ZOOM_SURFACE_CLASS,
} from "@/components/charts/ChartZoom";
import { useChartAreaZoom } from "@/hooks/useChartAreaZoom";
import {
  buildSeasonMatchXAxisTicks,
  formatSeasonMatchDateLabel,
  formatSeasonMatchYAxisTick,
  getSeasonMatchChartScrollLeft,
  getSeasonMatchChartWidth,
  getSeasonMatchLineOpacity,
  getSeasonMatchStrokeWidth,
  getSeasonMatchYDomainKeys,
  pickBrightSeasonMatchIds,
  seasonMatchFactKey,
  seasonMatchPlanKey,
} from "@/lib/tickets-season-match-chart";
import type {
  TicketsSeasonMatchChartRow,
  TicketsSeasonMatchSeriesView,
} from "@/types/dashboard";
import { TicketsSeasonMatchPlanMarker } from "./TicketsSeasonMatchPlanMarker";
import { TicketsSeasonMatchTooltip } from "./TicketsSeasonMatchTooltip";

type ChartZoomControl = {
  isZoomed: boolean;
  resetZoom: () => void;
};

export function TicketsSeasonMatchChart({
  rows,
  views,
  hiddenSeries,
  hoveredSeries,
  chartHeight,
  selectedMatchId,
  onZoomStateChange,
}: {
  rows: TicketsSeasonMatchChartRow[];
  views: TicketsSeasonMatchSeriesView[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  chartHeight: number;
  selectedMatchId?: string | null;
  onZoomStateChange?: (control: ChartZoomControl | null) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrolledMatchIdRef = useRef<string | null>(null);
  const visibleViews = useMemo(
    () => views.filter((view) => !hiddenSeries.has(view.matchId)),
    [views, hiddenSeries],
  );

  const comparisonMode = useMemo(
    () => visibleViews.some((view) => view.isSelected),
    [visibleViews],
  );

  const brightMatchIds = useMemo(
    () => pickBrightSeasonMatchIds(visibleViews),
    [visibleViews],
  );

  const yDomainKeys = useMemo(
    () => getSeasonMatchYDomainKeys(visibleViews),
    [visibleViews],
  );

  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(rows, yDomainKeys, [rows, visibleViews], {
    xKey: "dateKey",
  });

  useEffect(() => {
    onZoomStateChange?.({ isZoomed, resetZoom });
    return () => onZoomStateChange?.(null);
  }, [isZoomed, resetZoom, onZoomStateChange]);

  const chartWidth = getSeasonMatchChartWidth(displayData);
  const xTicks = buildSeasonMatchXAxisTicks(displayData);

  useEffect(() => {
    if (!selectedMatchId) {
      scrolledMatchIdRef.current = null;
      return;
    }

    if (!comparisonMode || isZoomed || displayData.length === 0) {
      return;
    }

    const selectedView = visibleViews.find(
      (view) => view.matchId === selectedMatchId && view.isSelected,
    );
    if (!selectedView) return;

    const matchChanged = scrolledMatchIdRef.current !== selectedMatchId;
    if (!matchChanged) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    scrolledMatchIdRef.current = selectedMatchId;

    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollLeft = getSeasonMatchChartScrollLeft(
        selectedView.salesStartDateKey,
        displayData,
        chartWidth,
        container.clientWidth,
      );

      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    });
  }, [
    selectedMatchId,
    comparisonMode,
    isZoomed,
    chartWidth,
    displayData,
    visibleViews,
  ]);

  if (visibleViews.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Все линии скрыты. Выберите матч в легенде ниже.
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full min-w-0 overflow-x-auto overflow-y-hidden"
    >
      <div
        className={clsx("relative", CHART_ZOOM_SURFACE_CLASS)}
        style={{ width: chartWidth, minWidth: chartWidth, height: chartHeight }}
      >
        <ResponsiveContainer width={chartWidth} height={chartHeight}>
          <LineChart
            data={displayData}
            margin={{ top: 20, right: 20, left: 4, bottom: 8 }}
            {...chartHandlers}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
            <XAxis
              dataKey="dateKey"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={xTicks}
              tickFormatter={(value) => formatSeasonMatchDateLabel(Number(value))}
              tick={{ fontSize: 10, fill: "#8B8B8E" }}
              tickMargin={6}
              minTickGap={24}
              height={32}
            />
            <YAxis
              domain={yDomain}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#8B8B8E" }}
              width={52}
              tickFormatter={formatSeasonMatchYAxisTick}
            />
            <Tooltip
              content={<TicketsSeasonMatchTooltip views={visibleViews} />}
              labelFormatter={(value) =>
                formatSeasonMatchDateLabel(Number(value))
              }
            />
            <ChartZoomReferenceArea selectionArea={selectionArea} />
            {visibleViews.flatMap((view) => {
              const factKey = seasonMatchFactKey(view.matchId);
              const planKey = seasonMatchPlanKey(view.matchId);
              const opacity = getSeasonMatchLineOpacity(view, {
                hidden: false,
                hoveredMatchId: hoveredSeries,
                brightMatchIds,
                comparisonMode,
              });
              const strokeWidth = getSeasonMatchStrokeWidth(
                view,
                hoveredSeries,
              );
              const elements = [];

              if (view.hasFactSales || view.isOnSale) {
                elements.push(
                  <Line
                    key={`${view.matchId}-fact`}
                    type="monotone"
                    dataKey={factKey}
                    name={view.legendLabel}
                    stroke={view.color}
                    strokeWidth={strokeWidth}
                    strokeOpacity={opacity}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                    legendType="none"
                  />,
                );
              }

              elements.push(
                <Line
                  key={`${view.matchId}-plan`}
                  type="monotone"
                  dataKey={planKey}
                  name={view.legendLabel}
                  stroke="none"
                  dot={({ key, ...props }) => (
                    <TicketsSeasonMatchPlanMarker
                      key={key}
                      {...props}
                      color={view.color}
                      matchId={view.matchId}
                      visible={opacity > 0.15}
                    />
                  )}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />,
              );

              return elements;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

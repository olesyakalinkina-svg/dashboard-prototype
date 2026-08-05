"use client";

import { useEffect, useMemo } from "react";
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
  onZoomStateChange,
}: {
  rows: TicketsSeasonMatchChartRow[];
  views: TicketsSeasonMatchSeriesView[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  chartHeight: number;
  onZoomStateChange?: (control: ChartZoomControl | null) => void;
}) {
  const visibleViews = useMemo(
    () => views.filter((view) => !hiddenSeries.has(view.matchId)),
    [views, hiddenSeries],
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

  if (visibleViews.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Все линии скрыты. Выберите матч в легенде ниже.
      </div>
    );
  }

  return (
    <div className="h-full min-w-0 overflow-x-auto overflow-y-hidden">
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
              label={{
                value: "Продажи билетов, тыс. ₽",
                angle: -90,
                position: "insideLeft",
                offset: 8,
                style: { fontSize: 11, fill: "#8B8B8E", fontWeight: 500 },
              }}
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

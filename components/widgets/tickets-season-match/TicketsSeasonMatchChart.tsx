"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  CartesianGrid,
  Customized,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { AdaptiveTooltip } from "@/components/charts/AdaptiveTooltip";
import {
  ChartZoomReferenceArea,
  CHART_ZOOM_SURFACE_CLASS,
} from "@/components/charts/ChartZoom";
import { useChartAreaZoom } from "@/hooks/useChartAreaZoom";
import {
  buildSeasonMatchXAxisTicks,
  formatSeasonMatchAxisLabel,
  formatSeasonMatchDateLabel,
  formatSeasonMatchYAxisTick,
  getSeasonMatchAxisTickOffsets,
  getSeasonMatchChartScrollLeft,
  getSeasonMatchChartWidth,
  getSeasonMatchLineOpacity,
  getSeasonMatchStrokeWidth,
  getSeasonMatchYDomainKeys,
  pickBrightSeasonMatchIds,
  seasonMatchFactKey,
  seasonMatchPlanKey,
  SEASON_MATCH_AXIS_MIN_TICK_GAP_PX,
  SEASON_MATCH_AXIS_TICK_HEIGHT,
  SEASON_MATCH_CHART_MARGIN,
  SEASON_MATCH_CHART_MOBILE_MAX_WIDTH,
} from "@/lib/tickets-season-match-chart";
import {
  placeSeasonMatchEndMarkers,
  placeSeasonMatchHoverMarkers,
  SEASON_MATCH_MARKER_RADIUS,
  SEASON_MATCH_MARKER_STROKE,
  type HoverMarkerSeries,
  type SeasonMatchGraphicalItem,
} from "./season-match-marker-offset";
import type {
  TicketsSeasonMatchChartRow,
  TicketsSeasonMatchSeriesView,
  TimeGrouping,
} from "@/types/dashboard";
import { SeasonMatchPlanDot } from "./TicketsSeasonMatchPlanMarker";
import { TicketsSeasonMatchTooltip } from "./TicketsSeasonMatchTooltip";

type ChartZoomControl = {
  isZoomed: boolean;
  resetZoom: () => void;
};

type ChartOffset = {
  top?: number;
  height?: number;
};

function SeasonMatchChartMarkers({
  endSeries,
  hoverSeries,
  formattedGraphicalItems,
  activeTooltipIndex,
  isTooltipActive,
  offset,
}: {
  endSeries: readonly HoverMarkerSeries[];
  hoverSeries: readonly HoverMarkerSeries[];
  formattedGraphicalItems?: readonly SeasonMatchGraphicalItem[];
  activeTooltipIndex?: number;
  isTooltipActive?: boolean;
  offset?: ChartOffset;
}) {
  const minY =
    offset?.top != null ? offset.top + SEASON_MATCH_MARKER_RADIUS : undefined;
  const maxY =
    offset?.top != null && offset.height != null
      ? offset.top + offset.height - SEASON_MATCH_MARKER_RADIUS
      : undefined;
  const bounds = { minY, maxY };

  const endMarkers = placeSeasonMatchEndMarkers(
    formattedGraphicalItems,
    endSeries,
    bounds,
  );
  const hoverMarkers =
    isTooltipActive && activeTooltipIndex != null && activeTooltipIndex >= 0
      ? placeSeasonMatchHoverMarkers(
          formattedGraphicalItems,
          activeTooltipIndex,
          hoverSeries,
          bounds,
        )
      : [];

  if (endMarkers.length === 0 && hoverMarkers.length === 0) return null;

  return (
    <g className="recharts-season-match-markers" pointerEvents="none">
      {endMarkers.map((marker) => (
        <SeasonMatchPlanDot
          key={marker.id}
          cx={marker.cx}
          cy={marker.cy}
          color={marker.color}
          markerId={marker.id}
        />
      ))}
      {hoverMarkers.map((marker) => (
        <circle
          key={`hover-${marker.id}`}
          cx={marker.cx}
          cy={marker.cy}
          r={SEASON_MATCH_MARKER_RADIUS}
          fill={marker.color}
          stroke="#fff"
          strokeWidth={SEASON_MATCH_MARKER_STROKE}
        />
      ))}
    </g>
  );
}

function SeasonMatchXAxisTick({
  x = 0,
  y = 0,
  payload,
  offsets,
  rows,
  matchDateKeys,
}: {
  x?: number;
  y?: number;
  payload?: { value?: number };
  offsets: Map<number, number>;
  rows: TicketsSeasonMatchChartRow[];
  matchDateKeys: number[];
}) {
  const dateKey = Number(payload?.value);
  if (!Number.isFinite(dateKey)) return null;

  const label = formatSeasonMatchAxisLabel(dateKey, rows, matchDateKeys);
  const stagger = offsets.get(dateKey) ?? 0;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12 + stagger}
        textAnchor="middle"
        fill="#8B8B8E"
        fontSize={11}
      >
        {label}
      </text>
    </g>
  );
}

export function TicketsSeasonMatchChart({
  rows,
  views,
  hiddenSeries,
  hoveredSeries,
  chartHeight,
  selectedMatchId,
  timeGrouping = "day",
  onZoomStateChange,
}: {
  rows: TicketsSeasonMatchChartRow[];
  views: TicketsSeasonMatchSeriesView[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  chartHeight: number;
  selectedMatchId?: string | null;
  timeGrouping?: TimeGrouping;
  onZoomStateChange?: (control: ChartZoomControl | null) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrolledMatchIdRef = useRef<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const updateMobile = () => setIsMobileViewport(media.matches);
    updateMobile();
    media.addEventListener("change", updateMobile);
    return () => media.removeEventListener("change", updateMobile);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setViewportWidth(container.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const chartWidth = useMemo(
    () =>
      getSeasonMatchChartWidth(displayData, {
        maxWidth: isMobileViewport
          ? SEASON_MATCH_CHART_MOBILE_MAX_WIDTH
          : undefined,
        containerWidth: viewportWidth > 0 ? viewportWidth : undefined,
      }),
    [displayData, isMobileViewport, viewportWidth],
  );
  const fillsContainer =
    viewportWidth === 0 || chartWidth <= viewportWidth;

  const matchDateKeys = useMemo(
    () => visibleViews.map((view) => view.matchDateKey),
    [visibleViews],
  );

  const xTicks = useMemo(
    () =>
      buildSeasonMatchXAxisTicks(displayData, {
        grouping: timeGrouping,
        matchDateKeys,
        chartWidth,
      }),
    [displayData, timeGrouping, matchDateKeys, chartWidth],
  );
  const tickOffsets = useMemo(
    () => getSeasonMatchAxisTickOffsets(xTicks, displayData, chartWidth),
    [xTicks, displayData, chartWidth],
  );
  const hoverMarkerSeries = useMemo(
    () =>
      visibleViews
        .filter((view) => view.hasFactSales || view.isOnSale)
        .map((view) => ({
          dataKey: seasonMatchFactKey(view.matchId),
          color: view.color,
        })),
    [visibleViews],
  );
  const endMarkerSeries = useMemo(
    () =>
      visibleViews
        .filter((view) => {
          const opacity = getSeasonMatchLineOpacity(view, {
            hidden: false,
            hoveredMatchId: hoveredSeries,
            brightMatchIds,
            comparisonMode,
          });
          return opacity > 0.15;
        })
        .map((view) => ({
          dataKey: seasonMatchPlanKey(view.matchId),
          color: view.color,
        })),
    [visibleViews, hoveredSeries, brightMatchIds, comparisonMode],
  );

  const formatTooltipLabel = (value: number) => {
    const dateKey = Number(value);
    const row = displayData.find((entry) => entry.dateKey === dateKey);
    return row?.periodLabel ?? formatSeasonMatchDateLabel(dateKey);
  };

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
      className={clsx(
        "h-full min-w-0 max-w-full",
        fillsContainer
          ? "overflow-visible"
          : "overflow-x-auto overflow-y-hidden overscroll-x-contain",
      )}
    >
      <div
        className={clsx("relative max-w-full", CHART_ZOOM_SURFACE_CLASS)}
        style={{
          width: fillsContainer ? "100%" : chartWidth,
          minWidth:
            isMobileViewport || viewportWidth === 0 ? undefined : chartWidth,
          maxWidth: isMobileViewport
            ? SEASON_MATCH_CHART_MOBILE_MAX_WIDTH
            : undefined,
          height: chartHeight,
        }}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart
            data={displayData}
            margin={{ ...SEASON_MATCH_CHART_MARGIN }}
            {...chartHandlers}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
            <XAxis
              dataKey="dateKey"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={xTicks}
              tick={(props) => (
                <SeasonMatchXAxisTick
                  {...props}
                  offsets={tickOffsets}
                  rows={displayData}
                  matchDateKeys={matchDateKeys}
                />
              )}
              tickMargin={6}
              interval={0}
              minTickGap={SEASON_MATCH_AXIS_MIN_TICK_GAP_PX}
              padding={{ left: 0, right: 0 }}
              height={SEASON_MATCH_AXIS_TICK_HEIGHT}
            />
            <YAxis
              domain={yDomain}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#8B8B8E" }}
              width={52}
              tickFormatter={formatSeasonMatchYAxisTick}
            />
            <AdaptiveTooltip
              content={<TicketsSeasonMatchTooltip views={visibleViews} />}
              labelFormatter={formatTooltipLabel}
              cursor={{ stroke: "#8B8B8E", strokeDasharray: "3 3" }}
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
                    activeDot={false}
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
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />,
              );

              return elements;
            })}
            <Customized
              component={(chartProps: {
                formattedGraphicalItems?: readonly SeasonMatchGraphicalItem[];
                activeTooltipIndex?: number;
                isTooltipActive?: boolean;
                offset?: ChartOffset;
              }) => (
                <SeasonMatchChartMarkers
                  endSeries={endMarkerSeries}
                  hoverSeries={hoverMarkerSeries}
                  formattedGraphicalItems={chartProps.formattedGraphicalItems}
                  activeTooltipIndex={chartProps.activeTooltipIndex}
                  isTooltipActive={chartProps.isTooltipActive}
                  offset={chartProps.offset}
                />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

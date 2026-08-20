"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
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
import type { CampaignPacePoint } from "@/lib/subscription-campaign";
import {
  formatCampaignCountAxis,
  formatCampaignMoneyAxis,
} from "@/lib/subscription-campaign";
import {
  END_LABEL_EDGE_PAD,
  END_LABEL_FONT_SIZE,
  lastPointForDataKey,
  placeEndLabels,
  type FormattedGraphicalItem,
} from "@/components/widgets/subscription-campaign/campaign-pace-end-labels";
import {
  CAMPAIGN_PACE_BENCHMARK_COLOR,
  CAMPAIGN_PACE_MAIN_COLOR,
  CampaignPaceTooltip,
  type CampaignPaceHighlight,
} from "@/components/widgets/subscription-campaign/CampaignPaceTooltip";

function lastNonNullIndex(
  points: readonly CampaignPacePoint[],
  key: "currentSeasonCount" | "benchmarkSeasonCount" | "currentSeasonRevenue" | "benchmarkSeasonRevenue",
): number {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index][key] != null) return index;
  }
  return -1;
}

function campaignDayTicks(maxDay: number): number[] {
  if (maxDay <= 1) return [1];
  const step = maxDay <= 12 ? 1 : 5;
  const ticks = [1];
  for (let day = step; day < maxDay; day += step) {
    if (day !== 1) ticks.push(day);
  }
  if (ticks[ticks.length - 1] !== maxDay) ticks.push(maxDay);
  return ticks;
}

type DotProps = {
  cx?: number;
  cy?: number;
  index?: number;
};

function renderEndpointDot(
  lastIndex: number,
  color: string,
  shape: "circle" | "square",
) {
  return function EndpointDot({ cx, cy, index }: DotProps) {
    const markerKey = `${color}-${index ?? 0}`;
    if (cx == null || cy == null || index !== lastIndex || lastIndex < 0) {
      return <g key={markerKey} />;
    }

    return (
      <g key={markerKey}>
        {shape === "square" ? (
          <rect
            x={cx - 4}
            y={cy - 4}
            width={8}
            height={8}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ) : (
          <circle
            cx={cx}
            cy={cy}
            r={4}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        )}
      </g>
    );
  };
}

type EndLabelSeries = {
  dataKey: string;
  text: string | null;
  fill: string;
};

type ChartOffset = {
  top?: number;
  height?: number;
};

function CampaignPaceEndLabels({
  series,
  formattedGraphicalItems,
  offset,
  width,
}: {
  series: EndLabelSeries[];
  formattedGraphicalItems?: readonly FormattedGraphicalItem[];
  offset?: ChartOffset;
  width?: number;
  height?: number;
}) {
  if (width == null || width <= 0 || offset?.top == null || offset.height == null) {
    return null;
  }

  const anchors = series.flatMap((item) => {
    if (!item.text) return [];
    const point = lastPointForDataKey(formattedGraphicalItems, item.dataKey);
    if (!point) return [];
    return [
      {
        id: item.dataKey,
        cx: point.cx,
        cy: point.cy,
        text: item.text,
        fill: item.fill,
      },
    ];
  });

  if (anchors.length === 0) return null;

  const placed = placeEndLabels(anchors, {
    left: END_LABEL_EDGE_PAD,
    right: width - END_LABEL_EDGE_PAD,
    top: END_LABEL_EDGE_PAD,
    bottom: offset.top + offset.height - END_LABEL_EDGE_PAD,
  });

  return (
    <g className="recharts-campaign-pace-end-labels" pointerEvents="none">
      {placed.map((label) => (
        <text
          key={label.id}
          x={label.x}
          y={label.y}
          textAnchor={label.textAnchor}
          dominantBaseline="central"
          fontSize={END_LABEL_FONT_SIZE}
          fill={label.fill}
          stroke="#fff"
          strokeWidth={2.5}
          paintOrder="stroke"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {label.text}
        </text>
      ))}
    </g>
  );
}

export function CampaignPaceChart({
  points,
  highlight,
  mainSeasonName,
  benchmarkSeasonName,
}: {
  points: readonly CampaignPacePoint[];
  highlight: CampaignPaceHighlight;
  mainSeasonName: string;
  benchmarkSeasonName: string;
}) {
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  const currentKey =
    highlight === "count" ? "currentSeasonCount" : "currentSeasonRevenue";
  const benchmarkKey =
    highlight === "count" ? "benchmarkSeasonCount" : "benchmarkSeasonRevenue";

  const lastCurrent = lastNonNullIndex(points, currentKey);
  const lastBenchmark = lastNonNullIndex(points, benchmarkKey);
  const ticks = useMemo(
    () => campaignDayTicks(points.at(-1)?.campaignDay ?? 1),
    [points],
  );

  const formatY =
    highlight === "count" ? formatCampaignCountAxis : formatCampaignMoneyAxis;

  const currentLabel =
    lastCurrent >= 0 ? formatY(points[lastCurrent][currentKey] ?? 0) : null;
  const benchmarkLabel =
    lastBenchmark >= 0
      ? formatY(points[lastBenchmark][benchmarkKey] ?? 0)
      : null;

  function handleChartClick(state: { activeTooltipIndex?: number | string | null }) {
    if (state?.activeTooltipIndex == null) return;
    const next = Number(state.activeTooltipIndex);
    setPinnedIndex((prev) => (prev === next ? null : next));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (points.length === 0) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setPinnedIndex((prev) => {
      const current = prev ?? 0;
      if (event.key === "ArrowLeft") return Math.max(0, current - 1);
      return Math.min(points.length - 1, current + 1);
    });
  }

  return (
    <div
      className="w-full min-w-0 outline-none"
      tabIndex={0}
      role="img"
      aria-label={
        highlight === "count"
          ? "График накопительного количества абонементов по дням кампании"
          : "График накопительной выручки по дням кампании"
      }
      onKeyDown={handleKeyDown}
    >
      <div className="h-[320px] w-full overflow-hidden sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points as CampaignPacePoint[]}
            margin={{ top: 20, right: 56, left: 4, bottom: 8 }}
            onClick={handleChartClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
            <XAxis
              dataKey="campaignDay"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              allowDecimals={false}
              height={28}
              tick={{ fontSize: 11, fill: "#8B8B8E" }}
              tickMargin={6}
            />
            <YAxis
              width={52}
              tick={{ fontSize: 11, fill: "#8B8B8E" }}
              tickFormatter={formatY}
            />
            <AdaptiveTooltip
              cursor={{ stroke: "#8B8B8E", strokeDasharray: "3 3" }}
              active={pinnedIndex != null ? true : undefined}
              defaultIndex={pinnedIndex ?? undefined}
              content={
                <CampaignPaceTooltip
                  mainSeasonName={mainSeasonName}
                  benchmarkSeasonName={benchmarkSeasonName}
                  highlight={highlight}
                />
              }
            />
            <Line
              type="linear"
              dataKey={currentKey}
              name={mainSeasonName}
              stroke={CAMPAIGN_PACE_MAIN_COLOR}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              legendType="line"
              dot={renderEndpointDot(
                lastCurrent,
                CAMPAIGN_PACE_MAIN_COLOR,
                "circle",
              )}
              activeDot={{ r: 5, fill: CAMPAIGN_PACE_MAIN_COLOR }}
            />
            <Line
              type="linear"
              dataKey={benchmarkKey}
              name={benchmarkSeasonName}
              stroke={CAMPAIGN_PACE_BENCHMARK_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              connectNulls={false}
              isAnimationActive={false}
              legendType="line"
              dot={renderEndpointDot(
                lastBenchmark,
                CAMPAIGN_PACE_BENCHMARK_COLOR,
                "square",
              )}
              activeDot={{
                r: 5,
                fill: CAMPAIGN_PACE_BENCHMARK_COLOR,
                strokeDasharray: undefined,
              }}
            />
            <Customized
              component={(chartProps: {
                formattedGraphicalItems?: readonly FormattedGraphicalItem[];
                offset?: ChartOffset;
                width?: number;
                height?: number;
              }) => (
                <CampaignPaceEndLabels
                  series={[
                    {
                      dataKey: currentKey,
                      text: currentLabel,
                      fill: CAMPAIGN_PACE_MAIN_COLOR,
                    },
                    {
                      dataKey: benchmarkKey,
                      text: benchmarkLabel,
                      fill: CAMPAIGN_PACE_BENCHMARK_COLOR,
                    },
                  ]}
                  formattedGraphicalItems={chartProps.formattedGraphicalItems}
                  offset={chartProps.offset}
                  width={chartProps.width}
                  height={chartProps.height}
                />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-[11px] text-[#8B8B8E]">день кампании</p>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--foreground)]">
        <li className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3.5 shrink-0"
            style={{ backgroundColor: CAMPAIGN_PACE_MAIN_COLOR }}
            aria-hidden
          />
          {mainSeasonName}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3.5 shrink-0 border-t-2 border-dashed"
            style={{ borderColor: CAMPAIGN_PACE_BENCHMARK_COLOR }}
            aria-hidden
          />
          {benchmarkSeasonName}
        </li>
      </ul>
    </div>
  );
}

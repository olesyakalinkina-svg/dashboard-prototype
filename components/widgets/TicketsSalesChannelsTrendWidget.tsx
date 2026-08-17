"use client";

import clsx from "clsx";
import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartScrollContainer } from "@/components/charts/ChartScrollContainer";
import {
  ChartZoomHint,
  ChartZoomReferenceArea,
  ChartZoomResetButton,
  CHART_ZOOM_SURFACE_CLASS,
} from "@/components/charts/ChartZoom";
import {
  getMerchTrendPeriodLabel,
  getMerchTrendXAxisProps,
} from "@/components/widgets/Charts";
import { useChartAreaZoom } from "@/hooks/useChartAreaZoom";
import {
  ALL_ORDER_SOURCES,
  ORDER_SOURCE_COLORS,
  ORDER_SOURCE_LABELS,
} from "@/lib/ticket-filter-options";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  OrderSource,
  TicketsSalesChannelTrendPoint,
  TimeGrouping,
} from "@/types/dashboard";

function ChannelTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
      {payload
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((entry) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      <p className="mt-1 border-t border-[var(--border)] pt-1 font-medium text-[var(--foreground)]">
        Итого: {formatCurrency(total)}
      </p>
    </div>
  );
}

export const TicketsSalesChannelsTrendWidget = memo(
  function TicketsSalesChannelsTrendWidget({
    data,
    timeGrouping,
    orderSource,
  }: {
    data: TicketsSalesChannelTrendPoint[];
    timeGrouping: TimeGrouping;
    orderSource: OrderSource | "all";
  }) {
  const activeSources = useMemo(() => {
    if (orderSource !== "all") {
      return [orderSource];
    }

    const sourceSet = new Set<OrderSource>();
    for (const point of data) {
      for (const [source, value] of Object.entries(point.channels)) {
        if (value > 0) {
          sourceSet.add(source as OrderSource);
        }
      }
    }
    return ALL_ORDER_SOURCES.filter((source) => sourceSet.has(source));
  }, [orderSource, data]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        period: getMerchTrendPeriodLabel(point, timeGrouping),
        ...point.channels,
      })),
    [data, timeGrouping],
  );

  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(chartData, activeSources, [data, timeGrouping, activeSources]);

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Динамика продаж по каналам продаж</CardTitle>
          <ChartZoomHint visible={!isZoomed} />
        </div>
        {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col">
        {chartData.length === 0 || activeSources.length === 0 ? (
          <div className="flex min-h-[280px] flex-1 items-center justify-center text-sm text-[var(--muted)] sm:min-h-[360px]">
            Нет данных по выбранным каналам
          </div>
        ) : (
          <ChartScrollContainer
            className={clsx(
              "h-[280px] sm:h-[360px]",
              CHART_ZOOM_SURFACE_CLASS,
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                {...chartHandlers}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
                <XAxis
                  {...getMerchTrendXAxisProps(timeGrouping)}
                  tick={{ fontSize: 11, fill: "#8B8B8E" }}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: "#8B8B8E" }}
                  width={48}
                  tickFormatter={(value) =>
                    value >= 1_000_000
                      ? `${(value / 1_000_000).toFixed(1)}M`
                      : value >= 1_000
                        ? `${Math.round(value / 1_000)}K`
                        : String(value)
                  }
                />
                <Tooltip content={<ChannelTrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                <ChartZoomReferenceArea selectionArea={selectionArea} />
                {activeSources.map((source) => (
                  <Line
                    key={source}
                    type="monotone"
                    dataKey={source}
                    name={ORDER_SOURCE_LABELS[source]}
                    stroke={ORDER_SOURCE_COLORS[source]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartScrollContainer>
        )}
      </CardContent>
    </Card>
  );
});

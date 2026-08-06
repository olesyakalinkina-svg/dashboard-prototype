"use client";

import clsx from "clsx";
import { useMemo } from "react";
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
import { useFilterState } from "@/context/FilterContext";
import { useChartAreaZoom } from "@/hooks/useChartAreaZoom";
import {
  ALL_PRICE_ZONE_GROUPS,
  PRICE_ZONE_GROUP_COLORS,
  getEffectiveTicketTimeGrouping,
  getPriceZoneGroup,
} from "@/lib/ticket-filter-options";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  PriceZoneGroup,
  TicketsPriceZoneTrendPoint,
} from "@/types/dashboard";

function ZoneTrendTooltip({
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

export function TicketsPriceZoneTrendWidget({
  data,
}: {
  data: TicketsPriceZoneTrendPoint[];
}) {
  const { ticketFilters } = useFilterState();
  const timeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);

  const activeGroups = useMemo(() => {
    if (ticketFilters.priceZone !== "all") {
      return [getPriceZoneGroup(ticketFilters.priceZone)];
    }

    const groupSet = new Set<PriceZoneGroup>();
    for (const point of data) {
      for (const [group, value] of Object.entries(point.groups)) {
        if (value > 0) {
          groupSet.add(group as PriceZoneGroup);
        }
      }
    }
    return ALL_PRICE_ZONE_GROUPS.filter((group) => groupSet.has(group));
  }, [ticketFilters.priceZone, data]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        period: getMerchTrendPeriodLabel(point, timeGrouping),
        ...point.groups,
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
  } = useChartAreaZoom(chartData, activeGroups, [data, timeGrouping, activeGroups]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Динамика продаж по секторам</CardTitle>
          <ChartZoomHint visible={!isZoomed} />
        </div>
        {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
      </CardHeader>
      <CardContent className="min-w-0">
        {chartData.length === 0 || activeGroups.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-[var(--muted)] sm:h-[360px]">
            Нет данных по выбранным секторам
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
                <Tooltip content={<ZoneTrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                <ChartZoomReferenceArea selectionArea={selectionArea} />
                {activeGroups.map((group) => (
                  <Line
                    key={group}
                    type="monotone"
                    dataKey={group}
                    name={group}
                    stroke={PRICE_ZONE_GROUP_COLORS[group]}
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
}

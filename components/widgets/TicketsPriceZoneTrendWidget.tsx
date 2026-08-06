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
  ALL_PRICE_ZONES,
  PRICE_ZONE_COLORS,
} from "@/lib/ticket-filter-options";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { PriceZone, TicketsPriceZoneTrendPoint, TimeGrouping } from "@/types/dashboard";

const TIME_GROUPING_OPTIONS: { value: TimeGrouping; label: string }[] = [
  { value: "day", label: "Дни" },
  { value: "week", label: "Недели" },
  { value: "month", label: "Месяцы" },
];

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
  const { ticketFilters, setTicketFilters } = useFilterState();
  const timeGrouping = ticketFilters.timeGrouping;

  const activeZones = useMemo(() => {
    if (ticketFilters.priceZone !== "all") {
      return [ticketFilters.priceZone];
    }

    const zoneSet = new Set<PriceZone>();
    for (const point of data) {
      for (const [zone, value] of Object.entries(point.zones)) {
        if (value > 0) {
          zoneSet.add(zone as PriceZone);
        }
      }
    }
    return ALL_PRICE_ZONES.filter((zone) => zoneSet.has(zone));
  }, [ticketFilters.priceZone, data]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        period: getMerchTrendPeriodLabel(point, timeGrouping),
        ...point.zones,
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
  } = useChartAreaZoom(chartData, activeZones, [data, timeGrouping, activeZones]);

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Динамика продаж по секторам</CardTitle>
          <ChartZoomHint visible={!isZoomed} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
          <div className="flex w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5 sm:w-auto">
            {TIME_GROUPING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTicketFilters({ timeGrouping: option.value })}
                className={clsx(
                  "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                  timeGrouping === option.value
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col">
        {chartData.length === 0 || activeZones.length === 0 ? (
          <div className="flex min-h-[280px] flex-1 items-center justify-center text-sm text-[var(--muted)] sm:min-h-[360px]">
            Нет данных по выбранным секторам
          </div>
        ) : (
          <ChartScrollContainer
            className={clsx(
              "min-h-[280px] flex-1 sm:min-h-[360px]",
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
                {activeZones.map((zone) => (
                  <Line
                    key={zone}
                    type="monotone"
                    dataKey={zone}
                    name={zone}
                    stroke={PRICE_ZONE_COLORS[zone]}
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

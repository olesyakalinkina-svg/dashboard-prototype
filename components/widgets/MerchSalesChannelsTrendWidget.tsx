"use client";

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
import { MERCH_SALES_POINT_LABELS, ALL_MERCH_SALES_POINTS } from "@/lib/merch-filter-options";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  MerchSalesChannelTrendPoint,
  MerchSalesPoint,
  TimeGrouping,
} from "@/types/dashboard";

const MERCH_CHANNEL_COLORS: Record<MerchSalesPoint, string> = {
  flagship: "#5282FF",
  arena_north: "#00BFA5",
  arena_south: "#26A69A",
  mall_raduga: "#FF7043",
  mall_continent: "#FFB300",
  online_store: "#7B61FF",
};

const TIME_GROUPING_SUBTITLES: Record<TimeGrouping, string> = {
  day: "по дням",
  week: "по неделям",
  month: "по месяцам",
  quarter: "по кварталам",
};

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

export function MerchSalesChannelsTrendWidget({
  data,
  channels,
  timeGrouping,
}: {
  data: MerchSalesChannelTrendPoint[];
  channels: MerchSalesPoint[];
  timeGrouping: TimeGrouping;
}) {
  const activeChannels = useMemo(() => {
    if (channels.length > 0) return channels;
    const channelSet = new Set<MerchSalesPoint>();
    for (const point of data) {
      for (const [channel, value] of Object.entries(point.channels)) {
        if (value > 0) {
          channelSet.add(channel as MerchSalesPoint);
        }
      }
    }
    return ALL_MERCH_SALES_POINTS.filter((channel) => channelSet.has(channel));
  }, [channels, data]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        period: point.period,
        ...point.channels,
      })),
    [data],
  );

  const compactAxis = chartData.length > 8;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>График продаж по каналам продаж</CardTitle>
        <p className="text-[11px] font-normal text-[var(--muted)]">
          Выручка {TIME_GROUPING_SUBTITLES[timeGrouping]} в разрезе каналов
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 || activeChannels.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-[var(--muted)] sm:h-[360px]">
            Нет данных по выбранным каналам
          </div>
        ) : (
          <div className="h-[280px] sm:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: compactAxis ? 8 : 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: "#8B8B8E" }}
                  interval="preserveStartEnd"
                  angle={compactAxis ? -35 : 0}
                  textAnchor={compactAxis ? "end" : "middle"}
                  height={compactAxis ? 50 : 30}
                />
                <YAxis
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
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeChannels.map((channel) => (
                  <Line
                    key={channel}
                    type="monotone"
                    dataKey={channel}
                    name={MERCH_SALES_POINT_LABELS[channel]}
                    stroke={MERCH_CHANNEL_COLORS[channel]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

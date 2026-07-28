"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import clsx from "clsx";
import { Card, CardContent } from "@/components/ui/Card";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ChartWidget } from "@/components/widgets/ChartWidget";
import type {
  ChannelMixPoint,
  SectorPoint,
  SubscriptionPlanStat,
  TimeGrouping,
  TopProductPoint,
  WeeklyPoint,
} from "@/types/dashboard";

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

const COLORS = {
  primary: "#5282FF",
  secondary: "#00BFA5",
  accent: "#7B61FF",
  warm: "#FF7043",
};

const SECTOR_COLORS = ["#5282FF", "#00BFA5", "#FF7043", "#FFB300"];

function ChartTooltip({
  active,
  payload,
  label,
  formatter = formatCurrency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function MerchRevenueTrendChart({
  data,
  className,
  color = COLORS.secondary,
  timeGrouping,
}: {
  data: WeeklyPoint[];
  className?: string;
  color?: string;
  timeGrouping?: TimeGrouping;
}) {
  const chartData =
    timeGrouping === "month" ? data.filter((d) => d.value !== 0) : data;

  return (
    <Card className={clsx("min-w-0", className)}>
      <CardContent className="flex h-full flex-col pt-4 pb-3">
        <div className="min-h-[120px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 4, bottom: 0, left: 0 }}
            >
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fill: "#8B8B8E" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                content={<ChartTooltip formatter={formatCurrency} />}
              />
              <Bar
                dataKey="value"
                name="Выручка"
                fill={color}
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value: number) => formatCompactCurrency(value)}
                  style={{ fontSize: 9, fill: "#8B8B8E" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyTrendChart({
  data,
  title,
  color = COLORS.primary,
}: {
  data: WeeklyPoint[];
  title: string;
  color?: string;
}) {
  return (
    <ChartWidget title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#8B8B8E" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#8B8B8E" }}
            tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            content={<ChartTooltip formatter={formatCurrency} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="Выручка"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWidget>
  );
}

export function MatchBarChart({
  data,
  title,
  color = COLORS.primary,
}: {
  data: { match: string; value: number }[];
  title: string;
  color?: string;
}) {
  return (
    <ChartWidget title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
          <XAxis dataKey="match" tick={{ fontSize: 11, fill: "#8B8B8E" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#8B8B8E" }}
            tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
          />
          <Bar dataKey="value" name="Выручка" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWidget>
  );
}

export function SectorPieChart({ data }: { data: SectorPoint[] }) {
  return (
    <ChartWidget title="Продажи по ценовым зонам">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="sector"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            label={({ sector, value }) => `${sector}: ${value}`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartWidget>
  );
}

export function ChannelMixChart({
  data,
  title,
  compact = false,
}: {
  data: ChannelMixPoint[];
  title: string;
  compact?: boolean;
}) {
  return (
    <ChartWidget title={title} height={compact ? 170 : 280} compact={compact}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={compact ? { top: 0, right: 8, bottom: 0, left: 0 } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
          <XAxis
            type="number"
            tick={{ fontSize: compact ? 10 : 11, fill: "#8B8B8E" }}
          />
          <YAxis
            type="category"
            dataKey="channel"
            width={compact ? 80 : 100}
            tick={{ fontSize: compact ? 10 : 11, fill: "#8B8B8E" }}
          />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Bar dataKey="value" name="Выручка" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWidget>
  );
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  return (
    <ChartWidget title="Топ товаров по выручке">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#8B8B8E" }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 10, fill: "#8B8B8E" }}
          />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Bar dataKey="revenue" name="Выручка" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWidget>
  );
}

export function SubscriptionPlansChart({
  data,
  compact = false,
}: {
  data: SubscriptionPlanStat[];
  compact?: boolean;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.revenue - a.revenue),
    [data],
  );

  const maxRevenue = useMemo(
    () => Math.max(...sorted.map((d) => d.revenue), 0),
    [sorted],
  );

  const maxSold = useMemo(
    () => Math.max(...sorted.map((d) => d.sold), 0),
    [sorted],
  );

  const rowHeight = compact ? 40 : 52;
  const chartHeight = compact
    ? Math.max(140, sorted.length * rowHeight + 8)
    : Math.max(160, sorted.length * rowHeight + 8);

  return (
    <ChartWidget
      title="Продажи по тарифам"
      height={chartHeight}
      compact={compact}
    >
      <div
        className={clsx(
          "flex h-full flex-col justify-center py-1",
          compact ? "gap-2" : "gap-3",
        )}
      >
        {sorted.map((item) => (
          <div
            key={item.plan}
            className={clsx("flex items-center", compact ? "gap-2" : "gap-3")}
          >
            <span
              className={clsx(
                "shrink-0 truncate font-medium text-[var(--foreground)]",
                compact ? "w-[110px] text-[11px]" : "w-[140px] text-xs",
              )}
              title={item.plan}
            >
              {item.plan}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <InlineBarCell
                value={item.revenue}
                max={maxRevenue}
                formatted={formatCurrency(item.revenue)}
                barClassName="bg-red-400"
              />
              <InlineBarCell
                value={item.sold}
                max={maxSold}
                formatted={`${formatNumber(item.sold)} шт`}
                barClassName="bg-gray-300"
              />
            </div>
          </div>
        ))}
      </div>
    </ChartWidget>
  );
}

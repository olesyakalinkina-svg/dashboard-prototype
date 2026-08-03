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
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { ChartWidget } from "@/components/widgets/ChartWidget";
import type {
  ChannelMixPoint,
  MerchSalesChannelPoint,
  MerchProductCategory,
  MerchProductCategoryPoint,
  MerchSalesPoint,
  OrderSource,
  OrderSourceSalesPoint,
  PriceZoneSalesPoint,
  SectorPoint,
  SubscriptionPlanStat,
  TicketType,
  TicketTypeSalesPoint,
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

const MERCH_CHANNEL_COLORS: Record<MerchSalesPoint, string> = {
  flagship: "#5282FF",
  arena_north: "#00BFA5",
  arena_south: "#26A69A",
  mall_raduga: "#FF7043",
  mall_continent: "#FFB300",
  online_store: "#7B61FF",
};

const MERCH_CATEGORY_COLORS: Record<MerchProductCategory, string> = {
  jerseys: "#5282FF",
  souvenirs: "#FF7043",
  drinkware: "#FFB300",
  apparel: "#EC407A",
  accessories: "#8D6E63",
};

const TICKET_TYPE_COLORS: Record<TicketType, string> = {
  arena: "#5282FF",
  parking: "#00BFA5",
};

const ORDER_SOURCE_COLORS: Record<OrderSource, string> = {
  box_office: "#5282FF",
  official_site: "#00BFA5",
  yandex_afisha: "#FF7043",
};

const PRICE_ZONE_BAR_GRADIENT = `linear-gradient(to right, #93c5fd, ${COLORS.primary})`;

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

export function getMerchChartsRowHeight(
  topProducts: TopProductPoint[],
  channels: MerchSalesChannelPoint[],
  categories?: MerchProductCategoryPoint[],
): number {
  const topProductsHeight = Math.max(300, topProducts.length * 36 + 48);
  const channelsHeight = Math.max(300, channels.length * 48 + 72);
  const categoriesHeight = categories
    ? Math.max(300, categories.length * 48 + 72)
    : 0;
  return Math.max(topProductsHeight, channelsHeight, categoriesHeight);
}

export function MerchSalesChannelsChart({
  data,
  className,
  height,
  fillHeight = false,
}: {
  data: MerchSalesChannelPoint[];
  className?: string;
  height?: number;
  fillHeight?: boolean;
}) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data],
  );
  const chartHeight = height ?? Math.max(300, data.length * 48 + 72);

  if (data.length === 0) {
    return (
      <ChartWidget
        title="Выручка по каналам продаж"
        height={chartHeight}
        className={className}
        fillHeight={fillHeight}
      >
        <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
          Нет данных по выбранным каналам
        </div>
      </ChartWidget>
    );
  }

  return (
    <ChartWidget
      title="Выручка по каналам продаж"
      height={chartHeight}
      className={className}
      fillHeight={fillHeight}
    >
      <div className="flex h-full flex-col gap-5 lg:flex-row">
        <div className="h-[220px] min-w-0 flex-1 lg:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="channel"
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={92}
                paddingAngle={2}
              >
                {data.map((item) => (
                  <Cell
                    key={item.channelKey}
                    fill={MERCH_CHANNEL_COLORS[item.channelKey]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          {data.map((item) => (
            <div key={item.channelKey} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-2 font-medium text-[var(--foreground)]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: MERCH_CHANNEL_COLORS[item.channelKey],
                    }}
                  />
                  <span className="truncate">{item.channel}</span>
                </span>
                <span className="whitespace-nowrap text-[var(--muted)]">
                  {item.share.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-6 overflow-hidden rounded-sm bg-[#f0f0f2]">
                <div
                  className="absolute left-0 top-0 h-full rounded-sm"
                  style={{
                    width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                    minWidth: item.value > 0 ? "2.75rem" : undefined,
                    backgroundColor: MERCH_CHANNEL_COLORS[item.channelKey],
                  }}
                />
                <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium tabular-nums text-[var(--foreground)]">
                  {formatCurrency(item.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartWidget>
  );
}

export function MerchProductCategoriesChart({
  data,
  className,
  height,
  fillHeight = false,
}: {
  data: MerchProductCategoryPoint[];
  className?: string;
  height?: number;
  fillHeight?: boolean;
}) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data],
  );
  const chartHeight = height ?? Math.max(300, data.length * 48 + 72);

  if (data.length === 0) {
    return (
      <ChartWidget
        title="Выручка по товарным категориям"
        height={chartHeight}
        className={className}
        fillHeight={fillHeight}
      >
        <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
          Нет данных по выбранным фильтрам
        </div>
      </ChartWidget>
    );
  }

  return (
    <ChartWidget
      title="Выручка по товарным категориям"
      height={chartHeight}
      className={className}
      fillHeight={fillHeight}
    >
      <div className="flex h-full flex-col gap-5 lg:flex-row">
        <div className="h-[220px] min-w-0 flex-1 lg:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={92}
                paddingAngle={2}
              >
                {data.map((item) => (
                  <Cell
                    key={item.categoryKey}
                    fill={MERCH_CATEGORY_COLORS[item.categoryKey]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          {data.map((item) => (
            <div key={item.categoryKey} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-2 font-medium text-[var(--foreground)]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: MERCH_CATEGORY_COLORS[item.categoryKey],
                    }}
                  />
                  <span className="truncate">{item.category}</span>
                </span>
                <span className="whitespace-nowrap text-[var(--muted)]">
                  {item.share.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-6 overflow-hidden rounded-sm bg-[#f0f0f2]">
                <div
                  className="absolute left-0 top-0 h-full rounded-sm"
                  style={{
                    width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                    minWidth: item.value > 0 ? "2.75rem" : undefined,
                    backgroundColor: MERCH_CATEGORY_COLORS[item.categoryKey],
                  }}
                />
                <span className="relative z-10 flex h-full items-center justify-between gap-2 px-2 text-xs font-medium tabular-nums text-[var(--foreground)]">
                  <span>{formatCurrency(item.value)}</span>
                  <span className="text-[var(--muted)]">
                    {formatNumber(item.units)} шт.
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
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
            width={compact ? 64 : 80}
            tick={{ fontSize: compact ? 9 : 10, fill: "#8B8B8E" }}
          />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Bar dataKey="value" name="Выручка" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWidget>
  );
}

export function TopProductsChart({
  data,
  className,
  height,
  fillHeight = false,
}: {
  data: TopProductPoint[];
  className?: string;
  height?: number;
  fillHeight?: boolean;
}) {
  const chartHeight = height ?? Math.max(300, data.length * 36 + 48);

  return (
    <ChartWidget
      title="Топ товаров по выручке"
      height={chartHeight}
      className={className}
      fillHeight={fillHeight}
    >
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
            width={90}
            tick={{ fontSize: 9, fill: "#8B8B8E" }}
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
                compact ? "w-[88px] text-[10px]" : "w-[110px] text-xs sm:w-[140px]",
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

function TicketBreakdownEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}

export function getTicketsBreakdownRowHeight(): number {
  const pieChartHeight = 260;
  const priceZoneHeight = Math.max(260, 14 * 28 + 48);
  return Math.max(pieChartHeight * 2 + 16, priceZoneHeight);
}

function BreakdownPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: TicketTypeSalesPoint | OrderSourceSalesPoint;
  }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{item.label}</p>
      <p className="text-[var(--foreground)]">
        Выручка: {formatCurrency(item.revenue)}
      </p>
      <p className="text-[var(--muted)]">
        План: {formatCurrency(item.planRevenue)}
      </p>
      <p className="text-[var(--muted)]">
        Билеты: {formatNumber(item.tickets)} / {formatNumber(item.planTickets)} шт
      </p>
      <p
        className={clsx(
          "font-medium",
          item.fulfillmentPct >= 100
            ? "text-emerald-600"
            : item.fulfillmentPct >= 85
              ? "text-[var(--foreground)]"
              : "text-amber-600",
        )}
      >
        Выполнение: {formatPercent(item.fulfillmentPct)}
      </p>
    </div>
  );
}

export function TicketTypeSalesChart({
  data,
  compact = true,
  refreshKey,
}: {
  data: TicketTypeSalesPoint[];
  compact?: boolean;
  refreshKey?: string;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.revenue - a.revenue),
    [data],
  );
  const chartHeight = compact ? 260 : 280;

  if (sorted.length === 0) {
    return (
      <ChartWidget
        title="Тип билета"
        height={chartHeight}
        compact={compact}
        refreshKey={refreshKey}
      >
        <TicketBreakdownEmpty message="Нет данных по типам билетов" />
      </ChartWidget>
    );
  }

  return (
    <ChartWidget
      title="Тип билета"
      height={chartHeight}
      compact={compact}
      refreshKey={refreshKey}
    >
      <div className="flex h-full flex-col gap-4 sm:flex-row">
        <div className="h-[180px] min-w-0 flex-1 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sorted}
                dataKey="revenue"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
              >
                {sorted.map((item) => (
                  <Cell key={item.type} fill={TICKET_TYPE_COLORS[item.type]} />
                ))}
              </Pie>
              <Tooltip content={<BreakdownPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
          {sorted.map((item) => (
            <div key={item.type} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 font-medium text-[var(--foreground)]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: TICKET_TYPE_COLORS[item.type] }}
                  />
                  {item.label}
                </span>
                <span className="whitespace-nowrap text-[var(--muted)]">
                  {item.share.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-6 overflow-hidden rounded-sm bg-[#f0f0f2]">
                <div
                  className="absolute left-0 top-0 h-full rounded-sm"
                  style={{
                    width: `${item.share}%`,
                    minWidth: item.revenue > 0 ? "2.75rem" : undefined,
                    backgroundColor: TICKET_TYPE_COLORS[item.type],
                  }}
                />
                <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium tabular-nums text-[var(--foreground)]">
                  {formatCurrency(item.revenue)} · {formatNumber(item.tickets)} шт
                </span>
              </div>
              <span
                className={clsx(
                  "block text-[10px] tabular-nums",
                  item.fulfillmentPct >= 100
                    ? "text-emerald-600"
                    : item.fulfillmentPct >= 85
                      ? "text-[var(--muted)]"
                      : "text-amber-600",
                )}
              >
                {formatPercent(item.fulfillmentPct)} плана
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartWidget>
  );
}

export function PriceZoneSalesChart({
  data,
  compact = true,
  refreshKey,
  fillHeight = false,
}: {
  data: PriceZoneSalesPoint[];
  compact?: boolean;
  refreshKey?: string;
  fillHeight?: boolean;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.tickets - a.tickets),
    [data],
  );
  const maxTickets = useMemo(
    () => Math.max(...sorted.map((d) => d.tickets), 0),
    [sorted],
  );
  const rowHeight = compact ? 28 : 32;
  const chartHeight = Math.max(compact ? 260 : 280, sorted.length * rowHeight + 48);

  if (sorted.length === 0) {
    return (
      <ChartWidget
        title="Ценовая зона"
        height={chartHeight}
        compact={compact}
        fillHeight={fillHeight}
        refreshKey={refreshKey}
      >
        <TicketBreakdownEmpty message="Нет данных по ценовым зонам" />
      </ChartWidget>
    );
  }

  return (
    <ChartWidget
      title="Ценовая зона"
      height={chartHeight}
      compact={compact}
      fillHeight={fillHeight}
      refreshKey={refreshKey}
    >
      <div className="flex h-full flex-col justify-center gap-1.5 overflow-y-auto py-1">
        {sorted.map((item) => (
          <div key={item.zone} className="flex items-center gap-2">
            <span
              className="w-8 shrink-0 text-xs font-medium text-[var(--foreground)]"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="min-w-0 flex-1">
              <InlineBarCell
                value={item.tickets}
                max={maxTickets}
                formatted={`${formatNumber(item.tickets)} шт · ${formatCurrency(item.revenue)}`}
                barStyle={{ background: PRICE_ZONE_BAR_GRADIENT }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartWidget>
  );
}

export function OrderSourceSalesChart({
  data,
  compact = true,
  refreshKey,
}: {
  data: OrderSourceSalesPoint[];
  compact?: boolean;
  refreshKey?: string;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.revenue - a.revenue),
    [data],
  );
  const chartHeight = compact ? 260 : 280;

  if (sorted.length === 0) {
    return (
      <ChartWidget
        title="Источник заказа"
        height={chartHeight}
        compact={compact}
        refreshKey={refreshKey}
      >
        <TicketBreakdownEmpty message="Нет данных по источникам заказа" />
      </ChartWidget>
    );
  }

  return (
    <ChartWidget
      title="Источник заказа"
      height={chartHeight}
      compact={compact}
      refreshKey={refreshKey}
    >
      <div className="flex h-full flex-col gap-4 sm:flex-row">
        <div className="h-[180px] min-w-0 flex-1 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sorted}
                dataKey="revenue"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
              >
                {sorted.map((item) => (
                  <Cell
                    key={item.source}
                    fill={ORDER_SOURCE_COLORS[item.source]}
                  />
                ))}
              </Pie>
              <Tooltip content={<BreakdownPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
          {sorted.map((item) => (
            <div key={item.source} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 font-medium text-[var(--foreground)]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: ORDER_SOURCE_COLORS[item.source],
                    }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="whitespace-nowrap text-[var(--muted)]">
                  {item.share.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-6 overflow-hidden rounded-sm bg-[#f0f0f2]">
                <div
                  className="absolute left-0 top-0 h-full rounded-sm"
                  style={{
                    width: `${item.share}%`,
                    minWidth: item.revenue > 0 ? "2.75rem" : undefined,
                    backgroundColor: ORDER_SOURCE_COLORS[item.source],
                  }}
                />
                <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium tabular-nums text-[var(--foreground)]">
                  {formatCurrency(item.revenue)} · {formatNumber(item.tickets)} шт
                </span>
              </div>
              <span
                className={clsx(
                  "block text-[10px] tabular-nums",
                  item.fulfillmentPct >= 100
                    ? "text-emerald-600"
                    : item.fulfillmentPct >= 85
                      ? "text-[var(--muted)]"
                      : "text-amber-600",
                )}
              >
                {formatPercent(item.fulfillmentPct)} плана
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartWidget>
  );
}

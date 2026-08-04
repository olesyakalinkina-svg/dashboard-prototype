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
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Card, CardContent } from "@/components/ui/Card";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { Select } from "@/components/ui/Select";
import { ALL_PRICE_ZONES } from "@/lib/ticket-filter-options";
import { formatCurrency, formatNumber } from "@/lib/format";
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

const PRICE_ZONE_COLOR_MIN = "#dbeafe";
const PRICE_ZONE_COLOR_MAX = COLORS.primary;

function parseHexColor(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function formatHexColor([r, g, b]: [number, number, number]): string {
  const toHex = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, channel)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexColors(from: string, to: string, ratio: number): string {
  const [r1, g1, b1] = parseHexColor(from);
  const [r2, g2, b2] = parseHexColor(to);
  return formatHexColor([
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio,
  ]);
}

function getPriceZoneBarColor(
  tickets: number,
  minTickets: number,
  maxTickets: number,
): string {
  const ratio =
    maxTickets > minTickets
      ? (tickets - minTickets) / (maxTickets - minTickets)
      : 1;
  return mixHexColors(PRICE_ZONE_COLOR_MIN, PRICE_ZONE_COLOR_MAX, ratio);
}

type PriceZoneSortMode = "desc" | "asc" | "alpha";

const PRICE_ZONE_SORT_OPTIONS: { value: PriceZoneSortMode; label: string }[] = [
  { value: "desc", label: "По убыванию" },
  { value: "asc", label: "По возрастанию" },
  { value: "alpha", label: "По алфавиту" },
];

function sortPriceZoneRows(
  data: PriceZoneSalesPoint[],
  mode: PriceZoneSortMode,
): PriceZoneSalesPoint[] {
  const rows = [...data];
  if (mode === "asc") {
    return rows.sort((a, b) => a.tickets - b.tickets);
  }
  if (mode === "alpha") {
    const zoneOrder = new Map(ALL_PRICE_ZONES.map((zone, index) => [zone, index]));
    return rows.sort(
      (a, b) =>
        (zoneOrder.get(a.zone) ?? 0) - (zoneOrder.get(b.zone) ?? 0) ||
        a.label.localeCompare(b.label, "ru"),
    );
  }
  return rows.sort((a, b) => b.tickets - a.tickets);
}

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
                isAnimationActive={false}
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
          <Bar dataKey="value" name="Выручка" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
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

type ShareInlineRow = {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
};

function ShareBreakdownInlineRows({
  rows,
  labelClassName = "w-28",
}: {
  rows: ShareInlineRow[];
  labelClassName?: string;
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-2 overflow-y-auto py-1">
      {rows.map((item) => (
        <div key={item.key} className="flex items-center gap-2">
          <span
            className={clsx(
              "shrink-0 truncate text-xs font-medium text-[var(--foreground)]",
              labelClassName,
            )}
            title={item.label}
          >
            {item.label}
          </span>
          <div className="min-w-0 flex-1">
            <InlineBarCell
              value={item.value}
              max={100}
              share={item.share}
              formatted={formatCurrency(item.value)}
              trailingFormatted={`${item.share.toFixed(1)}%`}
              barStyle={{ backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function getShareBreakdownChartHeight(itemCount: number, compact = true): number {
  const rowHeight = compact ? 32 : 36;
  return Math.max(compact ? 140 : 160, itemCount * rowHeight + 56);
}

export function getMerchChartsRowHeight(
  topProducts: TopProductPoint[],
  channels?: MerchSalesChannelPoint[],
  categories?: MerchProductCategoryPoint[],
): number {
  const topProductsHeight = Math.max(300, topProducts.length * 36 + 48);
  const channelsHeight = getShareBreakdownChartHeight(channels?.length ?? 0);
  const categoriesHeight = getShareBreakdownChartHeight(categories?.length ?? 0);
  return Math.max(topProductsHeight, channelsHeight, categoriesHeight);
}

export function MerchSalesChannelsChart({
  data,
  className,
  compact = true,
}: {
  data: MerchSalesChannelPoint[];
  className?: string;
  compact?: boolean;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );
  const chartHeight = getShareBreakdownChartHeight(sorted.length, compact);
  const rows = useMemo<ShareInlineRow[]>(
    () =>
      sorted.map((item) => ({
        key: item.channelKey,
        label: item.channel,
        value: item.value,
        share: item.share,
        color: MERCH_CHANNEL_COLORS[item.channelKey],
      })),
    [sorted],
  );

  if (rows.length === 0) {
    return (
      <ChartWidget
        title="Выручка по каналам продаж"
        height={chartHeight}
        className={className}
        compact={compact}
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
      compact={compact}
    >
      <ShareBreakdownInlineRows rows={rows} labelClassName="w-36" />
    </ChartWidget>
  );
}

export function MerchProductCategoriesChart({
  data,
  className,
  compact = true,
}: {
  data: MerchProductCategoryPoint[];
  className?: string;
  compact?: boolean;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );
  const chartHeight = getShareBreakdownChartHeight(sorted.length, compact);
  const rows = useMemo<ShareInlineRow[]>(
    () =>
      sorted.map((item) => ({
        key: item.categoryKey,
        label: item.category,
        value: item.value,
        share: item.share,
        color: MERCH_CATEGORY_COLORS[item.categoryKey],
      })),
    [sorted],
  );

  if (rows.length === 0) {
    return (
      <ChartWidget
        title="Выручка по товарным категориям"
        height={chartHeight}
        className={className}
        compact={compact}
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
      compact={compact}
    >
      <ShareBreakdownInlineRows rows={rows} labelClassName="w-36" />
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
          <Bar dataKey="value" name="Выручка" fill={COLORS.secondary} radius={[0, 4, 4, 0]} isAnimationActive={false} />
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
          <Bar dataKey="revenue" name="Выручка" fill={COLORS.secondary} radius={[0, 4, 4, 0]} isAnimationActive={false} />
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

export function getTicketsBreakdownRowHeight(
  ticketTypeCount = 2,
  orderSourceCount = 3,
  priceZoneCount = 14,
): number {
  const ticketTypeHeight = Math.max(140, ticketTypeCount * 36 + 56);
  const orderSourceHeight = Math.max(140, orderSourceCount * 36 + 56);
  const leftColumnHeight = ticketTypeHeight + orderSourceHeight + 16;
  const priceZoneHeight = Math.max(260, priceZoneCount * 28 + 48);
  return Math.max(leftColumnHeight, priceZoneHeight);
}

function getOrderSourceChartHeight(itemCount: number, compact: boolean): number {
  return getShareBreakdownChartHeight(itemCount, compact);
}

export function TicketTypeSalesChart({
  data,
  compact = true,
}: {
  data: TicketTypeSalesPoint[];
  compact?: boolean;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.revenue - a.revenue),
    [data],
  );
  const chartHeight = getOrderSourceChartHeight(sorted.length, compact);

  if (sorted.length === 0) {
    return (
      <ChartWidget
        title="Тип билета"
        height={chartHeight}
        compact={compact}
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
    >
      <div className="flex h-full flex-col justify-center gap-2 overflow-y-auto py-1">
        {sorted.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <span
              className="w-20 shrink-0 truncate text-xs font-medium text-[var(--foreground)]"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="min-w-0 flex-1">
              <InlineBarCell
                value={item.revenue}
                max={100}
                share={item.share}
                formatted={formatCurrency(item.revenue)}
                trailingFormatted={`${item.share.toFixed(1)}%`}
                barStyle={{
                  backgroundColor: TICKET_TYPE_COLORS[item.type],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartWidget>
  );
}

export function PriceZoneSalesChart({
  data,
  compact = true,
  fillHeight = false,
}: {
  data: PriceZoneSalesPoint[];
  compact?: boolean;
  fillHeight?: boolean;
}) {
  const [sortMode, setSortMode] = useState<PriceZoneSortMode>("desc");
  const sorted = useMemo(
    () => sortPriceZoneRows(data, sortMode),
    [data, sortMode],
  );
  const maxTickets = useMemo(
    () => Math.max(...sorted.map((d) => d.tickets), 0),
    [sorted],
  );
  const minTickets = useMemo(
    () => Math.min(...sorted.map((d) => d.tickets)),
    [sorted],
  );
  const rowHeight = compact ? 28 : 32;
  const chartHeight = Math.max(
    compact ? 290 : 310,
    sorted.length * rowHeight + 80,
  );

  if (sorted.length === 0) {
    return (
      <ChartWidget
        title="Ценовая зона"
        height={chartHeight}
        compact={compact}
        fillHeight={fillHeight}
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
    >
      <div className="flex h-full flex-col gap-2 py-1">
        <Select
          label="Сортировка"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as PriceZoneSortMode)}
          className="h-8 max-w-[180px] text-xs"
        >
          {PRICE_ZONE_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-y-auto">
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
                  barStyle={{
                    backgroundColor: getPriceZoneBarColor(
                      item.tickets,
                      minTickets,
                      maxTickets,
                    ),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartWidget>
  );
}

export function OrderSourceSalesChart({
  data,
  compact = true,
}: {
  data: OrderSourceSalesPoint[];
  compact?: boolean;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.revenue - a.revenue),
    [data],
  );
  const chartHeight = getOrderSourceChartHeight(sorted.length, compact);

  if (sorted.length === 0) {
    return (
      <ChartWidget
        title="Источник заказа"
        height={chartHeight}
        compact={compact}
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
    >
      <div className="flex h-full flex-col justify-center gap-2 overflow-y-auto py-1">
        {sorted.map((item) => (
          <div key={item.source} className="flex items-center gap-2">
            <span
              className="w-28 shrink-0 truncate text-xs font-medium text-[var(--foreground)]"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="min-w-0 flex-1">
              <InlineBarCell
                value={item.revenue}
                max={100}
                share={item.share}
                formatted={formatCurrency(item.revenue)}
                trailingFormatted={`${item.share.toFixed(1)}%`}
                barStyle={{
                  backgroundColor: ORDER_SOURCE_COLORS[item.source],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartWidget>
  );
}

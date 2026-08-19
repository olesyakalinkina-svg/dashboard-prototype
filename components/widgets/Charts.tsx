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
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useRef, useState, memo } from "react";
import clsx from "clsx";
import { ChartScrollContainer } from "@/components/charts/ChartScrollContainer";
import { AdaptiveTooltip } from "@/components/charts/AdaptiveTooltip";
import {
  ChartZoomHint,
  ChartZoomReferenceArea,
  ChartZoomResetButton,
  CHART_ZOOM_SURFACE_CLASS,
} from "@/components/charts/ChartZoom";
import { useChartAreaZoom } from "@/hooks/useChartAreaZoom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import {
  ALL_MERCH_SALES_GROUPS,
  MERCH_SALES_GROUP_CHANNELS,
  MERCH_SALES_GROUP_COLORS,
  MERCH_SALES_GROUP_LABELS,
  MERCH_SALES_POINT_COLORS,
} from "@/lib/merch-filter-options";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChartWidget } from "@/components/widgets/ChartWidget";
import {
  getSubscriptionCategoryChartTitle,
} from "@/lib/subscription-filter-options";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
  formatShortMonthYear,
} from "@/lib/format";
import {
  abbreviateMatchOpponent,
  formatMatchRevenueDateShort,
  getMatchRevenueChartWidth,
  MATCH_REVENUE_DESKTOP_CHART_HEIGHT,
  MATCH_REVENUE_MOBILE_BREAKPOINT,
  MATCH_REVENUE_MOBILE_CHART_HEIGHT,
  parseMatchRevenueLabel,
  shouldShowMatchRevenueScrollHint,
} from "@/lib/match-revenue-chart";
import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import type {
  ChannelMixPoint,
  MerchSalesChannelPoint,
  MerchSalesChannelTrendPoint,
  MerchProductCategory,
  MerchProductCategoryPoint,
  MerchSalesGroup,
  MerchSalesPoint,
  SectorPoint,
  SubscriptionPlanStat,
  SubscriptionPriceCategoryPoint,
  TimeGrouping,
  TopProductPoint,
  WeeklyPoint,
  MatchRevenuePoint,
} from "@/types/dashboard";

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

type RechartsTooltipFormatter = NonNullable<
  TooltipProps<ValueType, NameType>["formatter"]
>;

const tooltipFormatCurrency: RechartsTooltipFormatter = (value) =>
  formatCurrency(Number(value));

const tooltipFormatMatchRevenue: RechartsTooltipFormatter = (value, name) => [
  formatCurrency(Number(value)),
  name === "tickets" ? "Билеты" : "Мерч",
];

const COLORS = {
  primary: "#5282FF",
  secondary: "#00BFA5",
  accent: "#7B61FF",
  warm: "#FF7043",
};

const SECTOR_COLORS = ["#5282FF", "#00BFA5", "#FF7043", "#FFB300"];

const MERCH_CATEGORY_COLORS: Record<MerchProductCategory, string> = {
  jerseys: "#5282FF",
  souvenirs: "#FF7043",
  drinkware: "#FFB300",
  apparel: "#EC407A",
  accessories: "#8D6E63",
};

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

export function getMerchTrendPeriodLabel(
  point: { period: string; sortKey: number },
  timeGrouping: TimeGrouping,
): string {
  if (timeGrouping === "month") {
    return formatShortMonthYear(new Date(point.sortKey));
  }
  return point.period;
}

export function getMerchTrendXAxisProps(timeGrouping: TimeGrouping = "month") {
  const isWeek = timeGrouping === "week";
  const isDay = timeGrouping === "day";
  return {
    dataKey: "period" as const,
    tick: { fontSize: 12, fill: "#8B8B8E" },
    interval: "preserveStartEnd" as const,
    angle: isDay ? -35 : 0,
    textAnchor: isDay ? ("end" as const) : ("middle" as const),
    height: isDay ? 52 : isWeek ? 36 : 30,
    minTickGap: isDay ? 12 : 24,
  };
}

const MERCH_STACKED_CHART_LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12 },
};

function MerchSalesStackedTooltip({
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

function sumMerchSalesGroup(
  channels: Partial<Record<MerchSalesPoint, number>>,
  group: MerchSalesGroup,
): number {
  return MERCH_SALES_GROUP_CHANNELS[group].reduce(
    (sum, channel) => sum + (channels[channel] ?? 0),
    0,
  );
}

export function MerchSalesStackedChart({
  data,
  className,
  timeGrouping = "month",
}: {
  data: MerchSalesChannelTrendPoint[];
  className?: string;
  timeGrouping?: TimeGrouping;
}) {
  const chartData = useMemo(() => {
    const rows = data.map((point) => ({
      period: getMerchTrendPeriodLabel(point, timeGrouping),
      arena: sumMerchSalesGroup(point.channels, "arena"),
      trk: sumMerchSalesGroup(point.channels, "trk"),
      online: sumMerchSalesGroup(point.channels, "online"),
    }));

    if (timeGrouping === "month") {
      return rows.filter(
        (row) => row.arena > 0 || row.trk > 0 || row.online > 0,
      );
    }

    return rows;
  }, [data, timeGrouping]);

  const activeGroups = useMemo(() => {
    return ALL_MERCH_SALES_GROUPS.filter((group) =>
      chartData.some((row) => row[group] > 0),
    );
  }, [chartData]);

  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(chartData, activeGroups, [data, timeGrouping], {
    yAggregate: "sum",
  });

  return (
    <Card className={clsx("min-w-0", className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Продажи по каналам</CardTitle>
          <ChartZoomHint visible={!isZoomed} />
        </div>
        {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
      </CardHeader>
      <CardContent className="flex min-w-0 h-full flex-col">
        {chartData.length === 0 || activeGroups.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-[var(--muted)]">
            Нет данных по выбранным каналам
          </div>
        ) : (
          <ChartScrollContainer
            className={clsx("h-[220px]", CHART_ZOOM_SURFACE_CLASS)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayData}
                margin={{
                  top: 8,
                  right: 8,
                  left: 0,
                  bottom: 0,
                }}
                {...chartHandlers}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
                <XAxis {...getMerchTrendXAxisProps(timeGrouping)} />
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
                <AdaptiveTooltip content={<MerchSalesStackedTooltip />} />
                <Legend {...MERCH_STACKED_CHART_LEGEND_PROPS} />
                <ChartZoomReferenceArea selectionArea={selectionArea} />
                {activeGroups.map((group) => (
                  <Bar
                    key={group}
                    dataKey={group}
                    name={MERCH_SALES_GROUP_LABELS[group]}
                    stackId="sales"
                    fill={MERCH_SALES_GROUP_COLORS[group]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartScrollContainer>
        )}
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
  const chartData = useMemo(
    () => data.map((point) => ({ period: point.period, value: point.value })),
    [data],
  );

  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(chartData, ["value"], [data]);

  return (
    <ChartWidget title={title}>
      <ChartScrollContainer
        className={clsx("h-full", CHART_ZOOM_SURFACE_CLASS)}
      >
        {isZoomed && (
          <div className="mb-2 flex justify-end">
            <ChartZoomResetButton onClick={resetZoom} />
          </div>
        )}
        {!isZoomed && (
          <p className="mb-2 text-[11px] text-[var(--muted)]">
            Выделите область мышью для приближения · двойной клик — сброс
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} {...chartHandlers}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#8B8B8E" }} />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: "#8B8B8E" }}
              tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
            />
            <AdaptiveTooltip
              content={<ChartTooltip formatter={formatCurrency} />}
            />
            <ChartZoomReferenceArea selectionArea={selectionArea} />
            <Line
              type="monotone"
              dataKey="value"
              name="Выручка"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartScrollContainer>
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
          <AdaptiveTooltip formatter={tooltipFormatCurrency} />
          <Bar dataKey="value" name="Выручка" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWidget>
  );
}

export function SectorPieChart({ data }: { data: SectorPoint[] }) {
  return (
    <ChartWidget title="Продажи по секторам">
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
          <AdaptiveTooltip />
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
  const [activeKey, setActiveKey] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col justify-center gap-2 py-1">
      {rows.map((item) => {
        const active = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className="relative flex min-h-11 w-full flex-col items-stretch gap-1 text-left sm:min-h-0 sm:flex-row sm:items-center sm:gap-2"
            onClick={() =>
              setActiveKey((current) => (current === item.key ? null : item.key))
            }
            aria-label={`${item.label}: ${formatCurrency(item.value)}, ${item.share.toFixed(1)}%`}
          >
            <span
              className={clsx(
                "line-clamp-2 min-w-0 text-xs font-medium leading-snug text-[var(--foreground)] sm:line-clamp-1 sm:shrink-0 sm:truncate",
                labelClassName,
              )}
            >
              {item.label}
            </span>
            <div className="min-w-0 flex-1">
              <InlineBarCell
                value={item.value}
                max={100}
                share={item.share}
                formatted={formatCurrencyCompact(item.value)}
                trailingFormatted={`${item.share.toFixed(1)}%`}
                barStyle={{ backgroundColor: item.color }}
              />
            </div>
            {active ? (
              <span className="absolute right-0 top-full z-20 mt-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs leading-snug shadow-sm sm:top-1/2 sm:mt-0 sm:-translate-y-1/2">
                {formatCurrency(item.value)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function getShareBreakdownChartHeight(itemCount: number, compact = true): number {
  const rowHeight = compact ? 44 : 48;
  return Math.max(compact ? 160 : 180, itemCount * rowHeight + 24);
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
        color: MERCH_SALES_POINT_COLORS[item.channelKey],
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
      <ShareBreakdownInlineRows rows={rows} labelClassName="w-auto sm:w-36" />
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
      <ShareBreakdownInlineRows rows={rows} labelClassName="w-24 sm:w-36" />
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
            width={compact ? 80 : 90}
            tick={{ fontSize: 12, fill: "#8B8B8E" }}
          />
          <AdaptiveTooltip formatter={tooltipFormatCurrency} />
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
            tick={{ fontSize: 12, fill: "#8B8B8E" }}
          />
          <AdaptiveTooltip formatter={tooltipFormatCurrency} />
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
                compact ? "w-[88px] text-xs" : "w-[110px] text-xs sm:w-[140px]",
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

function PriceCategoryShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SubscriptionPriceCategoryPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{point.category}</p>
      <p className="text-[var(--muted)]">
        {formatNumber(point.sold)} шт · {formatPercent(point.share)}
      </p>
    </div>
  );
}

export const SubscriptionPriceCategoryShareChart = memo(
  function SubscriptionPriceCategoryShareChart({
    data,
    season,
  }: {
    data: SubscriptionPriceCategoryPoint[];
    season: string;
  }) {
    const [tableOpen, setTableOpen] = useState(false);
    const hasSold = useMemo(
      () => data.some((item) => item.sold > 0),
      [data],
    );
    const title = getSubscriptionCategoryChartTitle(season);
    const maxSold = useMemo(
      () => Math.max(...data.map((item) => item.sold), 0),
      [data],
    );

    return (
      <Card className="flex h-full min-w-0 flex-col">
        <CardHeader className="sm:items-start">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
              абонементов продано, штук
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-1 flex-col">
          <div className="h-[118px] shrink-0">
            {!hasSold ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                Нет проданных абонементов
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  barCategoryGap={6}
                  margin={{ top: 2, right: 48, bottom: 2, left: 0 }}
                >
                  <XAxis type="number" domain={[0, maxSold || 1]} hide />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={128}
                    interval={0}
                    tick={{ fontSize: 14, fill: "#1A1A1A" }}
                    axisLine={false}
                    tickLine={false}
                    padding={{ top: 0, bottom: 0 }}
                  />
                  <AdaptiveTooltip content={<PriceCategoryShareTooltip />} />
                  <Bar
                    dataKey="sold"
                    name="Продано"
                    fill="#5282FF"
                    barSize={18}
                    maxBarSize={18}
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="sold"
                      position="right"
                      formatter={(value: number) => formatNumber(value)}
                      style={{ fontSize: 14, fill: "#1A1A1A" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setTableOpen((open) => !open)}
              aria-expanded={tableOpen}
              className="inline-flex min-h-11 items-center gap-1 text-sm text-[var(--accent)] hover:underline"
            >
              {tableOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {tableOpen ? "Скрыть таблицу" : "Показать таблицу"}
            </button>
            {tableOpen ? (
              <div className="mt-2 overflow-auto rounded-md border border-[var(--border)]">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-2 py-2">Категория</th>
                      <th className="px-2 py-2 text-right">Продано, шт</th>
                      <th className="px-2 py-2 text-right">Доля</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => (
                      <tr
                        key={item.categoryKey}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="px-2 py-1.5">{item.category}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatNumber(item.sold)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatPercent(item.share)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  },
);

type MatchRevenueXAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string };
  isMobile: boolean;
};

function MatchRevenueXAxisTick({
  x = 0,
  y = 0,
  payload,
  isMobile,
}: MatchRevenueXAxisTickProps) {
  const match = payload?.value ?? "";
  const { opponent, date } = parseMatchRevenueLabel(match);

  if (!isMobile) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="end"
          fill="#8B8B8E"
          fontSize={9}
          transform="rotate(-35)"
        >
          {match}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="middle"
        fill="#8B8B8E"
        fontSize={9}
      >
        {abbreviateMatchOpponent(opponent, 5)}
      </text>
      {date ? (
        <text
          x={0}
          y={0}
          dy={22}
          textAnchor="middle"
          fill="#8B8B8E"
          fontSize={9}
        >
          {formatMatchRevenueDateShort(date)}
        </text>
      ) : null}
    </g>
  );
}

export function MatchRevenueChart({
  data,
  className,
}: {
  data: MatchRevenuePoint[];
  className?: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        match: point.match,
        tickets: point.tickets,
        merch: point.merch,
        total: point.tickets + point.merch,
      })),
    [data],
  );

  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(chartData, ["tickets", "merch"], [data], {
    yAggregate: "sum",
  });

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
  }, [chartData.length]);

  const isMobileViewport =
    viewportWidth > 0 && viewportWidth < MATCH_REVENUE_MOBILE_BREAKPOINT;
  const chartHeight = isMobileViewport
    ? MATCH_REVENUE_MOBILE_CHART_HEIGHT
    : MATCH_REVENUE_DESKTOP_CHART_HEIGHT;
  const chartWidth = useMemo(
    () =>
      isMobileViewport
        ? getMatchRevenueChartWidth(displayData.length, {
            containerWidth: viewportWidth,
          })
        : undefined,
    [displayData.length, isMobileViewport, viewportWidth],
  );
  const showScrollHint =
    isMobileViewport &&
    chartWidth != null &&
    shouldShowMatchRevenueScrollHint(chartWidth, viewportWidth);

  const chart = (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={displayData}
        margin={{
          top: 8,
          right: 8,
          left: 0,
          bottom: isMobileViewport ? 4 : 0,
        }}
        {...chartHandlers}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
        <XAxis
          dataKey="match"
          tick={(props) => (
            <MatchRevenueXAxisTick {...props} isMobile={isMobileViewport} />
          )}
          interval={0}
          angle={isMobileViewport ? 0 : -35}
          textAnchor={isMobileViewport ? "middle" : "end"}
          height={isMobileViewport ? 48 : 72}
          tickMargin={isMobileViewport ? 4 : 0}
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
        <AdaptiveTooltip formatter={tooltipFormatMatchRevenue} />
        <Legend
          verticalAlign="bottom"
          wrapperStyle={{
            paddingTop: 8,
            fontSize: isMobileViewport ? 11 : 12,
          }}
          formatter={(value) => (value === "tickets" ? "Билеты" : "Мерч")}
        />
        <ChartZoomReferenceArea selectionArea={selectionArea} />
        <Bar
          dataKey="tickets"
          name="tickets"
          stackId="revenue"
          fill="#EF4444"
          isAnimationActive={false}
        />
        <Bar
          dataKey="merch"
          name="merch"
          stackId="revenue"
          fill="#5282FF"
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <Card className={clsx("min-w-0", className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Выручка по матчам</CardTitle>
          <ChartZoomHint visible={!isZoomed} />
        </div>
        {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
      </CardHeader>
      <CardContent className="flex min-w-0 h-full flex-col">
        {chartData.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-[var(--muted)]"
            style={{ height: MATCH_REVENUE_DESKTOP_CHART_HEIGHT }}
          >
            Нет данных по выбранным фильтрам
          </div>
        ) : (
          <div ref={scrollContainerRef} className="min-w-0">
            {isMobileViewport ? (
              <div className="max-w-full overflow-x-auto overflow-y-hidden">
                {showScrollHint ? (
                  <p className="pb-1 text-right text-xs text-[var(--muted)]">
                    Свайпните →
                  </p>
                ) : null}
                <div
                  className={clsx("relative", CHART_ZOOM_SURFACE_CLASS)}
                  style={{ width: chartWidth, height: chartHeight }}
                >
                  {chart}
                </div>
              </div>
            ) : (
              <ChartScrollContainer
                className={clsx("h-[280px]", CHART_ZOOM_SURFACE_CLASS)}
              >
                {chart}
              </ChartScrollContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

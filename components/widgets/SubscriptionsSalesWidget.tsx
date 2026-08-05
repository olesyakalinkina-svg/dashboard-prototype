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
import {
  getMerchTrendPeriodLabel,
  getMerchTrendXAxisProps,
} from "@/components/widgets/Charts";
import {
  ChartZoomHint,
  ChartZoomReferenceArea,
  ChartZoomResetButton,
  CHART_ZOOM_SURFACE_CLASS,
} from "@/components/charts/ChartZoom";
import { useFilterState } from "@/context/FilterContext";
import { useChartAreaZoom } from "@/hooks/useChartAreaZoom";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { SubscriptionsPlanFactTrendPoint, TimeGrouping } from "@/types/dashboard";

const COLORS = {
  plan: "#8B8B8E",
  regular: "#7B61FF",
  playoff: "#FF6B35",
};

const TIME_GROUPING_OPTIONS: { value: TimeGrouping; label: string }[] = [
  { value: "day", label: "Дни" },
  { value: "week", label: "Недели" },
  { value: "month", label: "Месяцы" },
];

function PlanFactTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function SubscriptionsSalesWidget({
  data,
}: {
  data: SubscriptionsPlanFactTrendPoint[];
}) {
  const { subscriptionFilters, setSubscriptionFilters } = useFilterState();
  const timeGrouping = subscriptionFilters.timeGrouping;

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        period: getMerchTrendPeriodLabel(point, timeGrouping),
        plan: point.planRevenue,
        regular: point.regularFactRevenue,
        playoff: point.playoffFactRevenue,
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
  } = useChartAreaZoom(chartData, ["plan", "regular", "playoff"], [
    timeGrouping,
    data,
  ]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Динамика продаж абонементов</CardTitle>
          <ChartZoomHint visible={!isZoomed} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
          <div className="flex w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5 sm:w-auto">
            {TIME_GROUPING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setSubscriptionFilters({ timeGrouping: option.value })
                }
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
      <CardContent>
        <div className={clsx("h-[280px] sm:h-[380px]", CHART_ZOOM_SURFACE_CLASS)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} {...chartHandlers}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
              <XAxis {...getMerchTrendXAxisProps(timeGrouping)} />
              <YAxis
                domain={yDomain}
                width={48}
                tick={{ fontSize: 11, fill: "#8B8B8E" }}
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip content={<PlanFactTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              <ChartZoomReferenceArea selectionArea={selectionArea} />
              <Line
                type="monotone"
                dataKey="plan"
                name="План"
                stroke={COLORS.plan}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="regular"
                name="Регулярный чемпионат"
                stroke={COLORS.regular}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="playoff"
                name="Плей-офф"
                stroke={COLORS.playoff}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

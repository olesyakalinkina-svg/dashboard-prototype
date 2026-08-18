"use client";

import clsx from "clsx";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { AdaptiveTooltip } from "@/components/charts/AdaptiveTooltip";
import {
  getMerchTrendPeriodLabel,
  getMerchTrendXAxisProps,
} from "@/components/widgets/Charts";
import { ChartScrollContainer } from "@/components/charts/ChartScrollContainer";
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
import type { SubscriptionsPlanFactTrendPoint } from "@/types/dashboard";

const COLORS = {
  plan: "#8B8B8E",
  regular: "#7B61FF",
  playoff: "#FF6B35",
};

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
  const { subscriptionFilters } = useFilterState();
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
        {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
      </CardHeader>
      <CardContent className="min-w-0">
        <ChartScrollContainer
          className={clsx("h-[280px] sm:h-[380px]", CHART_ZOOM_SURFACE_CLASS)}
        >
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
              <AdaptiveTooltip content={<PlanFactTooltip />} />
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
        </ChartScrollContainer>
      </CardContent>
    </Card>
  );
}

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
import { getEffectiveMerchTimeGrouping } from "@/lib/merch-filter-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { PlanFactTrendPoint } from "@/types/dashboard";

const COLORS = {
  plan: "#8B8B8E",
  fact: "#7B61FF",
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

export function MerchSalesWidget({
  data,
}: {
  data: PlanFactTrendPoint[];
}) {
  const { merchFilters } = useFilterState();
  const timeGrouping = getEffectiveMerchTimeGrouping(merchFilters);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        period: getMerchTrendPeriodLabel(point, timeGrouping),
        plan: point.planRevenue,
        fact: point.factRevenue,
      })),
    [data, timeGrouping],
  );

  const hasData = chartData.some((point) => point.plan > 0 || point.fact > 0);

  const {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers,
  } = useChartAreaZoom(chartData, ["plan", "fact"], [timeGrouping, data]);

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Продажи</CardTitle>
          <ChartZoomHint visible={!isZoomed} />
        </div>
        {isZoomed && <ChartZoomResetButton onClick={resetZoom} />}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col">
        {!hasData ? (
          <div className="flex min-h-[280px] flex-1 items-center justify-center text-sm text-[var(--muted)]">
            Нет данных по выбранным фильтрам
          </div>
        ) : (
          <ChartScrollContainer
            className={clsx(
              "min-h-[280px] flex-1 sm:min-h-[320px]",
              CHART_ZOOM_SURFACE_CLASS,
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData} {...chartHandlers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
                <XAxis
                  {...getMerchTrendXAxisProps(timeGrouping)}
                  tick={{ fontSize: 11, fill: "#8B8B8E" }}
                />
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
                  dataKey="fact"
                  name="Факт"
                  stroke={COLORS.fact}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartScrollContainer>
        )}
      </CardContent>
    </Card>
  );
}

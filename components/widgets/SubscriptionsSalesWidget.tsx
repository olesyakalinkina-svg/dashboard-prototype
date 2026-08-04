"use client";

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
import { formatCurrency } from "@/lib/format";
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

export function SubscriptionsSalesWidget({
  data,
}: {
  data: PlanFactTrendPoint[];
}) {
  const chartData = data.map((point) => ({
    period: point.period,
    plan: point.planRevenue,
    fact: point.factRevenue,
  }));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Динамика продаж абонементов</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] sm:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: "#8B8B8E" }}
                interval="preserveStartEnd"
                angle={chartData.length > 8 ? -35 : 0}
                textAnchor={chartData.length > 8 ? "end" : "middle"}
                height={chartData.length > 8 ? 50 : 30}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#8B8B8E" }}
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip content={<PlanFactTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="plan"
                name="План"
                stroke={COLORS.plan}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="fact"
                name="Факт"
                stroke={COLORS.fact}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

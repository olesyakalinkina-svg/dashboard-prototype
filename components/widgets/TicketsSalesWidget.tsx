"use client";

import clsx from "clsx";
import { useState } from "react";
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
import { formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { PlanFactTrendPoint } from "@/types/dashboard";

type SalesTab = "revenue" | "tickets";

const TABS: { id: SalesTab; label: string }[] = [
  { id: "revenue", label: "Выручка" },
  { id: "tickets", label: "Билеты" },
];

const COLORS = {
  plan: "#8B8B8E",
  fact: "#5282FF",
};

function PlanFactTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter: (value: number) => string;
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

function PlanFactChart({
  data,
  mode,
}: {
  data: PlanFactTrendPoint[];
  mode: SalesTab;
}) {
  const isRevenue = mode === "revenue";
  const chartData = data.map((point) => ({
    period: point.period,
    plan: isRevenue ? point.planRevenue : point.planTickets,
    fact: isRevenue ? point.factRevenue : point.factTickets,
  }));
  const formatter = isRevenue ? formatCurrency : (v: number) => `${formatNumber(v)} шт`;

  return (
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
          tickFormatter={(v) =>
            isRevenue ? `${(v / 1000000).toFixed(1)}M` : formatNumber(v)
          }
        />
        <Tooltip content={<PlanFactTooltip formatter={formatter} />} />
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
  );
}

export function TicketsSalesWidget({
  data,
  refreshKey,
}: {
  data: PlanFactTrendPoint[];
  refreshKey: string;
}) {
  const [activeTab, setActiveTab] = useState<SalesTab>("revenue");

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>График</CardTitle>
        <div className="flex rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-white text-[var(--accent)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ height: 320 }} key={`${activeTab}-${refreshKey}`}>
          <PlanFactChart data={data} mode={activeTab} />
        </div>
      </CardContent>
    </Card>
  );
}

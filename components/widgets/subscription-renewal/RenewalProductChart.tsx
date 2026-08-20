"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AdaptiveTooltip } from "@/components/charts/AdaptiveTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { SubscriptionRenewalProductShare } from "@/lib/subscription-renewal";

const BAR_FILL = "#5282FF";
const ROW_HEIGHT = 28;
const MIN_CHART_HEIGHT = 118;
const LABEL_MAX = 22;

function truncatePlanLabel(name: string): string {
  if (name.length <= LABEL_MAX) return name;
  return `${name.slice(0, LABEL_MAX - 1)}…`;
}

function RenewalProductTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SubscriptionRenewalProductShare }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{point.planName}</p>
      <p className="text-[var(--muted)]">
        {formatNumber(point.renewed)} из {formatNumber(point.base)} ·{" "}
        {formatPercent(point.share)}
      </p>
    </div>
  );
}

export function RenewalProductChart({
  data,
}: {
  data: SubscriptionRenewalProductShare[];
}) {
  const [tableOpen, setTableOpen] = useState(false);
  const hasBase = useMemo(() => data.some((item) => item.base > 0), [data]);
  const chartRows = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        axisLabel: truncatePlanLabel(item.planName),
      })),
    [data],
  );
  const chartHeight = Math.max(MIN_CHART_HEIGHT, data.length * ROW_HEIGHT);

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader className="sm:items-start">
        <div className="min-w-0">
          <CardTitle>Продление по продукту</CardTitle>
          <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
            доля владельцев, купивших абонементы на новый сезон
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col">
        <div className="min-w-0 shrink-0" style={{ height: chartHeight }}>
          {!hasBase ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
              Нет владельцев прошлого сезона
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                barCategoryGap={6}
                margin={{ top: 2, right: 56, bottom: 2, left: 0 }}
              >
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category"
                  dataKey="categoryKey"
                  width={158}
                  interval={0}
                  tick={{ fontSize: 12, fill: "#1A1A1A" }}
                  axisLine={false}
                  tickLine={false}
                  padding={{ top: 0, bottom: 0 }}
                  tickFormatter={(categoryKey: string) => {
                    const row = chartRows.find(
                      (item) => item.categoryKey === categoryKey,
                    );
                    return row?.axisLabel ?? categoryKey;
                  }}
                />
                <AdaptiveTooltip content={<RenewalProductTooltip />} />
                <Bar
                  dataKey="share"
                  name="Продление"
                  fill={BAR_FILL}
                  barSize={18}
                  maxBarSize={18}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="share"
                    position="right"
                    formatter={(value: number) => formatPercent(value)}
                    style={{ fontSize: 12, fill: "#1A1A1A" }}
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
            <div className="mt-2 max-h-72 overflow-auto rounded-md border border-[var(--border)]">
              <table className="min-w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-2 py-2">Продукт</th>
                    <th className="px-2 py-2 text-right">База</th>
                    <th className="px-2 py-2 text-right">Продлили</th>
                    <th className="px-2 py-2 text-right">Продление</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.categoryKey}
                      className="border-b border-[var(--border)] last:border-b-0"
                    >
                      <td className="px-2 py-1.5">{item.planName}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatNumber(item.base)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatNumber(item.renewed)}
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
}

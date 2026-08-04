"use client";

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
  ALL_MERCH_PRODUCT_CATEGORIES,
  MERCH_PRODUCT_CATEGORY_LABELS,
} from "@/lib/merch-filter-options";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  MerchProductCategory,
  MerchProductCategoryTrendPoint,
  TimeGrouping,
} from "@/types/dashboard";

const MERCH_CATEGORY_COLORS: Record<MerchProductCategory, string> = {
  jerseys: "#5282FF",
  souvenirs: "#FF7043",
  drinkware: "#FFB300",
  apparel: "#EC407A",
  accessories: "#8D6E63",
};

const TIME_GROUPING_SUBTITLES: Record<TimeGrouping, string> = {
  day: "по дням",
  week: "по неделям",
  month: "по месяцам",
  quarter: "по кварталам",
};

function CategoryTrendTooltip({
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

export function MerchProductCategoriesTrendWidget({
  data,
  timeGrouping,
}: {
  data: MerchProductCategoryTrendPoint[];
  timeGrouping: TimeGrouping;
}) {
  const activeCategories = useMemo(() => {
    const categorySet = new Set<MerchProductCategory>();
    for (const point of data) {
      for (const [category, value] of Object.entries(point.categories)) {
        if (value > 0) {
          categorySet.add(category as MerchProductCategory);
        }
      }
    }
    return ALL_MERCH_PRODUCT_CATEGORIES.filter((category) =>
      categorySet.has(category),
    );
  }, [data]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        period: point.period,
        ...point.categories,
      })),
    [data],
  );

  const compactAxis = chartData.length > 8;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>График продаж по товарным категориям</CardTitle>
        <p className="text-[11px] font-normal text-[var(--muted)]">
          Выручка {TIME_GROUPING_SUBTITLES[timeGrouping]} в разрезе категорий
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 || activeCategories.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-[var(--muted)] sm:h-[360px]">
            Нет данных по товарным категориям
          </div>
        ) : (
          <div className="h-[280px] sm:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: compactAxis ? 8 : 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: "#8B8B8E" }}
                  interval="preserveStartEnd"
                  angle={compactAxis ? -35 : 0}
                  textAnchor={compactAxis ? "end" : "middle"}
                  height={compactAxis ? 50 : 30}
                />
                <YAxis
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
                <Tooltip content={<CategoryTrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeCategories.map((category) => (
                  <Line
                    key={category}
                    type="monotone"
                    dataKey={category}
                    name={MERCH_PRODUCT_CATEGORY_LABELS[category]}
                    stroke={MERCH_CATEGORY_COLORS[category]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

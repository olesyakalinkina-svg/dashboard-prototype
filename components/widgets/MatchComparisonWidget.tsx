"use client";

import { useDeferredValue, useMemo, useState } from "react";
import clsx from "clsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { Select } from "@/components/ui/Select";
import { useFilterState } from "@/context/FilterContext";
import { formatDate } from "@/lib/format";
import {
  MATCH_COMPARISON_EMPTY,
  MATCH_COMPARISON_METRIC_LABELS,
  MATCH_COMPARISON_METRICS,
  computeMatchComparison,
  formatMatchComparisonDelta,
  formatMatchComparisonValue,
  getMatchComparisonMetricValue,
  listMatchComparisonMatches,
  listMatchComparisonOptions,
  matchComparisonDelta,
  pickDefaultMatchComparisonIds,
  type MatchComparisonMetricId,
  type MatchComparisonSide,
} from "@/lib/match-comparison";

const METRIC_BAR_CLASS: Record<MatchComparisonMetricId, string> = {
  revenue: "bg-rose-400",
  occupancy: "bg-emerald-500",
  avgCheck: "bg-amber-500",
  conversion: "bg-blue-400",
  merch: "bg-[var(--accent)]",
};

function sideLabel(side: MatchComparisonSide, fallback: string): string {
  if (!side.eventLabel) return fallback;
  if (!side.date) return side.eventLabel;
  return `${side.eventLabel} · ${formatDate(side.date)}`;
}

function deltaToneClass(delta: number | null): string {
  if (delta == null || delta === 0) return "text-[var(--muted)]";
  return delta > 0 ? "text-emerald-600" : "text-red-500";
}

export function MatchComparisonWidget() {
  const { subscriptionFilters } = useFilterState();
  const deferredFilters = useDeferredValue(subscriptionFilters);

  const matches = useMemo(
    () => listMatchComparisonMatches(deferredFilters),
    [deferredFilters],
  );
  const options = useMemo(
    () => listMatchComparisonOptions(deferredFilters),
    [deferredFilters],
  );
  const [defaultA, defaultB] = useMemo(
    () => pickDefaultMatchComparisonIds(matches),
    [matches],
  );

  const [matchIdA, setMatchIdA] = useState<string | null>(null);
  const [matchIdB, setMatchIdB] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<
    MatchComparisonMetricId[]
  >([...MATCH_COMPARISON_METRICS]);

  const resolvedA =
    matchIdA && options.some((option) => option.value === matchIdA)
      ? matchIdA
      : defaultA;
  const resolvedB =
    matchIdB && options.some((option) => option.value === matchIdB)
      ? matchIdB
      : defaultB;

  const comparison = useMemo(() => {
    if (!resolvedA || !resolvedB) return null;
    return computeMatchComparison(deferredFilters, resolvedA, resolvedB);
  }, [deferredFilters, resolvedA, resolvedB]);

  function toggleMetric(metric: MatchComparisonMetricId) {
    setSelectedMetrics((current) =>
      current.includes(metric)
        ? current.filter((id) => id !== metric)
        : MATCH_COMPARISON_METRICS.filter(
            (id) => id === metric || current.includes(id),
          ),
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Сравнение матчей</CardTitle>
          <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
            Выручка, заполняемость и средний чек — как в «Продажи по матчам»
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[1024px]:grid-cols-2">
          <Select
            label="Матч A"
            data-testid="match-comparison-select-a"
            value={resolvedA ?? ""}
            onChange={(event) => setMatchIdA(event.target.value)}
            disabled={options.length === 0}
          >
            {options.length === 0 ? (
              <option value="">Нет матчей</option>
            ) : (
              options.map((option) => (
                <option key={`a-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
          </Select>
          <Select
            label="Матч B"
            data-testid="match-comparison-select-b"
            value={resolvedB ?? ""}
            onChange={(event) => setMatchIdB(event.target.value)}
            disabled={options.length === 0}
          >
            {options.length === 0 ? (
              <option value="">Нет матчей</option>
            ) : (
              options.map((option) => (
                <option key={`b-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
          </Select>
        </div>

        <div className="flex min-w-0 flex-wrap gap-2">
          {MATCH_COMPARISON_METRICS.map((metric) => {
            const pressed = selectedMetrics.includes(metric);
            return (
              <button
                key={metric}
                type="button"
                data-testid={`match-comparison-metric-${metric}`}
                aria-pressed={pressed}
                onClick={() => toggleMetric(metric)}
                className={clsx(
                  "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors xl:min-h-8",
                  pressed
                    ? "border-[var(--accent)] bg-[#eef3ff] text-[var(--foreground)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)]",
                )}
              >
                {MATCH_COMPARISON_METRIC_LABELS[metric]}
              </button>
            );
          })}
        </div>

        {!comparison || selectedMetrics.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {options.length === 0
              ? "Нет матчей для выбранных фильтров"
              : "Выберите показатели для сравнения"}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-[var(--border)]">
              <table
                className="min-w-full border-collapse text-sm"
                data-testid="match-comparison-table"
              >
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-3 py-2">Показатель</th>
                    <th className="px-3 py-2">
                      {sideLabel(comparison.a, "Матч A")}
                    </th>
                    <th className="px-3 py-2">
                      {sideLabel(comparison.b, "Матч B")}
                    </th>
                    <th className="px-3 py-2">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMetrics.map((metric) => {
                    const valueA = getMatchComparisonMetricValue(
                      comparison.a,
                      metric,
                    );
                    const valueB = getMatchComparisonMetricValue(
                      comparison.b,
                      metric,
                    );
                    const delta = matchComparisonDelta(
                      metric,
                      comparison.a,
                      comparison.b,
                    );
                    return (
                      <tr
                        key={metric}
                        data-testid={`match-comparison-row-${metric}`}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                          {MATCH_COMPARISON_METRIC_LABELS[metric]}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatMatchComparisonValue(metric, valueA)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatMatchComparisonValue(metric, valueB)}
                        </td>
                        <td
                          className={clsx(
                            "px-3 py-2 tabular-nums",
                            deltaToneClass(delta),
                          )}
                        >
                          {formatMatchComparisonDelta(metric, delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="space-y-3"
              data-testid="match-comparison-bars"
            >
              {selectedMetrics.map((metric) => {
                const valueA = getMatchComparisonMetricValue(
                  comparison.a,
                  metric,
                );
                const valueB = getMatchComparisonMetricValue(
                  comparison.b,
                  metric,
                );
                const max = Math.max(valueA ?? 0, valueB ?? 0);
                return (
                  <div key={`bar-${metric}`} className="min-w-0 space-y-1.5">
                    <p className="text-xs font-medium text-[var(--muted)]">
                      {MATCH_COMPARISON_METRIC_LABELS[metric]}
                    </p>
                    <PairedBar
                      label={sideLabel(comparison.a, "A")}
                      value={valueA}
                      max={max}
                      formatted={formatMatchComparisonValue(metric, valueA)}
                      barClassName={METRIC_BAR_CLASS[metric]}
                    />
                    <PairedBar
                      label={sideLabel(comparison.b, "B")}
                      value={valueB}
                      max={max}
                      formatted={formatMatchComparisonValue(metric, valueB)}
                      barClassName={METRIC_BAR_CLASS[metric]}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PairedBar({
  label,
  value,
  max,
  formatted,
  barClassName,
}: {
  label: string;
  value: number | null;
  max: number;
  formatted: string;
  barClassName: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-2">
      <span className="truncate text-xs text-[var(--muted)]">{label}</span>
      {value == null ? (
        <span className="text-xs text-[var(--muted)]">
          {MATCH_COMPARISON_EMPTY}
        </span>
      ) : (
        <InlineBarCell
          value={value}
          max={max}
          formatted={formatted}
          barClassName={barClassName}
        />
      )}
    </div>
  );
}

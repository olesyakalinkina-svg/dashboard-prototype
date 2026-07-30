"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/format";
import { LEAGUE_OPTIONS, SEASON_OPTIONS } from "@/lib/ticket-filter-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  League,
  TicketFilters,
  TicketMatchCumulativeSeries,
} from "@/types/dashboard";

type SalesTab = "revenue" | "tickets";
type SeasonScope = (typeof SEASON_OPTIONS)[number]["value"];
type LeagueScope = "all" | League;

const SALES_TABS: { id: SalesTab; label: string }[] = [
  { id: "revenue", label: "Выручка" },
  { id: "tickets", label: "Билеты" },
];

const CURRENT_SEASON = "2025/26";
const TOOLTIP_LIMIT = 6;
const CONTRAST_LINE_COLORS = [
  "#E41A1C",
  "#377EB8",
  "#4DAF4A",
  "#984EA3",
  "#FF7F00",
  "#00BFC5",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
  "#6366F1",
  "#EF4444",
  "#22C55E",
  "#A855F7",
  "#0EA5E9",
  "#D95F02",
  "#7570B3",
  "#E7298A",
  "#66A61E",
  "#E6AB02",
];

function getContrastingLineColor(index: number): string {
  return CONTRAST_LINE_COLORS[index % CONTRAST_LINE_COLORS.length];
}

function isSingleSeasonSelected(
  ticketFilters: TicketFilters,
  showSeasonScope: boolean,
  seasonScope: SeasonScope,
  series: TicketMatchCumulativeSeries[],
): boolean {
  if (ticketFilters.season !== "all") return true;
  if (showSeasonScope && seasonScope !== "all") return true;
  return new Set(series.map((item) => item.season)).size <= 1;
}

function isSingleLeagueSelected(
  ticketFilters: TicketFilters,
  showLeagueScope: boolean,
  leagueScope: LeagueScope,
  series: TicketMatchCumulativeSeries[],
): boolean {
  if (ticketFilters.league !== "all") return true;
  if (showLeagueScope && leagueScope !== "all") return true;
  return new Set(series.map((item) => item.league)).size <= 1;
}

function applyContrastColors(
  items: TicketMatchCumulativeSeries[],
): TicketMatchCumulativeSeries[] {
  return items.map((item, index) => ({
    ...item,
    color: getContrastingLineColor(index),
  }));
}
const LEAGUE_LABELS: Record<League, string> = {
  KHL: "КХЛ",
  VHL: "ВХЛ",
  MHL: "МХЛ",
};

type ChartRow = {
  date: string;
  dateKey: number;
  [matchId: string]: string | number | null;
};

function buildChartData(
  series: TicketMatchCumulativeSeries[],
  mode: SalesTab,
): ChartRow[] {
  const dateKeySet = new Set<number>();
  const seriesBounds = new Map<
    string,
    { firstSaleDateKey: number; lastSaleDateKey: number }
  >();

  for (const s of series) {
    if (s.points.length === 0) continue;

    const dateKeys = s.points.map((p) => p.dateKey);
    seriesBounds.set(s.matchId, {
      firstSaleDateKey: Math.min(...dateKeys),
      lastSaleDateKey: Math.max(...dateKeys),
    });

    for (const p of s.points) {
      dateKeySet.add(p.dateKey);
    }
  }

  const sortedKeys = Array.from(dateKeySet).sort((a, b) => a - b);

  return sortedKeys.map((dateKey) => {
    const row: ChartRow = {
      date: format(new Date(dateKey), "dd.MM.yy"),
      dateKey,
    };

    for (const s of series) {
      const bounds = seriesBounds.get(s.matchId);
      if (
        !bounds ||
        dateKey < bounds.firstSaleDateKey ||
        dateKey > bounds.lastSaleDateKey
      ) {
        row[s.matchId] = null;
        continue;
      }

      let value: number | null = null;
      for (const p of s.points) {
        if (p.dateKey <= dateKey) {
          value = mode === "revenue" ? p.revenue : p.tickets;
        }
      }
      row[s.matchId] = value;
    }

    return row;
  });
}

function MatchSeriesTooltip({
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

  const entries = payload
    .filter((entry) => entry.value != null)
    .sort((a, b) => b.value - a.value);

  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, TOOLTIP_LIMIT);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
      {visibleEntries.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
      {hiddenCount > 0 && (
        <p className="mt-1 text-[var(--muted)]">и ещё {hiddenCount}</p>
      )}
    </div>
  );
}

function ChartScopeControls({
  seasonScope,
  leagueScope,
  showSeasonScope,
  showLeagueScope,
  onSeasonScopeChange,
  onLeagueScopeChange,
}: {
  seasonScope: SeasonScope;
  leagueScope: LeagueScope;
  showSeasonScope: boolean;
  showLeagueScope: boolean;
  onSeasonScopeChange: (scope: SeasonScope) => void;
  onLeagueScopeChange: (scope: LeagueScope) => void;
}) {
  if (!showSeasonScope && !showLeagueScope) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSeasonScope && (
        <div className="flex flex-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5">
          {SEASON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSeasonScopeChange(option.value)}
              className={clsx(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                seasonScope === option.value
                  ? "bg-white text-[var(--accent)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {showLeagueScope && (
        <div className="flex flex-wrap rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5">
          <button
            type="button"
            onClick={() => onLeagueScopeChange("all")}
            className={clsx(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              leagueScope === "all"
                ? "bg-white text-[var(--accent)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            Все лиги
          </button>
          {LEAGUE_OPTIONS.filter((option) => option.value !== "all").map(
            (option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onLeagueScopeChange(option.value)}
                className={clsx(
                  "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  leagueScope === option.value
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {option.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ChartLegend({
  series,
  hiddenSeries,
  hoveredSeries,
  onToggleSeries,
  onHoverSeries,
}: {
  series: TicketMatchCumulativeSeries[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  onToggleSeries: (matchId: string) => void;
  onHoverSeries: (matchId: string | null) => void;
}) {
  if (series.length === 0) return null;

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="mb-2 text-[11px] text-[var(--muted)]">
        Нажмите на матч, чтобы скрыть или показать линию. Наведите для подсветки.
      </p>
      <div className="max-h-28 overflow-y-auto">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {series.map((item) => {
            const isHidden = hiddenSeries.has(item.matchId);
            const isHovered = hoveredSeries === item.matchId;
            const isPreviousSeason = item.season !== CURRENT_SEASON;

            return (
              <button
                key={item.matchId}
                type="button"
                onClick={() => onToggleSeries(item.matchId)}
                onMouseEnter={() => onHoverSeries(item.matchId)}
                onMouseLeave={() => onHoverSeries(null)}
                className={clsx(
                  "inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[10px] transition-opacity",
                  isHidden && "opacity-40",
                  isHovered && "bg-[var(--background)]",
                )}
              >
                <span
                  className="h-0.5 w-4 shrink-0 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    opacity: isPreviousSeason ? 0.7 : 1,
                  }}
                />
                <span
                  className={clsx(
                    "truncate",
                    isHidden && "line-through",
                    isPreviousSeason && "text-[var(--muted)]",
                  )}
                >
                  <span className="font-medium">{LEAGUE_LABELS[item.league]}</span>
                  {" · "}
                  {item.label}
                  {isPreviousSeason ? ` · ${item.season}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchCumulativeChart({
  series,
  mode,
  hiddenSeries,
  hoveredSeries,
}: {
  series: TicketMatchCumulativeSeries[];
  mode: SalesTab;
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
}) {
  const visibleSeries = useMemo(
    () => series.filter((item) => !hiddenSeries.has(item.matchId)),
    [series, hiddenSeries],
  );

  const chartData = useMemo(
    () => buildChartData(visibleSeries, mode),
    [visibleSeries, mode],
  );
  const isRevenue = mode === "revenue";
  const formatter = isRevenue
    ? formatCurrency
    : (v: number) => `${formatNumber(v)} шт`;

  if (series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Нет данных по продажам билетов
      </div>
    );
  }

  if (visibleSeries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Все линии скрыты. Выберите матч в легенде ниже.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#8B8B8E" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#8B8B8E" }}
          width={48}
          tickFormatter={(v) =>
            isRevenue
              ? v >= 1000
                ? `${Math.round(v / 1000)}K`
                : String(v)
              : formatNumber(v)
          }
        />
        <Tooltip content={<MatchSeriesTooltip formatter={formatter} />} />
        {visibleSeries.map((item) => {
          const isPreviousSeason = item.season !== CURRENT_SEASON;
          const isHovered = hoveredSeries === item.matchId;
          const isDimmed = hoveredSeries != null && !isHovered;

          return (
            <Line
              key={item.matchId}
              type="monotone"
              dataKey={item.matchId}
              name={`${LEAGUE_LABELS[item.league]} · ${item.label}`}
              stroke={item.color}
              strokeWidth={isHovered ? 2.5 : 1.5}
              strokeOpacity={isDimmed ? 0.12 : isPreviousSeason ? 0.55 : 0.9}
              strokeDasharray={isPreviousSeason ? "5 4" : undefined}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TicketsSalesWidget({
  series,
  ticketFilters,
  refreshKey,
}: {
  series: TicketMatchCumulativeSeries[];
  ticketFilters: TicketFilters;
  refreshKey: string;
}) {
  const [activeTab, setActiveTab] = useState<SalesTab>("revenue");
  const [seasonScope, setSeasonScope] = useState<SeasonScope>(CURRENT_SEASON);
  const [leagueScope, setLeagueScope] = useState<LeagueScope>("all");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  const hasMultipleSeasons = useMemo(
    () => new Set(series.map((item) => item.season)).size > 1,
    [series],
  );

  const showSeasonScope =
    ticketFilters.season === "all" && hasMultipleSeasons;
  const showLeagueScope = ticketFilters.league === "all";

  const filteredSeries = useMemo(() => {
    return series.filter((item) => {
      if (showSeasonScope && seasonScope !== "all" && item.season !== seasonScope) {
        return false;
      }
      if (showLeagueScope && leagueScope !== "all" && item.league !== leagueScope) {
        return false;
      }
      return true;
    });
  }, [series, showSeasonScope, seasonScope, showLeagueScope, leagueScope]);

  const displaySeries = useMemo(() => {
    const useContrastColors =
      isSingleSeasonSelected(
        ticketFilters,
        showSeasonScope,
        seasonScope,
        filteredSeries,
      ) &&
      isSingleLeagueSelected(
        ticketFilters,
        showLeagueScope,
        leagueScope,
        filteredSeries,
      );

    if (!useContrastColors) {
      return filteredSeries;
    }

    return applyContrastColors(filteredSeries);
  }, [
    filteredSeries,
    ticketFilters,
    showSeasonScope,
    seasonScope,
    showLeagueScope,
    leagueScope,
  ]);

  useEffect(() => {
    setHiddenSeries(new Set());
    setHoveredSeries(null);
  }, [refreshKey, seasonScope, leagueScope]);

  const toggleSeries = (matchId: string) => {
    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const chartHeight = displaySeries.length > 18 ? 280 : 320;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>График</CardTitle>
        <div className="flex rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5">
          {SALES_TABS.map((tab) => (
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
        <ChartScopeControls
          seasonScope={seasonScope}
          leagueScope={leagueScope}
          showSeasonScope={showSeasonScope}
          showLeagueScope={showLeagueScope}
          onSeasonScopeChange={setSeasonScope}
          onLeagueScopeChange={setLeagueScope}
        />
        <div
          className={clsx(
            (showSeasonScope || showLeagueScope) && "mt-3",
          )}
          style={{ height: chartHeight }}
          key={`${activeTab}-${refreshKey}-${seasonScope}-${leagueScope}`}
        >
          <MatchCumulativeChart
            series={displaySeries}
            mode={activeTab}
            hiddenSeries={hiddenSeries}
            hoveredSeries={hoveredSeries}
          />
        </div>
        <ChartLegend
          series={displaySeries}
          hiddenSeries={hiddenSeries}
          hoveredSeries={hoveredSeries}
          onToggleSeries={toggleSeries}
          onHoverSeries={setHoveredSeries}
        />
      </CardContent>
    </Card>
  );
}

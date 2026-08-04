"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
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
const TICKET_SALES_WINDOW_DAYS = 21;
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

const LEAGUE_LABELS: Record<League, string> = {
  KHL: "КХЛ",
  VHL: "ВХЛ",
  MHL: "МХЛ",
};

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

function factKey(matchId: string): string {
  return `${matchId}_fact`;
}

function planKey(matchId: string): string {
  return `${matchId}_plan`;
}

type ChartRow = {
  daysBeforeMatch: number;
  xLabel: string;
  [key: string]: string | number | null;
};

function formatDaysBeforeLabel(days: number): string {
  return days === 0 ? "матч" : `D-${days}`;
}

function buildChartData(
  series: TicketMatchCumulativeSeries[],
  mode: SalesTab,
): ChartRow[] {
  const rows: ChartRow[] = [];

  for (let days = TICKET_SALES_WINDOW_DAYS; days >= 0; days -= 1) {
    const row: ChartRow = {
      daysBeforeMatch: days,
      xLabel: formatDaysBeforeLabel(days),
    };

    for (const s of series) {
      const point = s.points.find((p) => p.daysBeforeMatch === days);
      if (!point) {
        row[factKey(s.matchId)] = null;
        row[planKey(s.matchId)] = null;
        continue;
      }

      row[factKey(s.matchId)] =
        mode === "revenue" ? point.revenue : point.tickets;
      row[planKey(s.matchId)] =
        mode === "revenue" ? point.planRevenue : point.planTickets;
    }

    rows.push(row);
  }

  return rows;
}

function getCurrentPoint(
  item: TicketMatchCumulativeSeries,
  mode: SalesTab,
): { fact: number; plan: number } | null {
  if (item.currentDaysBeforeMatch == null) return null;
  const point = item.points.find(
    (p) => p.daysBeforeMatch === item.currentDaysBeforeMatch,
  );
  if (!point) return null;

  const fact = mode === "revenue" ? point.revenue : point.tickets;
  const plan = mode === "revenue" ? point.planRevenue : point.planTickets;
  if (fact == null) return null;

  return { fact, plan };
}

function findNextUpcomingMatch(
  series: TicketMatchCumulativeSeries[],
): TicketMatchCumulativeSeries | null {
  const upcoming = series
    .filter((s) => !s.eventCompleted && s.currentDaysBeforeMatch != null)
    .sort((a, b) => a.matchDateKey - b.matchDateKey);

  return upcoming[0] ?? null;
}

function UpcomingMatchSummary({
  match,
  mode,
}: {
  match: TicketMatchCumulativeSeries;
  mode: SalesTab;
}) {
  const current = getCurrentPoint(match, mode);
  if (!current) return null;

  const isRevenue = mode === "revenue";
  const factLabel = isRevenue
    ? formatCurrency(current.fact)
    : `${formatNumber(current.fact)} шт`;
  const planLabel = isRevenue
    ? formatCurrency(current.plan)
    : `${formatNumber(current.plan)} шт`;
  const pct =
    current.plan > 0 ? (current.fact / current.plan) * 100 : 0;
  const daysLabel =
    match.currentDaysBeforeMatch === 0
      ? "сегодня матч"
      : `D-${match.currentDaysBeforeMatch}`;

  return (
    <div className="mb-3 rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--foreground)]">
        Ближайший матч · {LEAGUE_LABELS[match.league]} · {match.label}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
        {daysLabel} · факт {factLabel} / план {planLabel} ({formatPercent(pct)})
      </p>
    </div>
  );
}

type TooltipEntry = {
  matchId: string;
  label: string;
  color: string;
  fact: number;
  plan: number;
  date: string;
};

function MatchSeriesTooltip({
  active,
  payload,
  label,
  series,
  mode,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number | null; color?: string }[];
  label?: string;
  series: TicketMatchCumulativeSeries[];
  mode: SalesTab;
}) {
  if (!active || !payload?.length || label == null) return null;

  const daysBeforeMatch = Number(label);
  const dateLabel = formatDaysBeforeLabel(daysBeforeMatch);
  const formatter =
    mode === "revenue"
      ? formatCurrency
      : (v: number) => `${formatNumber(v)} шт`;

  const entries: TooltipEntry[] = [];

  for (const item of series) {
    const point = item.points.find((p) => p.daysBeforeMatch === daysBeforeMatch);
    if (!point) continue;

    const fact = mode === "revenue" ? point.revenue : point.tickets;
    const plan = mode === "revenue" ? point.planRevenue : point.planTickets;
    if (fact == null) continue;

    entries.push({
      matchId: item.matchId,
      label: `${LEAGUE_LABELS[item.league]} · ${item.label}`,
      color: item.color,
      fact,
      plan,
      date: point.date,
    });
  }

  entries.sort((a, b) => b.fact - a.fact);
  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, TOOLTIP_LIMIT);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-[var(--foreground)]">
        {dateLabel}
        {visibleEntries[0]?.date ? ` · ${visibleEntries[0].date}` : ""}
      </p>
      {visibleEntries.map((entry) => {
        const pct = entry.plan > 0 ? (entry.fact / entry.plan) * 100 : 0;
        return (
          <p key={entry.matchId} style={{ color: entry.color }}>
            {entry.label}: {formatter(entry.fact)} / {formatter(entry.plan)} (
            {formatPercent(pct)})
          </p>
        );
      })}
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
        Сплошная линия — факт, пунктир — план. Нажмите на матч, чтобы скрыть
        линии. Наведите для подсветки.
      </p>
      <div className="max-h-28 overflow-y-auto">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {series.map((item) => {
            const isHidden = hiddenSeries.has(item.matchId);
            const isHovered = hoveredSeries === item.matchId;
            const isPreviousSeason = item.season !== CURRENT_SEASON;
            const isUpcoming = !item.eventCompleted;

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
                  isUpcoming && !isHidden && "font-medium",
                )}
              >
                <span className="flex shrink-0 items-center gap-0.5">
                  <span
                    className="h-0.5 w-3 rounded-full"
                    style={{
                      backgroundColor: item.color,
                      opacity: isPreviousSeason ? 0.7 : 1,
                    }}
                  />
                  <span
                    className="h-0 w-3 border-t border-dashed"
                    style={{
                      borderColor: item.color,
                      opacity: isPreviousSeason ? 0.5 : 0.7,
                    }}
                  />
                </span>
                <span
                  className={clsx(
                    "truncate",
                    isHidden && "line-through",
                    isPreviousSeason && "text-[var(--muted)]",
                    isUpcoming && "text-[var(--foreground)]",
                  )}
                >
                  <span className="font-medium">{LEAGUE_LABELS[item.league]}</span>
                  {" · "}
                  {item.label}
                  {isUpcoming && item.currentDaysBeforeMatch != null
                    ? ` · D-${item.currentDaysBeforeMatch}`
                    : ""}
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

  if (series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
        Нет матчей по выбранным фильтрам
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
          dataKey="daysBeforeMatch"
          tick={{ fontSize: 11, fill: "#8B8B8E" }}
          tickFormatter={formatDaysBeforeLabel}
          interval="preserveStartEnd"
          minTickGap={16}
          type="number"
          domain={[0, TICKET_SALES_WINDOW_DAYS]}
          reversed
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
        <Tooltip
          content={
            <MatchSeriesTooltip series={visibleSeries} mode={mode} />
          }
        />
        {visibleSeries.flatMap((item) => {
          const isPreviousSeason = item.season !== CURRENT_SEASON;
          const isUpcoming = !item.eventCompleted;
          const isHovered = hoveredSeries === item.matchId;
          const isDimmed = hoveredSeries != null && !isHovered;
          const fKey = factKey(item.matchId);
          const pKey = planKey(item.matchId);
          const currentPoint = getCurrentPoint(item, mode);
          const planTarget =
            mode === "revenue" ? item.planRevenue : item.planTickets;

          const elements = [
            <Line
              key={`${item.matchId}-plan`}
              type="monotone"
              dataKey={pKey}
              name={`${LEAGUE_LABELS[item.league]} · ${item.label} (план)`}
              stroke={item.color}
              strokeWidth={isHovered ? 2 : 1.25}
              strokeOpacity={isDimmed ? 0.08 : isPreviousSeason ? 0.35 : 0.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />,
            <Line
              key={`${item.matchId}-fact`}
              type="monotone"
              dataKey={fKey}
              name={`${LEAGUE_LABELS[item.league]} · ${item.label}`}
              stroke={item.color}
              strokeWidth={isHovered ? 2.5 : isUpcoming ? 2 : 1.5}
              strokeOpacity={
                isDimmed ? 0.12 : isPreviousSeason ? 0.55 : isUpcoming ? 1 : 0.9
              }
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />,
            <ReferenceDot
              key={`${item.matchId}-plan-target`}
              x={0}
              y={planTarget}
              r={isUpcoming ? 4 : 3}
              fill={item.color}
              fillOpacity={isDimmed ? 0.15 : isUpcoming ? 0.9 : 0.6}
              stroke="white"
              strokeWidth={1}
              ifOverflow="discard"
            />,
          ];

          if (item.currentDaysBeforeMatch != null && currentPoint != null) {
            elements.push(
              <ReferenceDot
                key={`${item.matchId}-current`}
                x={item.currentDaysBeforeMatch}
                y={currentPoint.fact}
                r={isUpcoming ? 5 : 3}
                fill={item.color}
                fillOpacity={isDimmed ? 0.2 : 1}
                stroke="white"
                strokeWidth={2}
                ifOverflow="discard"
              />,
            );
          }

          return elements;
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TicketsSalesWidget({
  series,
  ticketFilters,
}: {
  series: TicketMatchCumulativeSeries[];
  ticketFilters: TicketFilters;
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

  const nextUpcoming = useMemo(
    () => findNextUpcomingMatch(displaySeries),
    [displaySeries],
  );

  useEffect(() => {
    setHiddenSeries(new Set());
    setHoveredSeries(null);
  }, [series, seasonScope, leagueScope]);

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
      <CardHeader className="w-full sm:w-auto">
        <div className="min-w-0">
          <CardTitle>График продаж к матчу</CardTitle>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Накопительный факт и план по дням до матча (D-21 → матч)
          </p>
        </div>
        <div className="flex w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5 sm:w-auto">
          {SALES_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
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
        {nextUpcoming && (
          <div className={clsx(showSeasonScope || showLeagueScope ? "mt-3" : "")}>
            <UpcomingMatchSummary match={nextUpcoming} mode={activeTab} />
          </div>
        )}
        <div
          className={clsx(
            (showSeasonScope || showLeagueScope || nextUpcoming) && "mt-3",
          )}
          style={{ height: chartHeight }}
          key={`${activeTab}-${seasonScope}-${leagueScope}`}
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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeTicketsMatchCumulativeSeries } from "@/lib/filters";
import { MOCK_TODAY } from "@/lib/mock/constants";
import { formatShortMonthYear } from "@/lib/format";
import { DEFAULT_TICKET_FILTERS } from "@/lib/ticket-filter-options";
import * as seasonMatchChart from "@/lib/tickets-season-match-chart";
import {
  aggregateSeasonMatchChartRowsByGrouping,
  buildSeasonMatchChartRows,
  buildSeasonMatchSelectorOptions,
  buildSeasonMatchSeriesViews,
  buildSeasonMatchXAxisTicks,
  computeSeasonMatchStatus,
  formatSeasonMatchAxisLabel,
  formatSeasonMatchDateLabel,
  fromSeasonMatchSelectorValue,
  getSeasonMatchChartWidth,
  getSeasonMatchAxisTickOffsets,
  isSeasonMatchCurrentlyOnSale,
  SEASON_MATCH_CHART_DAY_WIDTH,
  SEASON_MATCH_CHART_MIN_WIDTH,
  SEASON_MATCH_CHART_MOBILE_MAX_WIDTH,
  SEASON_MATCH_AXIS_STAGGER_DY,
  SEASON_MATCH_CURRENT_SALES_LABEL,
  SEASON_MATCH_CURRENT_SALES_VALUE,
  SEASON_MATCH_LAST_COMPLETED_FALLBACK_COUNT,
  seasonMatchFactKey,
  seasonMatchPlanKey,
  selectSeasonMatchChartViews,
  toSeasonMatchSelectorValue,
} from "@/lib/tickets-season-match-chart";
import type {
  TicketMatchCumulativePoint,
  TicketMatchCumulativeSeries,
  TicketsSeasonMatchChartRow,
  TicketsSeasonMatchSeriesView,
} from "@/types/dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;

function makePoint(
  daysBeforeMatch: number,
  matchDateKey: number,
  revenue: number | null,
): TicketMatchCumulativePoint {
  const dateKey = matchDateKey - daysBeforeMatch * DAY_MS;
  return {
    date: "01.01.26",
    dateKey,
    daysBeforeMatch,
    revenue,
    tickets: revenue == null ? null : Math.round(revenue / 1000),
    planRevenue: 1_000_000,
    planTickets: 1000,
  };
}

function makeSeries(
  overrides: Partial<TicketMatchCumulativeSeries> & {
    matchId: string;
    matchDateKey: number;
  },
): TicketMatchCumulativeSeries {
  const matchDateKey = overrides.matchDateKey;
  const opponent = overrides.label?.split(" · ")[0] ?? overrides.matchId;
  return {
    label: `${opponent} · 01.05.26`,
    color: "#111111",
    league: "KHL",
    season: "2025/26",
    matchClass: "class_1",
    eventCompleted: false,
    hasFactSales: true,
    planRevenue: 1_000_000,
    planTickets: 1000,
    currentDaysBeforeMatch: 4,
    points: [
      makePoint(10, matchDateKey, 100_000),
      makePoint(4, matchDateKey, 400_000),
      makePoint(0, matchDateKey, 800_000),
    ],
    ...overrides,
  };
}

function viewIds(views: TicketsSeasonMatchSeriesView[]): string[] {
  return views.map((view) => view.matchId);
}

describe("tickets season match chart — current sales selection", () => {
  it("treats a match as currently on sale only while unfinished and in the sales window", () => {
    expect(
      isSeasonMatchCurrentlyOnSale({
        eventCompleted: false,
        currentDaysBeforeMatch: 3,
      }),
    ).toBe(true);
    expect(
      isSeasonMatchCurrentlyOnSale({
        eventCompleted: false,
        currentDaysBeforeMatch: 0,
      }),
    ).toBe(true);
    expect(
      isSeasonMatchCurrentlyOnSale({
        eventCompleted: false,
        currentDaysBeforeMatch: null,
      }),
    ).toBe(false);
    expect(
      isSeasonMatchCurrentlyOnSale({
        eventCompleted: true,
        currentDaysBeforeMatch: 2,
      }),
    ).toBe(false);
    expect(
      isSeasonMatchCurrentlyOnSale({
        eventCompleted: true,
        currentDaysBeforeMatch: null,
      }),
    ).toBe(false);
  });

  it("marks series views as on sale using the same current-sales rule", () => {
    const views = buildSeasonMatchSeriesViews([
      makeSeries({
        matchId: "on-sale",
        matchDateKey: Date.UTC(2026, 4, 20),
        eventCompleted: false,
        currentDaysBeforeMatch: 5,
        label: "СКА · 20.05.26",
      }),
      makeSeries({
        matchId: "future",
        matchDateKey: Date.UTC(2026, 4, 30),
        eventCompleted: false,
        currentDaysBeforeMatch: null,
        label: "ЦСКА · 30.05.26",
      }),
      makeSeries({
        matchId: "done",
        matchDateKey: Date.UTC(2026, 3, 10),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Ак Барс · 10.04.26",
      }),
    ]);

    expect(views.find((view) => view.matchId === "on-sale")?.isOnSale).toBe(
      true,
    );
    expect(views.find((view) => view.matchId === "future")?.isOnSale).toBe(
      false,
    );
    expect(views.find((view) => view.matchId === "done")?.isOnSale).toBe(false);
  });

  it("defaults to current on-sale matches and keeps plan vs fact keys", () => {
    const series = [
      makeSeries({
        matchId: "sale-a",
        matchDateKey: Date.UTC(2026, 4, 17),
        eventCompleted: false,
        currentDaysBeforeMatch: 2,
        label: "Динамо Мск · 17.05.26",
      }),
      makeSeries({
        matchId: "sale-b",
        matchDateKey: Date.UTC(2026, 4, 22),
        eventCompleted: false,
        currentDaysBeforeMatch: 7,
        label: "СКА · 22.05.26",
      }),
      makeSeries({
        matchId: "done",
        matchDateKey: Date.UTC(2026, 3, 1),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Авангард · 01.04.26",
      }),
    ];
    const views = buildSeasonMatchSeriesViews(series);
    const selected = selectSeasonMatchChartViews(views);

    expect(viewIds(selected)).toEqual(["sale-a", "sale-b"]);
    const rows = buildSeasonMatchChartRows(selected, series);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row[seasonMatchFactKey("sale-a")] != null)).toBe(
      true,
    );
    expect(rows.some((row) => row[seasonMatchPlanKey("sale-a")] != null)).toBe(
      true,
    );
    expect(rows.some((row) => row[seasonMatchFactKey("done")] != null)).toBe(
      false,
    );
  });

  it("falls back to the last three completed matches when nothing is on sale", () => {
    const series = [1, 2, 3, 4, 5].map((index) =>
      makeSeries({
        matchId: `done-${index}`,
        matchDateKey: Date.UTC(2026, 2, index),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: `Клуб ${index} · 0${index}.03.26`,
      }),
    );
    const views = buildSeasonMatchSeriesViews(series);
    const selected = selectSeasonMatchChartViews(views);

    expect(SEASON_MATCH_LAST_COMPLETED_FALLBACK_COUNT).toBe(3);
    expect(viewIds(selected)).toEqual(["done-3", "done-4", "done-5"]);
    expect(selected.every((view) => view.eventCompleted)).toBe(true);
    expect(selected.map((view) => view.matchDateKey)).toEqual(
      [...selected.map((view) => view.matchDateKey)].sort((left, right) => left - right),
    );
  });

  it("returns fewer than three completed matches when that is all that exists", () => {
    const series = [
      makeSeries({
        matchId: "future",
        matchDateKey: Date.UTC(2026, 4, 31),
        eventCompleted: false,
        currentDaysBeforeMatch: null,
        label: "Будущий · 31.05.26",
      }),
      makeSeries({
        matchId: "done-a",
        matchDateKey: Date.UTC(2026, 3, 1),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Прошлый А · 01.04.26",
      }),
      makeSeries({
        matchId: "done-b",
        matchDateKey: Date.UTC(2026, 3, 10),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Прошлый Б · 10.04.26",
      }),
    ];
    const selected = selectSeasonMatchChartViews(
      buildSeasonMatchSeriesViews(series),
    );
    expect(viewIds(selected)).toEqual(["done-a", "done-b"]);
  });

  it("shows widget-selected matches even when they are completed", () => {
    const series = [
      makeSeries({
        matchId: "sale",
        matchDateKey: Date.UTC(2026, 4, 20),
        eventCompleted: false,
        currentDaysBeforeMatch: 3,
        label: "СКА · 20.05.26",
      }),
      makeSeries({
        matchId: "done-old",
        matchDateKey: Date.UTC(2026, 2, 1),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Старый · 01.03.26",
      }),
      makeSeries({
        matchId: "done-new",
        matchDateKey: Date.UTC(2026, 4, 1),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Недавний · 01.05.26",
      }),
    ];
    const views = buildSeasonMatchSeriesViews(series);
    const selected = selectSeasonMatchChartViews(views, {
      selectedMatchIds: ["done-old", "sale"],
    });
    expect(viewIds(selected)).toEqual(["sale", "done-old"]);
  });

  it("keeps comparison-mode views when no widget match filter is set", () => {
    const series = [
      makeSeries({
        matchId: "picked",
        matchDateKey: Date.UTC(2026, 4, 17),
        eventCompleted: false,
        currentDaysBeforeMatch: 2,
        seriesRole: "selected",
        label: "Выбранный · 17.05.26",
      }),
      makeSeries({
        matchId: "cmp-1",
        matchDateKey: Date.UTC(2026, 3, 10),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        seriesRole: "comparison",
        label: "Сравнение 1 · 10.04.26",
      }),
      makeSeries({
        matchId: "cmp-2",
        matchDateKey: Date.UTC(2026, 2, 10),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        seriesRole: "comparison",
        label: "Сравнение 2 · 10.03.26",
      }),
    ];
    const selected = selectSeasonMatchChartViews(
      buildSeasonMatchSeriesViews(series),
    );
    expect(viewIds(selected)).toEqual(["picked", "cmp-1", "cmp-2"]);
  });

  it("preserves incoming views when the global match filter already scoped the series", () => {
    const series = [
      makeSeries({
        matchId: "done",
        matchDateKey: Date.UTC(2026, 3, 1),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Завершённый · 01.04.26",
      }),
      makeSeries({
        matchId: "sale",
        matchDateKey: Date.UTC(2026, 4, 20),
        eventCompleted: false,
        currentDaysBeforeMatch: 4,
        label: "В продаже · 20.05.26",
      }),
    ];
    const selected = selectSeasonMatchChartViews(
      buildSeasonMatchSeriesViews(series),
      { preserveIncomingViews: true },
    );
    expect(viewIds(selected)).toEqual(["done", "sale"]);
  });

  it("lets a widget match filter override preserved incoming views", () => {
    const series = [
      makeSeries({
        matchId: "done",
        matchDateKey: Date.UTC(2026, 3, 1),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Завершённый · 01.04.26",
      }),
      makeSeries({
        matchId: "sale",
        matchDateKey: Date.UTC(2026, 4, 20),
        eventCompleted: false,
        currentDaysBeforeMatch: 4,
        label: "В продаже · 20.05.26",
      }),
    ];
    const selected = selectSeasonMatchChartViews(
      buildSeasonMatchSeriesViews(series),
      { preserveIncomingViews: true, selectedMatchIds: ["done"] },
    );
    expect(viewIds(selected)).toEqual(["done"]);
  });

  it("no longer exports the removed status chips", () => {
    expect(seasonMatchChart).not.toHaveProperty("SEASON_MATCH_QUICK_FILTERS");
    expect(seasonMatchChart).not.toHaveProperty("filterSeasonMatchSeriesViews");
  });

  it("removes the status-chip buttons from the widget UI", () => {
    const widget = readFileSync(
      join(process.cwd(), "components/widgets/TicketsSeasonMatchDynamicsWidget.tsx"),
      "utf8",
    );
    const mobile = readFileSync(
      join(
        process.cwd(),
        "components/widgets/tickets-season-match/MobileMatchSelector.tsx",
      ),
      "utf8",
    );

    for (const source of [widget, mobile]) {
      expect(source).not.toContain("В продаже");
      expect(source).not.toContain("Завершенные");
      expect(source).not.toContain("Завершённые");
      expect(source).not.toContain("Выполнили план");
      expect(source).not.toContain("Не выполнили план");
      expect(source).not.toContain("SEASON_MATCH_QUICK_FILTERS");
    }

    expect(widget).toContain("leadingExclusiveOption");
    expect(widget).toContain("SEASON_MATCH_CURRENT_SALES_LABEL");
    expect(widget.indexOf("leadingExclusiveOption")).toBeLessThan(
      widget.indexOf("selectAllLabel"),
    );
  });
});

describe("tickets season match chart — helpers", () => {
  it("classifies plan completion status", () => {
    expect(computeSeasonMatchStatus(80)).toBe("behind");
    expect(computeSeasonMatchStatus(95)).toBe("on_track");
    expect(computeSeasonMatchStatus(100)).toBe("on_track");
    expect(computeSeasonMatchStatus(101)).toBe("ahead");
  });

  it("keeps daily rows as-is for day grouping", () => {
    const matchDateKey = new Date(2026, 4, 20).getTime();
    const series = [
      makeSeries({
        matchId: "sale",
        matchDateKey,
        eventCompleted: false,
        currentDaysBeforeMatch: 3,
        label: "СКА · 20.05.26",
        points: [
          makePoint(6, matchDateKey, 100_000),
          makePoint(5, matchDateKey, 200_000),
          makePoint(0, matchDateKey, 500_000),
        ],
      }),
    ];
    const views = buildSeasonMatchSeriesViews(series);
    const daily = buildSeasonMatchChartRows(views, series);
    expect(
      aggregateSeasonMatchChartRowsByGrouping(daily, views, "day"),
    ).toBe(daily);
  });

  it("aggregates daily rows by week using the period-end cumulative snapshot", () => {
    const matchDateKey = new Date(2026, 4, 20).getTime();
    const series = [
      makeSeries({
        matchId: "sale",
        matchDateKey,
        eventCompleted: false,
        currentDaysBeforeMatch: 0,
        label: "СКА · 20.05.26",
        points: [
          makePoint(7, matchDateKey, 100_000),
          makePoint(6, matchDateKey, 150_000),
          makePoint(5, matchDateKey, 200_000),
          makePoint(2, matchDateKey, 400_000),
          makePoint(0, matchDateKey, 500_000),
        ],
      }),
    ];
    const views = buildSeasonMatchSeriesViews(series);
    const daily = buildSeasonMatchChartRows(views, series);
    const weekly = aggregateSeasonMatchChartRowsByGrouping(
      daily,
      views,
      "week",
    );
    const factKey = seasonMatchFactKey("sale");
    const planKey = seasonMatchPlanKey("sale");

    expect(daily.length).toBe(5);
    expect(weekly.length).toBe(2);
    expect(weekly.length).toBeLessThan(daily.length);
    expect(weekly[0][factKey]).toBe(200_000);
    expect(weekly[1][factKey]).toBe(500_000);
    expect(weekly[0][planKey]).toBeNull();
    expect(weekly[1][planKey]).toBe(1_000_000);
    expect(weekly.map((row) => row.dateKey)).toEqual([
      daily[2].dateKey,
      daily[4].dateKey,
    ]);
  });

  it("does not week-collapse an upcoming match onto today as if it already played", () => {
    const todayKey = new Date(2026, 4, 15).getTime();
    const upcomingKey = new Date(2026, 4, 17).getTime();
    const series = [
      makeSeries({
        matchId: "today-match",
        matchDateKey: todayKey,
        eventCompleted: false,
        currentDaysBeforeMatch: 0,
        label: "Динамо Мск · 15.05.26",
        points: [
          makePoint(4, todayKey, 100_000),
          makePoint(0, todayKey, 500_000),
        ],
      }),
      makeSeries({
        matchId: "upcoming-match",
        matchDateKey: upcomingKey,
        eventCompleted: false,
        currentDaysBeforeMatch: 2,
        label: "Динамо Мск · 17.05.26",
        points: [
          makePoint(4, upcomingKey, 120_000),
          makePoint(2, upcomingKey, 480_000),
          makePoint(0, upcomingKey, null),
        ],
      }),
    ];
    const views = selectSeasonMatchChartViews(
      buildSeasonMatchSeriesViews(series),
    );
    expect(viewIds(views)).toEqual(["today-match", "upcoming-match"]);
    expect(views.map((view) => view.matchDate)).toEqual([
      "15.05.26",
      "17.05.26",
    ]);

    const daily = buildSeasonMatchChartRows(views, series);
    const weekly = aggregateSeasonMatchChartRowsByGrouping(
      daily,
      views,
      "week",
    );
    const factUpcoming = seasonMatchFactKey("upcoming-match");
    const planToday = seasonMatchPlanKey("today-match");
    const planUpcoming = seasonMatchPlanKey("upcoming-match");

    for (const rows of [daily, weekly]) {
      const planTodayRow = rows.find((row) => row[planToday] != null);
      const planUpcomingRow = rows.find((row) => row[planUpcoming] != null);
      expect(planTodayRow?.dateKey).toBe(todayKey);
      expect(planUpcomingRow?.dateKey).toBe(upcomingKey);
      expect(planTodayRow?.dateKey).not.toBe(planUpcomingRow?.dateKey);

      const lastFactUpcoming = [...rows]
        .reverse()
        .find((row) => row[factUpcoming] != null);
      expect(lastFactUpcoming?.dateKey).toBe(todayKey);
      expect(lastFactUpcoming?.[planUpcoming]).toBeNull();
      expect(
        rows.find((row) => row.dateKey === upcomingKey)?.[factUpcoming],
      ).toBeNull();
    }
  });

  it("aggregates daily rows by month using the period-end cumulative snapshot", () => {
    const matchDateKey = new Date(2026, 4, 20).getTime();
    const series = [
      makeSeries({
        matchId: "sale",
        matchDateKey,
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "СКА · 20.05.26",
        points: [
          makePoint(22, matchDateKey, 80_000),
          makePoint(15, matchDateKey, 180_000),
          makePoint(0, matchDateKey, 500_000),
        ],
      }),
    ];
    const views = buildSeasonMatchSeriesViews(series);
    const daily = buildSeasonMatchChartRows(views, series);
    const monthly = aggregateSeasonMatchChartRowsByGrouping(
      daily,
      views,
      "month",
    );
    const factKey = seasonMatchFactKey("sale");
    const planKey = seasonMatchPlanKey("sale");

    expect(daily.length).toBe(3);
    expect(monthly.length).toBe(2);
    expect(monthly[0][factKey]).toBe(80_000);
    expect(monthly[1][factKey]).toBe(500_000);
    expect(monthly[1][planKey]).toBe(1_000_000);
    expect(monthly.map((row) => row.dateKey)).toEqual([
      daily[0].dateKey,
      daily[2].dateKey,
    ]);
  });

  it("wires the widget and dashboard to the same grouping prop as sibling ticket charts", () => {
    const widget = readFileSync(
      join(process.cwd(), "components/widgets/TicketsSeasonMatchDynamicsWidget.tsx"),
      "utf8",
    );
    const dashboard = readFileSync(
      join(process.cwd(), "app/dashboard-app.tsx"),
      "utf8",
    );
    const filterContext = readFileSync(
      join(process.cwd(), "context/FilterContext.tsx"),
      "utf8",
    );

    expect(widget).toContain("aggregateSeasonMatchChartRowsByGrouping");
    expect(widget).toContain("timeGrouping");
    expect(dashboard).toContain("TicketsMatchDynamicsSection");
    expect(dashboard).toMatch(
      /TicketsSeasonMatchDynamicsWidget[\s\S]*timeGrouping=\{ticketChartTimeGrouping\}/,
    );
    expect(filterContext).toContain("timeGrouping: grouping");
  });

  it("places tickets sales full-bleed with charts stacked below, not in a side column", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "app/dashboard-app.tsx"),
      "utf8",
    );
    const ticketsStart = dashboard.indexOf('{activeTab === "tickets" && (');
    const merchStart = dashboard.indexOf('{activeTab === "merch" && (');
    expect(ticketsStart).toBeGreaterThan(-1);
    expect(merchStart).toBeGreaterThan(ticketsStart);
    const ticketsBlock = dashboard.slice(ticketsStart, merchStart);

    expect(ticketsBlock).toMatch(
      /TicketsSalesSection[\s\S]*TicketsMatchDynamicsSection[\s\S]*TicketsPlanFactWidget/,
    );
    expect(ticketsBlock).not.toContain("TicketsZoneSectorWidget");
    expect(ticketsBlock).not.toContain("TICKETS_TWO_COL_GRID_CLASS");
    expect(ticketsBlock).not.toMatch(
      /grid-cols-\[minmax\(0,1\.2fr\)_minmax\(0,1fr\)\]/,
    );
  });

  it("keeps the hover tooltip from being clipped by the chart scroll box", () => {
    const chart = readFileSync(
      join(
        process.cwd(),
        "components/widgets/tickets-season-match/TicketsSeasonMatchChart.tsx",
      ),
      "utf8",
    );
    const adaptive = readFileSync(
      join(process.cwd(), "components/charts/AdaptiveTooltip.tsx"),
      "utf8",
    );
    const tooltip = readFileSync(
      join(
        process.cwd(),
        "components/widgets/tickets-season-match/TicketsSeasonMatchTooltip.tsx",
      ),
      "utf8",
    );

    expect(chart).toContain("AdaptiveTooltip");
    expect(adaptive).toContain("createPortal");
    expect(adaptive).toContain("document.body");
    expect(adaptive).toContain('AdaptiveTooltip.displayName = "Tooltip"');
    expect(tooltip).toContain("formatSeasonMatchDateLabel");
    expect(tooltip).not.toContain("max-h-72");
  });
});

describe("tickets season match chart — mock series", () => {
  it("computes current-sales curves for default ticket filters", () => {
    const series = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    expect(series.length).toBeGreaterThan(0);

    const views = buildSeasonMatchSeriesViews(series);
    const onSale = views.filter((view) => view.isOnSale);
    const selected = selectSeasonMatchChartViews(views);
    expect(selected.length).toBeGreaterThan(0);

    if (onSale.length > 0) {
      expect(viewIds(selected)).toEqual(viewIds(onSale));
      expect(
        selected.every(
          (view) => !view.eventCompleted && view.isOnSale,
        ),
      ).toBe(true);
    } else {
      expect(selected).toHaveLength(SEASON_MATCH_LAST_COMPLETED_FALLBACK_COUNT);
      expect(selected.every((view) => view.eventCompleted)).toBe(true);
    }

    const rows = buildSeasonMatchChartRows(selected, series);
    expect(rows.length).toBeGreaterThan(0);
    for (const view of selected) {
      expect(
        rows.some((row) => row[seasonMatchFactKey(view.matchId)] != null),
      ).toBe(true);
    }
  });

  it("does not keep a May 15 Dynamo regular-season current-sales demo", () => {
    expect(format(MOCK_TODAY, "dd.MM.yyyy")).toBe("25.03.2026");

    const series = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const views = buildSeasonMatchSeriesViews(series);
    expect(
      views.some(
        (view) =>
          view.opponent.includes("Динамо Мск") ||
          view.matchDate.includes("15.05") ||
          view.matchDate.includes("17.05"),
      ),
    ).toBe(false);

    const regularKhl = series.filter(
      (item) => item.league === "KHL" && item.eventCompleted,
    );
    expect(regularKhl.length).toBeGreaterThanOrEqual(34);
  });

  it("shows current-sales curves for upcoming KHL playoff Ак Барс", () => {
    const series = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const views = buildSeasonMatchSeriesViews(series);
    expect(views.some((view) => view.isOnSale)).toBe(true);

    const selected = selectSeasonMatchChartViews(views);
    expect(selected.every((view) => !view.eventCompleted && view.isOnSale)).toBe(
      true,
    );
    expect(selected.map((view) => view.opponent)).toEqual(["Ак Барс", "Ак Барс"]);
  });

  it("falls back to the last three completed matches when the tab has only finished games", () => {
    const series = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      { ...DEFAULT_TICKET_FILTERS, eventCompleted: "yes" },
    );
    expect(series.length).toBeGreaterThanOrEqual(3);
    expect(series.every((item) => item.eventCompleted)).toBe(true);

    const selected = selectSeasonMatchChartViews(
      buildSeasonMatchSeriesViews(series),
    );
    const expected = [...series]
      .sort((left, right) => right.matchDateKey - left.matchDateKey)
      .slice(0, 3)
      .sort((left, right) => left.matchDateKey - right.matchDateKey)
      .map((item) => item.matchId);

    expect(viewIds(selected)).toEqual(expected);
  });

  it("keeps the selected match plus same-class comparison series for a global match filter", () => {
    const allSeries = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const completed = allSeries.find((item) => item.eventCompleted);
    expect(completed).toBeDefined();

    const series = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      { ...DEFAULT_TICKET_FILTERS, matchId: [completed!.matchId] },
    );
    expect(series.some((item) => item.seriesRole === "selected")).toBe(true);
    expect(series.some((item) => item.matchId === completed!.matchId)).toBe(
      true,
    );

    const selected = selectSeasonMatchChartViews(
      buildSeasonMatchSeriesViews(series),
    );
    expect(viewIds(selected)).toEqual(series.map((item) => item.matchId));
  });
});

describe("tickets season match chart — current sales selector", () => {
  it("puts Текущие продажи first and restores auto mode when it is selected", () => {
    const series = [
      makeSeries({
        matchId: "sale",
        matchDateKey: Date.UTC(2026, 4, 17),
        eventCompleted: false,
        currentDaysBeforeMatch: 2,
        label: "Динамо Мск · 17.05.26",
      }),
      makeSeries({
        matchId: "done",
        matchDateKey: Date.UTC(2026, 3, 1),
        eventCompleted: true,
        currentDaysBeforeMatch: null,
        label: "Авангард · 01.04.26",
      }),
    ];
    const views = buildSeasonMatchSeriesViews(series);
    const options = buildSeasonMatchSelectorOptions(views);

    expect(options[0]).toEqual({
      value: SEASON_MATCH_CURRENT_SALES_VALUE,
      label: SEASON_MATCH_CURRENT_SALES_LABEL,
    });
    expect(options[0].label).toBe("Текущие продажи");
    expect(options.slice(1).map((option) => option.value)).toEqual([
      "done",
      "sale",
    ]);

    expect(toSeasonMatchSelectorValue([])).toEqual([
      SEASON_MATCH_CURRENT_SALES_VALUE,
    ]);
    expect(
      fromSeasonMatchSelectorValue(
        ["sale"],
        [SEASON_MATCH_CURRENT_SALES_VALUE],
      ),
    ).toEqual([]);
    expect(
      fromSeasonMatchSelectorValue(
        [],
        [SEASON_MATCH_CURRENT_SALES_VALUE, "done"],
      ),
    ).toEqual(["done"]);
    expect(fromSeasonMatchSelectorValue(["sale"], ["sale", "done"])).toEqual([
      "sale",
      "done",
    ]);

    const autoViews = selectSeasonMatchChartViews(views, {
      selectedMatchIds: fromSeasonMatchSelectorValue(
        ["done"],
        [SEASON_MATCH_CURRENT_SALES_VALUE],
      ),
    });
    expect(viewIds(autoViews)).toEqual(["sale"]);
  });
});

describe("tickets season match chart — x-axis ticks", () => {
  const seasonStart = new Date(2025, 7, 11).getTime();
  const saleStartJan = new Date(2026, 0, 19).getTime();
  const matchFeb3 = new Date(2026, 1, 3).getTime();
  const saleStartMar = new Date(2026, 2, 2).getTime();
  const matchMar14 = new Date(2026, 2, 14).getTime();
  const seasonEnd = new Date(2026, 3, 22).getTime();

  function seasonRows(): TicketsSeasonMatchChartRow[] {
    return [
      { dateKey: seasonStart, periodLabel: "11 авг." },
      { dateKey: saleStartJan, periodLabel: "19 янв" },
      { dateKey: matchFeb3, periodLabel: "03 фев" },
      { dateKey: saleStartMar, periodLabel: "02 мар" },
      { dateKey: matchMar14, periodLabel: "14 мар" },
      { dateKey: seasonEnd, periodLabel: "22 апр." },
    ];
  }

  function axisLabels(
    rows: TicketsSeasonMatchChartRow[],
    matchDateKeys: number[],
    chartWidth = 900,
  ) {
    const ticks = buildSeasonMatchXAxisTicks(rows, {
      grouping: "week",
      matchDateKeys,
      chartWidth,
    });
    return {
      ticks,
      labels: ticks.map((tick) =>
        formatSeasonMatchAxisLabel(tick, rows, matchDateKeys),
      ),
    };
  }

  it("keeps match dates and month ticks, dropping nearby sale-start labels", () => {
    const rows = seasonRows();
    const matchDateKeys = [matchFeb3, matchMar14];
    const { ticks, labels } = axisLabels(rows, matchDateKeys);

    expect(labels).toContain("03.02.26");
    expect(labels).toContain("14.03.26");
    expect(labels).not.toContain("19 янв");
    expect(labels).not.toContain("02 мар");
    expect(labels).not.toContain("11 авг.");

    expect(ticks).not.toContain(saleStartJan);
    expect(ticks).not.toContain(saleStartMar);
    expect(ticks).toContain(matchFeb3);
    expect(ticks).toContain(matchMar14);

    const februaryStart = new Date(2026, 1, 1).getTime();
    expect(ticks).not.toContain(februaryStart);

    expect(labels).toContain(formatShortMonthYear(new Date(2026, 0, 1)));
  });

  it("shows only the match date on a short campaign window", () => {
    const rows: TicketsSeasonMatchChartRow[] = [
      { dateKey: saleStartJan, periodLabel: "19 янв" },
      { dateKey: matchFeb3, periodLabel: "03 фев" },
    ];
    const { ticks, labels } = axisLabels(rows, [matchFeb3], 420);

    expect(labels).toEqual(["03.02.26"]);
    expect(ticks).toEqual([matchFeb3]);
  });

  it("keeps close match dates and staggers the later label", () => {
    const first = new Date(2026, 4, 15).getTime();
    const second = new Date(2026, 4, 17).getTime();
    const rows: TicketsSeasonMatchChartRow[] = [
      { dateKey: new Date(2026, 3, 20).getTime(), periodLabel: "20 апр" },
      { dateKey: first, periodLabel: "15 мая" },
      { dateKey: second, periodLabel: "17 мая" },
    ];
    const matchDateKeys = [first, second];
    const { ticks, labels } = axisLabels(rows, matchDateKeys, 760);

    expect(labels).toContain("15.05.26");
    expect(labels).toContain("17.05.26");

    const offsets = getSeasonMatchAxisTickOffsets(ticks, rows, 760);
    expect(offsets.get(first)).toBe(0);
    expect(offsets.get(second)).toBe(SEASON_MATCH_AXIS_STAGGER_DY);
  });

  it("formats match ticks as dd.MM.yy and month ticks as short month+year", () => {
    expect(formatSeasonMatchDateLabel(matchFeb3)).toBe("03.02.26");
    expect(
      formatSeasonMatchAxisLabel(
        new Date(2026, 0, 1).getTime(),
        seasonRows(),
        [matchFeb3],
      ),
    ).toBe(formatShortMonthYear(new Date(2026, 0, 1)));
    expect(
      formatSeasonMatchAxisLabel(matchFeb3, seasonRows(), [matchFeb3]),
    ).toBe("03.02.26");
  });
});

describe("getSeasonMatchChartWidth", () => {
  function makeRows(count: number): TicketsSeasonMatchChartRow[] {
    return Array.from({ length: count }, (_, index) => ({
      dateKey: index,
      periodLabel: String(index),
    }));
  }

  it("uses the min width floor for a sparse series", () => {
    expect(getSeasonMatchChartWidth(makeRows(5))).toBe(
      SEASON_MATCH_CHART_MIN_WIDTH,
    );
    expect(getSeasonMatchChartWidth(makeRows(1))).toBe(
      SEASON_MATCH_CHART_MIN_WIDTH,
    );
  });

  it("grows past the min width for a dense day series", () => {
    const rows = makeRows(30);
    expect(getSeasonMatchChartWidth(rows)).toBe(
      30 * SEASON_MATCH_CHART_DAY_WIDTH,
    );
  });

  it("stretches to the container when the data min-width is smaller", () => {
    expect(
      getSeasonMatchChartWidth(makeRows(5), { containerWidth: 1200 }),
    ).toBe(1200);
  });

  it("keeps horizontal overflow when the data min-width exceeds the container", () => {
    const rows = makeRows(40);
    const dataWidth = 40 * SEASON_MATCH_CHART_DAY_WIDTH;
    expect(dataWidth).toBeGreaterThan(1200);
    expect(getSeasonMatchChartWidth(rows, { containerWidth: 1200 })).toBe(
      dataWidth,
    );
  });

  it("fills a narrower card instead of keeping the 760px floor", () => {
    expect(
      getSeasonMatchChartWidth(makeRows(5), { containerWidth: 574 }),
    ).toBe(574);
  });

  it("still caps mobile width for a dense series", () => {
    expect(
      getSeasonMatchChartWidth(makeRows(40), {
        maxWidth: SEASON_MATCH_CHART_MOBILE_MAX_WIDTH,
        containerWidth: 390,
      }),
    ).toBe(SEASON_MATCH_CHART_MOBILE_MAX_WIDTH);
  });

  it("stretches a sparse series to the mobile container", () => {
    expect(
      getSeasonMatchChartWidth(makeRows(5), {
        maxWidth: SEASON_MATCH_CHART_MOBILE_MAX_WIDTH,
        containerWidth: 390,
      }),
    ).toBe(390);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeTicketsMatchCumulativeSeries } from "@/lib/filters";
import { MOCK_TODAY } from "@/lib/mock/constants";
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
  fromSeasonMatchSelectorValue,
  isSeasonMatchCurrentlyOnSale,
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

  it("aggregates daily rows by week using the period-end snapshot", () => {
    const series = [
      makeSeries({
        matchId: "sale",
        matchDateKey: Date.UTC(2026, 4, 20),
        eventCompleted: false,
        currentDaysBeforeMatch: 3,
        label: "СКА · 20.05.26",
        points: [
          makePoint(6, Date.UTC(2026, 4, 20), 100_000),
          makePoint(5, Date.UTC(2026, 4, 20), 200_000),
          makePoint(0, Date.UTC(2026, 4, 20), 500_000),
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
    expect(weekly.length).toBeGreaterThan(0);
    expect(weekly.length).toBeLessThanOrEqual(daily.length);
    const lastWeekly = weekly[weekly.length - 1];
    expect(lastWeekly[seasonMatchPlanKey("sale")]).toBe(1_000_000);
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
    expect(onSale.length).toBeGreaterThan(0);

    const selected = selectSeasonMatchChartViews(views);
    expect(viewIds(selected)).toEqual(viewIds(onSale));
    expect(
      selected.every(
        (view) => !view.eventCompleted && view.isOnSale,
      ),
    ).toBe(true);

    const rows = buildSeasonMatchChartRows(selected, series);
    expect(rows.length).toBeGreaterThan(0);
    for (const view of selected) {
      expect(
        rows.some((row) => row[seasonMatchFactKey(view.matchId)] != null),
      ).toBe(true);
    }
  });

  it("includes Dynamo Msk 17.05.2026 in current sales with the match date on labels and the axis", () => {
    expect(format(MOCK_TODAY, "dd.MM.yyyy")).toBe("15.05.2026");

    const series = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const views = buildSeasonMatchSeriesViews(series);
    const selected = selectSeasonMatchChartViews(views);
    const dynamo17 = selected.find(
      (view) =>
        view.matchId === "match-16" ||
        (view.opponent.includes("Динамо Мск") &&
          view.matchDate.includes("17.05")),
    );

    expect(dynamo17).toBeDefined();
    expect(dynamo17?.isOnSale).toBe(true);
    expect(dynamo17?.eventCompleted).toBe(false);
    expect(dynamo17?.matchDate).toBe("17.05.26");
    expect(dynamo17?.legendLabel).toContain("17.05.26");
    expect(dynamo17?.legendLabel).toContain("Динамо Мск");

    const daily = buildSeasonMatchChartRows(selected, series);
    const weekly = aggregateSeasonMatchChartRowsByGrouping(
      daily,
      selected,
      "week",
    );
    const matchDateKeys = selected.map((view) => view.matchDateKey);
    const weeklyLabels = buildSeasonMatchXAxisTicks(weekly, {
      grouping: "week",
      matchDateKeys,
    }).map((tick) => formatSeasonMatchAxisLabel(tick, weekly, matchDateKeys));
    const dailyLabels = buildSeasonMatchXAxisTicks(daily, {
      matchDateKeys,
    }).map((tick) => formatSeasonMatchAxisLabel(tick, daily, matchDateKeys));

    expect(weeklyLabels).toContain("17.05.26");
    expect(dailyLabels).toContain("17.05.26");
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

import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import {
  computeMatchSalesTable,
  computeTicketsKpis,
  computeTicketsMatchCumulativeSeries,
  filterTicketTransactions,
} from "@/lib/filters";
import {
  CONFIRM_SCENARIO,
  FIXTURE_CURRENT_MATCH_ID,
  FIXTURE_DASHBOARD_FILTERS,
  FIXTURE_EMPTY_MATCH_ID,
  FIXTURE_INCOMPLETE_MATCH_ID,
  FIXTURE_PREV_MATCH_ID,
  FIXTURE_TICKET_FILTERS,
  computeFixtureMatchSalesTable,
  expectedByPriceZone,
  expectedByTicketType,
  expectedIncompleteMatchMetrics,
  expectedMatchMetrics,
  expectedPrevMatchMetrics,
} from "@/lib/match-sales-tree.fixture";
import { MATCH_SALES_SECTION_LABELS } from "@/lib/match-sales-tree";
import {
  DEFAULT_TICKET_FILTERS,
  NO_MATCHES_FILTER_VALUE,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-filter-options";
import type { TicketFilters } from "@/types/dashboard";

function filters(patch: Partial<TicketFilters>): TicketFilters {
  return { ...FIXTURE_TICKET_FILTERS, ...patch };
}

function findSection(
  tree: ReturnType<typeof computeFixtureMatchSalesTable>["tree"],
  matchId: string,
  kind: keyof typeof MATCH_SALES_SECTION_LABELS,
) {
  const match = tree.find((node) => node.matchId === matchId);
  return match?.children.find(
    (child) => child.label === MATCH_SALES_SECTION_LABELS[kind],
  );
}

describe("§7, §9 global filters (local widget filters removed)", () => {
  it("filters by season", () => {
    const current = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ season: "2025/26" }),
    );
    expect(current.tree.map((node) => node.matchId)).toEqual([
      FIXTURE_INCOMPLETE_MATCH_ID,
      FIXTURE_CURRENT_MATCH_ID,
    ]);

    const prev = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ season: "2024/25" }),
    );
    expect(prev.tree.map((node) => node.matchId)).toEqual([FIXTURE_PREV_MATCH_ID]);
    expect(prev.tree[0]?.revenue).toBe(expectedPrevMatchMetrics.revenue);
  });

  it("filters by league, stage, class, arena, finished", () => {
    expect(
      computeFixtureMatchSalesTable(
        FIXTURE_DASHBOARD_FILTERS,
        filters({ league: "MHL" }),
      ).tree.map((n) => n.matchId),
    ).toEqual([FIXTURE_INCOMPLETE_MATCH_ID]);

    expect(
      computeFixtureMatchSalesTable(
        FIXTURE_DASHBOARD_FILTERS,
        filters({ tournamentStage: "playoff" }),
      ).tree,
    ).toHaveLength(0);

    expect(
      computeFixtureMatchSalesTable(
        FIXTURE_DASHBOARD_FILTERS,
        filters({ matchClass: "class_1" }),
      ).tree.map((n) => n.matchId),
    ).toEqual([FIXTURE_CURRENT_MATCH_ID]);

    expect(
      computeFixtureMatchSalesTable(
        FIXTURE_DASHBOARD_FILTERS,
        filters({ series: "Сентябрь" }),
      ).tree.map((n) => n.matchId),
    ).toEqual([FIXTURE_CURRENT_MATCH_ID]);

    expect(
      computeFixtureMatchSalesTable(
        FIXTURE_DASHBOARD_FILTERS,
        filters({ series: "ПО. Ак Барс" }),
      ).tree,
    ).toHaveLength(0);

    expect(
      computeFixtureMatchSalesTable(
        FIXTURE_DASHBOARD_FILTERS,
        filters({ arena: "secondary" }),
      ).tree.map((n) => n.matchId),
    ).toEqual([FIXTURE_INCOMPLETE_MATCH_ID]);

    const unfinished = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ eventCompleted: "no" }),
    );
    expect(unfinished.tree.some((n) => n.matchId === FIXTURE_EMPTY_MATCH_ID)).toBe(
      false,
    );
    expect(unfinished.tree).toHaveLength(0);

    const finished = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ eventCompleted: "yes" }),
    );
    expect(finished.tree.every((n) => n.matchId !== FIXTURE_EMPTY_MATCH_ID)).toBe(
      true,
    );
    expect(finished.tree.length).toBe(3);
  });

  it("filters by match id with OR within the multi-select", () => {
    const one = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ matchId: [FIXTURE_CURRENT_MATCH_ID] }),
    );
    expect(one.tree.map((n) => n.matchId)).toEqual([FIXTURE_CURRENT_MATCH_ID]);

    const two = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({
        matchId: [FIXTURE_CURRENT_MATCH_ID, FIXTURE_PREV_MATCH_ID],
      }),
    );
    expect(two.tree.map((n) => n.matchId).sort()).toEqual(
      [FIXTURE_CURRENT_MATCH_ID, FIXTURE_PREV_MATCH_ID].sort(),
    );
  });

  it("filters by ticket type, order source, price zone, purchase date", () => {
    const parking = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ ticketType: "parking", matchId: [FIXTURE_CURRENT_MATCH_ID] }),
    );
    expect(parking.tree).toHaveLength(1);
    expect(parking.tree[0]?.revenue).toBe(expectedByTicketType.parking.revenue);
    expect(
      findSection(parking.tree, FIXTURE_CURRENT_MATCH_ID, "priceZone"),
    ).toBeUndefined();
    expect(
      findSection(
        parking.tree,
        FIXTURE_CURRENT_MATCH_ID,
        "ticketType",
      )?.children.map((c) => c.label),
    ).toEqual([TICKET_TYPE_LABELS.parking]);

    const source = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({
        orderSource: "yandex_afisha",
        matchId: [FIXTURE_CURRENT_MATCH_ID],
      }),
    );
    expect(source.tree[0]?.revenue).toBe(15_000);
    expect(source.tree[0]?.ticketsSold).toBe(5);

    const zone = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({
        priceZone: CONFIRM_SCENARIO.priceZone,
        matchId: [CONFIRM_SCENARIO.matchId],
      }),
    );
    expect(zone.tree[0]?.revenue).toBe(CONFIRM_SCENARIO.expected.revenue);
    expect(zone.tree[0]?.ticketsSold).toBe(CONFIRM_SCENARIO.expected.sold);
    expect(
      findSection(zone.tree, CONFIRM_SCENARIO.matchId, "priceZone")?.children.map(
        (c) => c.label,
      ),
    ).toEqual([PRICE_ZONE_LABELS[CONFIRM_SCENARIO.priceZone]]);

    const dated = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({
        matchId: [FIXTURE_CURRENT_MATCH_ID],
        transactionDateRange: { from: "2025-10-05", to: "2025-10-08" },
      }),
    );
    expect(dated.tree[0]?.revenue).toBe(16_000 + 15_000);
    expect(dated.tree[0]?.ticketsSold).toBe(8 + 5);

    const sectorA = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({
        matchId: [FIXTURE_CURRENT_MATCH_ID],
        sector: ["A"],
      }),
    );
    expect(sectorA.txs.map((tx) => tx.id)).toEqual(["fx-tx-a1"]);
    expect(sectorA.tree[0]?.revenue).toBe(10_000);
    expect(sectorA.tree[0]?.ticketsSold).toBe(10);
    expect(sectorA.txs.every((tx) => tx.ticketType !== "parking")).toBe(true);
    const cheapZone = findSection(
      sectorA.tree,
      FIXTURE_CURRENT_MATCH_ID,
      "priceZone",
    )?.children.find((child) => child.label === PRICE_ZONE_LABELS.up_to_1500);
    expect(cheapZone?.children.map((child) => child.label)).toEqual(["A"]);
    expect(cheapZone?.children.some((child) => child.label === "D1")).toBe(
      false,
    );
  });

  it("does not change the table when grouping changes", () => {
    const day = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ timeGrouping: "day" }),
    );
    const week = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ timeGrouping: "week" }),
    );
    const month = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ timeGrouping: "month" }),
    );
    expect(week.tree.map((n) => [n.id, n.revenue])).toEqual(
      day.tree.map((n) => [n.id, n.revenue]),
    );
    expect(month.tree.map((n) => [n.id, n.revenue])).toEqual(
      day.tree.map((n) => [n.id, n.revenue]),
    );

    const mockDay = computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_TICKET_FILTERS,
      timeGrouping: "day",
    });
    const mockWeek = computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_TICKET_FILTERS,
      timeGrouping: "week",
    });
    expect(mockWeek.map((row) => [row.matchId, row.revenue, row.issuedTickets])).toEqual(
      mockDay.map((row) => [row.matchId, row.revenue, row.issuedTickets]),
    );
  });

  it("ignores dashboard dateRange the same way computeMatchSalesTable does", () => {
    const a = computeFixtureMatchSalesTable(
      { ...FIXTURE_DASHBOARD_FILTERS, dateRange: 7 },
      FIXTURE_TICKET_FILTERS,
    );
    const b = computeFixtureMatchSalesTable(
      { ...FIXTURE_DASHBOARD_FILTERS, dateRange: 90 },
      FIXTURE_TICKET_FILTERS,
    );
    expect(a.tree.map((n) => n.revenue)).toEqual(b.tree.map((n) => n.revenue));
  });

  it("restores the full fixture set after reset to defaults-for-fixture", () => {
    const narrowed = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ league: "VHL", ticketType: "parking" }),
    );
    expect(narrowed.tree).toHaveLength(0);
    const restored = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      FIXTURE_TICKET_FILTERS,
    );
    expect(restored.tree).toHaveLength(3);
    expect(
      restored.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)?.revenue,
    ).toBe(expectedMatchMetrics.revenue);
  });

  it("returns empty tree / empty-state data when filters exclude everything", () => {
    const none = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ matchId: [NO_MATCHES_FILTER_VALUE] }),
    );
    expect(none.tree).toHaveLength(0);
    expect(none.rows).toHaveLength(0);

    const missing = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ matchId: ["does-not-exist"] }),
    );
    expect(missing.tree).toHaveLength(0);
  });
});

describe("filter combinations (AND across dimensions, OR within matchId)", () => {
  const pairs: Array<[string, Partial<TicketFilters>]> = [
    ["season+league", { season: "2025/26", league: "KHL" }],
    ["league+stage", { league: "KHL", tournamentStage: "regular" }],
    ["class+arena", { matchClass: "class_1", arena: "main" }],
    ["match+ticketType", { matchId: [FIXTURE_CURRENT_MATCH_ID], ticketType: "arena" }],
    [
      "ticketType+orderSource",
      { matchId: [FIXTURE_CURRENT_MATCH_ID], ticketType: "arena", orderSource: "box_office" },
    ],
    [
      "orderSource+priceZone",
      {
        matchId: [FIXTURE_CURRENT_MATCH_ID],
        orderSource: "official_site",
        priceZone: "from_1500_to_2500",
      },
    ],
    [
      "priceZone+date",
      {
        matchId: [FIXTURE_CURRENT_MATCH_ID],
        priceZone: "up_to_1500",
        transactionDateRange: { from: "2025-10-01", to: "2025-10-02" },
      },
    ],
    [
      "priceZone+sector",
      {
        matchId: [FIXTURE_CURRENT_MATCH_ID],
        priceZone: "up_to_1500",
        sector: ["A"],
      },
    ],
    [
      "finished+match",
      { eventCompleted: "yes", matchId: [FIXTURE_CURRENT_MATCH_ID] },
    ],
  ];

  it.each(pairs)("%s is AND across dimensions", (_name, patch) => {
    const result = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters(patch),
    );
    expect(result.tree.length).toBeGreaterThan(0);
    for (const node of result.tree) {
      expect(node.issuedTickets).toBe(node.ticketsSold + node.freeTickets);
    }
  });

  it("applies all filters at once for the confirm scenario", () => {
    const result = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({
        season: "2025/26",
        league: "KHL",
        tournamentStage: "regular",
        matchClass: "class_1",
        arena: "main",
        eventCompleted: "yes",
        matchId: [CONFIRM_SCENARIO.matchId],
        ticketType: "arena",
        priceZone: CONFIRM_SCENARIO.priceZone,
        orderSource: "official_site",
        transactionDateRange: { from: "2025-10-05", to: "2025-10-05" },
        timeGrouping: "week",
      }),
    );
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0]?.matchId).toBe(CONFIRM_SCENARIO.matchId);
    expect(result.tree[0]?.revenue).toBe(CONFIRM_SCENARIO.expected.revenue);
    expect(result.tree[0]?.ticketsSold).toBe(CONFIRM_SCENARIO.expected.sold);
    expect(result.tree[0]?.freeTickets).toBe(CONFIRM_SCENARIO.expected.free);
    expect(result.tree[0]?.issuedTickets).toBe(CONFIRM_SCENARIO.expected.issued);
    expect(result.tree[0]?.avgPrice).toBe(CONFIRM_SCENARIO.expected.averagePrice);
    expect(result.txs.map((tx) => tx.id)).toEqual(["fx-tx-a2"]);
  });

  it("keeps incomplete-match occupancy as null under MHL + parking", () => {
    const result = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({ league: "MHL", ticketType: "parking" }),
    );
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0]?.revenue).toBe(expectedIncompleteMatchMetrics.revenue);
    expect(result.tree[0]?.capacity).toBe(0);
  });
});

describe("global mock computeMatchSalesTable (grouping / reset / empty)", () => {
  it("reset to DEFAULT_TICKET_FILTERS restores the default match set", () => {
    const narrowed = computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_TICKET_FILTERS,
      league: "VHL",
    });
    const restored = computeMatchSalesTable(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    expect(narrowed.length).toBeGreaterThan(0);
    expect(restored.length).toBeGreaterThan(narrowed.length);
  });

  it("empty match sentinel yields no rows", () => {
    const rows = computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_TICKET_FILTERS,
      matchId: [NO_MATCHES_FILTER_VALUE],
    });
    expect(rows).toEqual([]);
  });

  it("price-zone filter on a real match does not triple-count", () => {
    const all = computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, DEFAULT_TICKET_FILTERS);
    const zoned = computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, {
      ...DEFAULT_TICKET_FILTERS,
      priceZone: "from_1500_to_2500",
    });
    expect(zoned.length).toBeGreaterThan(0);
    const allRevenue = all.reduce((sum, row) => sum + row.revenue, 0);
    const zonedRevenue = zoned.reduce((sum, row) => sum + row.revenue, 0);
    expect(zonedRevenue).toBeLessThanOrEqual(allRevenue);
  });

  it("sector filter reduces transactions, sales rows, KPIs, and dynamics", () => {
    const allTxs = filterTicketTransactions(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const vipFilters: TicketFilters = {
      ...DEFAULT_TICKET_FILTERS,
      sector: ["VIP"],
    };
    const vipTxs = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, vipFilters);

    expect(vipTxs.length).toBeGreaterThan(0);
    expect(vipTxs.length).toBeLessThan(allTxs.length);
    expect(vipTxs.every((tx) => tx.sector === "VIP")).toBe(true);
    expect(vipTxs.every((tx) => tx.ticketType !== "parking")).toBe(true);

    const allRows = computeMatchSalesTable(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const vipRows = computeMatchSalesTable(DEFAULT_DASHBOARD_FILTERS, vipFilters);
    const allRevenue = allRows.reduce((sum, row) => sum + row.revenue, 0);
    const vipRevenue = vipRows.reduce((sum, row) => sum + row.revenue, 0);
    expect(vipRows.length).toBeGreaterThan(0);
    expect(vipRevenue).toBeLessThan(allRevenue);

    const allKpis = computeTicketsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const vipKpis = computeTicketsKpis(DEFAULT_DASHBOARD_FILTERS, vipFilters);
    expect(vipKpis.revenue).toBeLessThan(allKpis.revenue);
    expect(vipKpis.ticketsSold).toBeLessThan(allKpis.ticketsSold);

    const allSeries = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const vipSeries = computeTicketsMatchCumulativeSeries(
      DEFAULT_DASHBOARD_FILTERS,
      vipFilters,
    );
    const sumLast = (series: typeof allSeries) =>
      series.reduce((sum, row) => sum + (row.points.at(-1)?.revenue ?? 0), 0);
    expect(vipSeries.length).toBeGreaterThan(0);
    expect(sumLast(vipSeries)).toBeLessThan(sumLast(allSeries));
  });
});

describe("frozen confirm scenario", () => {
  it("match СКА + зона от 1500 до 2500 = 16000 / 8 sold", () => {
    expect(expectedByPriceZone.from_1500_to_2500.revenue).toBe(16_000);
    expect(CONFIRM_SCENARIO.expected.sold).toBe(8);
    const result = computeFixtureMatchSalesTable(
      FIXTURE_DASHBOARD_FILTERS,
      filters({
        matchId: [CONFIRM_SCENARIO.matchId],
        priceZone: CONFIRM_SCENARIO.priceZone,
      }),
    );
    expect(result.tree[0]?.revenue).toBe(16_000);
    expect(result.tree[0]?.ticketsSold).toBe(8);
    expect(result.tree[0]?.issuedTickets).toBe(8);
  });
});

import { describe, expect, it } from "vitest";
import {
  CONFIRM_SCENARIO,
  FIXTURE_CANCELLED_TRANSACTIONS,
  FIXTURE_CURRENT_MATCH_ID,
  FIXTURE_EMPTY_MATCH_ID,
  FIXTURE_INCOMPLETE_MATCH_ID,
  FIXTURE_MERCH_RETURN,
  FIXTURE_PREV_MATCH_ID,
  FIXTURE_RAW_TRANSACTIONS,
  FIXTURE_SALES_TRANSACTIONS,
  buildDefaultFixtureTree,
  cloneTransactions,
  expectedByOrderSource,
  expectedByPriceZone,
  expectedByTicketType,
  expectedIncompleteMatchMetrics,
  expectedMatchMetrics,
  expectedPrevMatchMetrics,
  snapshotTransactions,
  type FrozenMatchMetrics,
} from "@/lib/match-sales-tree.fixture";
import {
  MATCH_SALES_SECTION_LABELS,
  buildMatchAggregateIndex,
  buildSalesTree,
  flattenExpandedMatchSalesTree,
  matchSalesNodeId,
  matchSalesSectionId,
  paginateTopLevel,
  pruneExpandedKeys,
  pruneExpandedKeysForMatches,
  sortMatchSalesNodes,
  toggleExpandedKey,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import {
  ALL_ORDER_SOURCES,
  ALL_PRICE_ZONES,
  ORDER_SOURCE_LABELS,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-filter-options";
import {
  getTicketFreeQuantity,
  getTicketIssuedQuantity,
  ticketSalesAvgPrice,
} from "@/lib/ticket-sales-metrics";
import { issuedOccupancyPercent } from "@/lib/ticket-plan";
import type { Transaction } from "@/types/dashboard";

function currentMatch(tree: MatchSalesTreeNode[]) {
  const match = tree.find((node) => node.matchId === FIXTURE_CURRENT_MATCH_ID);
  expect(match).toBeDefined();
  return match!;
}

function section(
  match: MatchSalesTreeNode,
  kind: keyof typeof MATCH_SALES_SECTION_LABELS,
) {
  return match.children.find(
    (child) => child.label === MATCH_SALES_SECTION_LABELS[kind],
  );
}

function leaf(
  parent: MatchSalesTreeNode | undefined,
  label: string,
): MatchSalesTreeNode {
  const node = parent?.children.find((child) => child.label === label);
  expect(node, `missing leaf ${label}`).toBeDefined();
  return node!;
}

function expectMetrics(
  node: { revenue: number; ticketsSold: number; freeTickets: number; issuedTickets: number; avgPrice: number },
  expected: FrozenMatchMetrics,
) {
  expect(node.revenue).toBe(expected.revenue);
  expect(node.ticketsSold).toBe(expected.sold);
  expect(node.freeTickets).toBe(expected.free);
  expect(node.issuedTickets).toBe(expected.issued);
  expect(node.avgPrice).toBe(expected.averagePrice);
}

function finiteNumbers(node: MatchSalesTreeNode) {
  const values = [
    node.revenue,
    node.avgPrice,
    node.ticketsSold,
    node.freeTickets,
    node.issuedTickets,
    node.loyaltyDiscountPct,
  ];
  for (const value of values) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).not.toBeNaN();
    expect(value).not.toBe(Number.POSITIVE_INFINITY);
    expect(value).not.toBe(Number.NEGATIVE_INFINITY);
    expect(value).not.toBeUndefined();
  }
}

function walk(nodes: MatchSalesTreeNode[], visit: (node: MatchSalesTreeNode) => void) {
  for (const node of nodes) {
    visit(node);
    walk(node.children, visit);
  }
}

describe("fixture integrity", () => {
  it("freezes expected metrics that match the ticket sales formulas", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    expectMetrics(match, expectedMatchMetrics);
    expect(match.issuedTickets).toBe(
      expectedMatchMetrics.sold + expectedMatchMetrics.free,
    );
    expect(match.loyaltyDiscountPct).toBeCloseTo(
      (expectedMatchMetrics.loyaltyDiscount /
        (expectedMatchMetrics.revenue + expectedMatchMetrics.loyaltyDiscount)) *
        100,
      10,
    );
    expect(match.capacity).toBe(12_000);
    expect(
      issuedOccupancyPercent(match.occupancyIssuedTickets, match.capacity),
    ).toBe(expectedMatchMetrics.occupancyPercentage);
  });

  it("does not use Math.random in the fixture", () => {
    expect(JSON.stringify(FIXTURE_SALES_TRANSACTIONS)).not.toContain("random");
    const first = buildDefaultFixtureTree();
    const second = buildDefaultFixtureTree();
    expect(first.tree.map((node) => node.id)).toEqual(
      second.tree.map((node) => node.id),
    );
    expect(first.tree[0]?.revenue).toBe(second.tree[0]?.revenue);
  });
});

describe("§3 tree shape — three parallel cuts", () => {
  it("builds exactly three sibling sections under the current match, not nested drill-down", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    expect(match.level).toBe("match");
    expect(match.children).toHaveLength(3);
    expect(match.children.map((child) => child.level)).toEqual([
      "section",
      "section",
      "section",
    ]);
    expect(match.children.map((child) => child.label)).toEqual([
      MATCH_SALES_SECTION_LABELS.ticketType,
      MATCH_SALES_SECTION_LABELS.orderSource,
      MATCH_SALES_SECTION_LABELS.priceZone,
    ]);
    expect(match.children.every((child) => child.matchId === match.matchId)).toBe(
      true,
    );
    for (const child of match.children) {
      if (child.label === MATCH_SALES_SECTION_LABELS.priceZone) {
        expect(
          child.children.every(
            (zone) =>
              zone.level === "priceZone" &&
              zone.children.every((sector) => sector.level === "sector"),
          ),
        ).toBe(true);
        continue;
      }
      expect(child.children.every((leafNode) => leafNode.children.length === 0)).toBe(
        true,
      );
      expect(
        child.children.every(
          (leafNode) => leafNode.level !== "section" && leafNode.level !== "match",
        ),
      ).toBe(true);
    }
  });

  it("keeps stable category order and only actual categories", () => {
    const { tree } = buildDefaultFixtureTree();
    const current = currentMatch(tree);
    expect(section(current, "ticketType")?.children.map((c) => c.label)).toEqual([
      TICKET_TYPE_LABELS.arena,
      TICKET_TYPE_LABELS.parking,
    ]);
    expect(section(current, "orderSource")?.children.map((c) => c.label)).toEqual(
      ALL_ORDER_SOURCES.map((source) => ORDER_SOURCE_LABELS[source]),
    );
    expect(section(current, "priceZone")?.children.map((c) => c.label)).toEqual(
      ALL_PRICE_ZONES.filter((zone) => expectedByPriceZone[zone]).map(
        (zone) => PRICE_ZONE_LABELS[zone],
      ),
    );

    const prev = tree.find((node) => node.matchId === FIXTURE_PREV_MATCH_ID)!;
    expect(section(prev, "orderSource")?.children.map((c) => c.label)).toEqual([
      ORDER_SOURCE_LABELS.box_office,
      ORDER_SOURCE_LABELS.official_site,
    ]);
    expect(
      section(prev, "orderSource")?.children.some(
        (c) => c.label === ORDER_SOURCE_LABELS.yandex_afisha,
      ),
    ).toBe(false);
    expect(section(prev, "priceZone")?.children.map((c) => c.label)).toEqual([
      PRICE_ZONE_LABELS.from_1500_to_2000,
      PRICE_ZONE_LABELS.from_2500_to_3000,
    ]);

    const incomplete = tree.find(
      (node) => node.matchId === FIXTURE_INCOMPLETE_MATCH_ID,
    )!;
    expect(section(incomplete, "priceZone")).toBeUndefined();
    expect(section(incomplete, "ticketType")?.children.map((c) => c.label)).toEqual([
      TICKET_TYPE_LABELS.parking,
    ]);
  });

  it("uses stable ids from matchId + dimension key, not name or row index", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    expect(match.id).toBe(matchSalesNodeId(FIXTURE_CURRENT_MATCH_ID));
    expect(section(match, "ticketType")?.id).toBe(
      matchSalesSectionId(FIXTURE_CURRENT_MATCH_ID, "ticketType"),
    );
    expect(leaf(section(match, "ticketType"), TICKET_TYPE_LABELS.arena).id).toBe(
      `m:${FIXTURE_CURRENT_MATCH_ID}|t:arena`,
    );
    expect(leaf(section(match, "orderSource"), ORDER_SOURCE_LABELS.box_office).id).toBe(
      `m:${FIXTURE_CURRENT_MATCH_ID}|s:box_office`,
    );
    expect(
      leaf(section(match, "priceZone"), PRICE_ZONE_LABELS[CONFIRM_SCENARIO.priceZone])
        .id,
    ).toBe(`m:${FIXTURE_CURRENT_MATCH_ID}|z:${CONFIRM_SCENARIO.priceZone}`);
    const ids: string[] = [];
    walk(tree, (node) => ids.push(node.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => !/^\d+$/.test(id))).toBe(true);
  });

  it("expands a price zone into allowed sectors and keeps parking as a leaf", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    const priceZone = section(match, "priceZone")!;
    const cheap = leaf(priceZone, PRICE_ZONE_LABELS.up_to_500);
    const mid = leaf(priceZone, PRICE_ZONE_LABELS.from_1500_to_2000);
    const upper = leaf(priceZone, PRICE_ZONE_LABELS.from_2500_to_3000);

    expect(cheap.children.map((child) => child.label)).toEqual(["A", "D1"]);
    expect(mid.children.map((child) => child.label)).toEqual(["B1"]);
    expect(upper.children.map((child) => child.label)).toEqual(["C1", "VIP"]);
    expect(upper.hasChildren).toBe(true);
    expect(cheap.children.reduce((sum, child) => sum + child.revenue, 0)).toBe(
      cheap.revenue,
    );
    const vipLeaf = upper.children.find((child) => child.label === "VIP");
    expect(vipLeaf?.revenue).toBe(10_000);
    expect(vipLeaf?.avgPrice).toBe(10_000 / 2);
    expect(vipLeaf?.planRevenue).toBeNull();
    expect(vipLeaf?.id).toBe(
      `m:${FIXTURE_CURRENT_MATCH_ID}|z:from_2500_to_3000|sec:VIP`,
    );

    const parking = leaf(section(match, "ticketType"), TICKET_TYPE_LABELS.parking);
    expect(parking.hasChildren).toBe(false);
    expect(parking.children).toHaveLength(0);

    const incomplete = tree.find(
      (node) => node.matchId === FIXTURE_INCOMPLETE_MATCH_ID,
    )!;
    const incompleteParking = leaf(
      section(incomplete, "ticketType"),
      TICKET_TYPE_LABELS.parking,
    );
    expect(incompleteParking.children).toHaveLength(0);
    expect(section(incomplete, "priceZone")).toBeUndefined();
  });

  it("does not leak transactions across matches and skips the empty match", () => {
    const { tree, rows } = buildDefaultFixtureTree();
    expect(tree.some((node) => node.matchId === FIXTURE_EMPTY_MATCH_ID)).toBe(
      false,
    );
    expect(rows.some((row) => row.matchId === FIXTURE_EMPTY_MATCH_ID)).toBe(false);
    expect(tree.map((node) => node.matchId)).toEqual([
      FIXTURE_INCOMPLETE_MATCH_ID,
      FIXTURE_CURRENT_MATCH_ID,
      FIXTURE_PREV_MATCH_ID,
    ]);

    const current = currentMatch(tree);
    walk([current], (node) => {
      expect(node.matchId).toBe(FIXTURE_CURRENT_MATCH_ID);
    });
    const prev = tree.find((node) => node.matchId === FIXTURE_PREV_MATCH_ID)!;
    expect(prev.revenue).toBe(expectedPrevMatchMetrics.revenue);
    expect(prev.revenue).not.toBe(expectedMatchMetrics.revenue);
  });

  it("does not mutate source transactions", () => {
    const txs = cloneTransactions(FIXTURE_SALES_TRANSACTIONS);
    const before = snapshotTransactions(txs);
    const pipeline = buildDefaultFixtureTree();
    buildSalesTree(
      txs,
      pipeline.rows,
      { dateRange: 30, stream: "all", matchId: "all", promotionId: "all" },
      {
        season: "all",
        league: "all",
        tournamentStage: "all",
        matchClass: "all",
        series: "all",
        arena: "all",
        eventCompleted: "all",
        matchId: [],
        ticketType: "all",
        priceZone: "all",
        sector: [],
        orderSource: "all",
        transactionDateRange: { from: null, to: null },
        timeGrouping: "day",
      },
    );
    expect(snapshotTransactions(txs)).toBe(before);
  });
});

describe("§4 metrics", () => {
  it("keeps issued = sold + free on every node", () => {
    const { tree } = buildDefaultFixtureTree();
    walk(tree, (node) => {
      expect(node.issuedTickets).toBe(node.ticketsSold + node.freeTickets);
    });
  });

  it("computes average price from operations, not the average of child averages", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    const types = section(match, "ticketType")!.children;
    const unweighted =
      types.reduce((sum, child) => sum + child.avgPrice, 0) / types.length;
    expect(match.avgPrice).toBe(expectedMatchMetrics.averagePrice);
    expect(match.avgPrice).not.toBe(unweighted);
    expect(match.avgPrice).toBe(match.revenue / match.ticketsSold);
  });

  it("lets each cut sum to the match total and forbids adding the three cuts together", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    const ticketType = section(match, "ticketType")!;
    const orderSource = section(match, "orderSource")!;
    const priceZone = section(match, "priceZone")!;

    for (const cut of [ticketType, orderSource, priceZone]) {
      expect(cut.revenue).toBe(match.revenue);
      expect(cut.ticketsSold).toBe(match.ticketsSold);
      expect(cut.issuedTickets).toBe(match.issuedTickets);
    }

    const typeSum = ticketType.children.reduce((s, c) => s + c.revenue, 0);
    const sourceSum = orderSource.children.reduce((s, c) => s + c.revenue, 0);
    const zoneSum = priceZone.children.reduce((s, c) => s + c.revenue, 0);
    expect(typeSum).toBe(match.revenue);
    expect(sourceSum).toBe(match.revenue);
    expect(zoneSum).toBe(
      match.revenue - expectedByTicketType.parking.revenue,
    );

    const wronglyStacked = typeSum + sourceSum + zoneSum;
    expect(wronglyStacked).toBeGreaterThan(match.revenue);
    expect(wronglyStacked).not.toBe(match.revenue);
  });

  it("matches frozen per-cut leaves for the current match", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    expectMetrics(
      leaf(section(match, "ticketType"), TICKET_TYPE_LABELS.arena),
      expectedByTicketType.arena,
    );
    expectMetrics(
      leaf(section(match, "ticketType"), TICKET_TYPE_LABELS.parking),
      expectedByTicketType.parking,
    );
    for (const source of ALL_ORDER_SOURCES) {
      expectMetrics(
        leaf(section(match, "orderSource"), ORDER_SOURCE_LABELS[source]),
        expectedByOrderSource[source],
      );
    }
    for (const zone of ALL_PRICE_ZONES) {
      const expected = expectedByPriceZone[zone];
      if (!expected) continue;
      expectMetrics(
        leaf(section(match, "priceZone"), PRICE_ZONE_LABELS[zone]),
        expected,
      );
    }
  });

  it("excludes cancelled orders and merch returns from fact", () => {
    const { tree, txs } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    expect(txs.some((tx) => tx.id === "fx-tx-cancelled")).toBe(false);
    expect(txs.some((tx) => tx.id === FIXTURE_MERCH_RETURN.id)).toBe(false);
    expect(match.revenue).toBe(expectedMatchMetrics.revenue);
    expect(match.revenue).not.toBe(
      expectedMatchMetrics.revenue + FIXTURE_CANCELLED_TRANSACTIONS[0]!.amount,
    );
    expect(FIXTURE_RAW_TRANSACTIONS.some((tx) => tx.id === "fx-tx-cancelled")).toBe(
      true,
    );
  });

  it("gives free tickets no revenue", () => {
    const free = FIXTURE_SALES_TRANSACTIONS.find((tx) => tx.id === "fx-tx-a5")!;
    expect(free.amount).toBe(0);
    expect(getTicketFreeQuantity(free)).toBe(3);
    expect(getTicketIssuedQuantity(free)).toBe(3);
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    expect(match.freeTickets).toBe(3);
    expect(match.revenue).toBe(expectedMatchMetrics.revenue);
  });

  it("uses em-dash occupancy / plan when the base is missing, not 0%", () => {
    const { tree } = buildDefaultFixtureTree();
    const incomplete = tree.find(
      (node) => node.matchId === FIXTURE_INCOMPLETE_MATCH_ID,
    )!;
    expectMetrics(incomplete, expectedIncompleteMatchMetrics);
    expect(incomplete.capacity).toBe(0);
    expect(incomplete.planRevenue).toBe(0);
    expect(expectedIncompleteMatchMetrics.occupancyPercentage).toBeNull();
    const fillPct =
      incomplete.capacity != null && incomplete.capacity > 0
        ? (incomplete.occupancyIssuedTickets / incomplete.capacity) * 100
        : null;
    const planPct =
      incomplete.planRevenue != null && incomplete.planRevenue > 0
        ? (incomplete.revenue / incomplete.planRevenue) * 100
        : null;
    expect(fillPct).toBeNull();
    expect(planPct).toBeNull();
    expect(fillPct).not.toBe(0);
    expect(planPct).not.toBe(0);

    const zoneLeaf = section(currentMatch(tree), "priceZone")!.children[0]!;
    expect(zoneLeaf.capacity).toBeNull();
    expect(zoneLeaf.planRevenue).toBeNull();
  });

  it("weights loyalty from operations, not child percents", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    const types = section(match, "ticketType")!.children;
    const unweightedPct =
      types.reduce((sum, child) => sum + child.loyaltyDiscountPct, 0) /
      types.length;
    const expectedPct =
      (expectedMatchMetrics.loyaltyDiscount /
        (expectedMatchMetrics.revenue + expectedMatchMetrics.loyaltyDiscount)) *
      100;
    expect(match.loyaltyDiscountPct).toBeCloseTo(expectedPct, 10);
    expect(match.loyaltyDiscountPct).not.toBeCloseTo(unweightedPct, 6);
  });

  it("counts mixed paid+free issued as sold + free on the same operation", () => {
    const mixed: Transaction = {
      id: "mixed",
      date: new Date(2025, 9, 7),
      stream: "tickets",
      description: "mixed",
      matchId: FIXTURE_CURRENT_MATCH_ID,
      channel: "online",
      amount: 4_000,
      quantity: 2,
      freeQuantity: 1,
      ticketType: "arena",
      orderSource: "box_office",
      priceZone: "up_to_500",
    };
    expect(getTicketIssuedQuantity(mixed)).toBe(3);
    expect(getTicketFreeQuantity(mixed)).toBe(1);
    const agg = { revenue: 0, loyaltyDiscount: 0, ticketsSold: 0, freeTickets: 0 };
    agg.freeTickets = getTicketFreeQuantity(mixed);
    agg.revenue = mixed.amount;
    agg.ticketsSold = mixed.quantity;
    expect(ticketSalesAvgPrice(agg)).toBe(2_000);
    expect(getTicketIssuedQuantity(mixed)).toBe(
      mixed.quantity + getTicketFreeQuantity(mixed),
    );
  });
});

describe("§5–6 expand, independent branches, several matches", () => {
  it("starts fully collapsed", () => {
    const { tree } = buildDefaultFixtureTree();
    const flat = flattenExpandedMatchSalesTree(tree, new Set());
    expect(flat).toHaveLength(tree.length);
    expect(flat.every((row) => row.level === "match")).toBe(true);
  });

  it("shows + only on nodes with detail", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    expect(match.hasChildren).toBe(true);
    const arena = leaf(section(match, "ticketType"), TICKET_TYPE_LABELS.arena);
    expect(arena.hasChildren).toBe(false);
    expect(arena.children).toHaveLength(0);
    const cheapZone = leaf(
      section(match, "priceZone"),
      PRICE_ZONE_LABELS.up_to_500,
    );
    expect(cheapZone.hasChildren).toBe(true);
    expect(cheapZone.children.length).toBeGreaterThan(0);
    const incomplete = tree.find(
      (node) => node.matchId === FIXTURE_INCOMPLETE_MATCH_ID,
    )!;
    expect(incomplete.hasChildren).toBe(true);
    expect(section(incomplete, "priceZone")).toBeUndefined();
  });

  it("expands sections independently", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    const ticketType = section(match, "ticketType")!;
    const orderSource = section(match, "orderSource")!;
    const priceZone = section(match, "priceZone")!;

    const sourceOnly = flattenExpandedMatchSalesTree(
      [match],
      new Set([match.id, orderSource.id]),
    );
    expect(sourceOnly.some((row) => row.level === "orderSource")).toBe(true);
    expect(sourceOnly.some((row) => row.level === "ticketType")).toBe(false);
    expect(sourceOnly.some((row) => row.level === "priceZone")).toBe(false);
    expect(sourceOnly.filter((row) => row.level === "section")).toHaveLength(3);

    const two = flattenExpandedMatchSalesTree(
      [match],
      new Set([match.id, ticketType.id, priceZone.id]),
    );
    expect(two.some((row) => row.level === "ticketType")).toBe(true);
    expect(two.some((row) => row.level === "priceZone")).toBe(true);
    expect(two.some((row) => row.level === "orderSource")).toBe(false);
  });

  it("collapses a match and hides its children from visible rows", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    const expanded = new Set([
      match.id,
      ...match.children.map((child) => child.id),
    ]);
    expect(flattenExpandedMatchSalesTree([match], expanded).length).toBeGreaterThan(
      1,
    );
    expect(flattenExpandedMatchSalesTree([match], new Set())).toEqual([
      expect.objectContaining({ id: match.id, level: "match" }),
    ]);
  });

  it("does not duplicate rows on rapid expand/collapse toggles", () => {
    const { tree } = buildDefaultFixtureTree();
    const match = currentMatch(tree);
    let expanded: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      expanded = toggleExpandedKey(expanded, match.id);
    }
    const flat = flattenExpandedMatchSalesTree([match], new Set(expanded));
    const ids = flat.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(flat.filter((row) => row.level === "match")).toHaveLength(1);
  });

  it("expands several matches independently and keeps keys off the row index", () => {
    const { tree } = buildDefaultFixtureTree();
    const a = tree.find((node) => node.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const b = tree.find((node) => node.matchId === FIXTURE_PREV_MATCH_ID)!;
    const flat = flattenExpandedMatchSalesTree(
      tree,
      new Set([a.id, b.id, a.children[1]!.id]),
    );
    expect(flat.filter((row) => row.level === "match")).toHaveLength(tree.length);
    expect(flat.some((row) => row.matchId === a.matchId && row.level === "orderSource")).toBe(
      true,
    );
    expect(flat.some((row) => row.matchId === b.matchId && row.level === "section")).toBe(
      true,
    );
    expect(flat.some((row) => row.matchId === b.matchId && row.level !== "match" && row.level !== "section")).toBe(
      false,
    );
    expect(flat.every((row) => row.id !== String(flat.indexOf(row)))).toBe(true);
  });
});

describe("§11 sort / pagination", () => {
  it("pages only match rows and keeps children under the parent", () => {
    const { tree } = buildDefaultFixtureTree();
    const { pageItems, pageCount } = paginateTopLevel(tree, 0, 2);
    expect(pageItems).toHaveLength(2);
    expect(pageCount).toBe(2);
    const expanded = new Set(pageItems.flatMap((node) => [node.id, ...node.children.map((c) => c.id)]));
    const flat = flattenExpandedMatchSalesTree(pageItems, expanded);
    expect(flat.filter((row) => row.level === "match")).toHaveLength(2);
    const firstMatchEnd = flat.findIndex((row, index) => index > 0 && row.level === "match");
    expect(flat.slice(1, firstMatchEnd).every((row) => row.matchId === pageItems[0]!.matchId)).toBe(
      true,
    );
  });

  it("does not change the page when a row is expanded", () => {
    const { tree } = buildDefaultFixtureTree();
    const pageA = paginateTopLevel(tree, 0, 2);
    flattenExpandedMatchSalesTree(pageA.pageItems, new Set([pageA.pageItems[0]!.id]));
    const pageB = paginateTopLevel(tree, 0, 2);
    expect(pageB.pageIndex).toBe(pageA.pageIndex);
    expect(pageB.pageItems.map((node) => node.id)).toEqual(
      pageA.pageItems.map((node) => node.id),
    );
  });

  it("sorts match rows and keeps children attached to the parent", () => {
    const { tree } = buildDefaultFixtureTree();
    const sorted = sortMatchSalesNodes(tree, { id: "revenue", desc: true });
    expect(sorted[0]!.matchId).toBe(FIXTURE_CURRENT_MATCH_ID);
    expect(sorted[0]!.revenue).toBeGreaterThanOrEqual(sorted[1]!.revenue);
    const flat = flattenExpandedMatchSalesTree(
      sorted,
      new Set([sorted[0]!.id, sorted[0]!.children[0]!.id]),
    );
    expect(flat[0]!.id).toBe(sorted[0]!.id);
    const nextMatch = flat.findIndex((row, index) => index > 0 && row.level === "match");
    expect(flat.slice(1, nextMatch).every((row) => row.matchId === sorted[0]!.matchId)).toBe(
      true,
    );
  });

  it("does not reuse keys across pages", () => {
    const { tree } = buildDefaultFixtureTree();
    const page0 = paginateTopLevel(tree, 0, 1);
    const page1 = paginateTopLevel(tree, 1, 1);
    const ids0 = flattenExpandedMatchSalesTree(
      page0.pageItems,
      new Set([page0.pageItems[0]!.id]),
    ).map((row) => row.id);
    const ids1 = flattenExpandedMatchSalesTree(
      page1.pageItems,
      new Set([page1.pageItems[0]!.id]),
    ).map((row) => row.id);
    expect(ids0.some((id) => ids1.includes(id))).toBe(false);
  });
});

describe("§13 edge cases", () => {
  it("never yields NaN, Infinity, undefined, or duplicate ids", () => {
    const { tree } = buildDefaultFixtureTree();
    const ids: string[] = [];
    walk(tree, (node) => {
      finiteNumbers(node);
      ids.push(node.id);
      expect(node.label).toBeTruthy();
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("indexes in one pass without scanning other matches' buckets", () => {
    const index = buildMatchAggregateIndex(FIXTURE_SALES_TRANSACTIONS);
    expect(index.get(FIXTURE_EMPTY_MATCH_ID)).toBeUndefined();
    expect(index.get(FIXTURE_CURRENT_MATCH_ID)?.agg.revenue).toBe(
      expectedMatchMetrics.revenue,
    );
    expect(index.get(FIXTURE_PREV_MATCH_ID)?.agg.revenue).toBe(
      expectedPrevMatchMetrics.revenue,
    );
  });

  it("prunes stale expand ids when a match disappears", () => {
    const { tree } = buildDefaultFixtureTree();
    const current = currentMatch(tree);
    const stale = [
      current.id,
      current.children[0]!.id,
      matchSalesNodeId("gone-match"),
    ];
    const pruned = pruneExpandedKeysForMatches(
      stale,
      new Set([current.id]),
    );
    expect(pruned).toEqual([current.id, current.children[0]!.id]);
    expect(pruneExpandedKeys(stale, new Set([current.id]))).toEqual([current.id]);
    expect(
      pruneExpandedKeysForMatches(stale, new Set()),
    ).toEqual([]);
  });
});

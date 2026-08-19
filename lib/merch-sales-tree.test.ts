import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import {
  computeMatchSalesTable,
  computeMerchMatchSalesTable,
  computeMerchOffMatchSalesRow,
  computeMerchSalesTableWithOffMatch,
  filterMatchesByMerchFilters,
  filterMerchTransactions,
} from "@/lib/filters";
import {
  DEFAULT_MERCH_FILTERS,
  MERCH_OFF_MATCH_ID,
  MERCH_OFF_MATCH_LABEL,
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
} from "@/lib/merch-filter-options";
import { DEFAULT_TICKET_FILTERS } from "@/lib/ticket-filter-options";
import {
  buildDefaultMerchFixtureTree,
  MERCH_FIXTURE_ARENA_EXCLUDED_SKU,
  MERCH_FIXTURE_ARENA_MATCH_ID,
  MERCH_FIXTURE_ARENA_TOP_PRODUCTS,
  MERCH_FIXTURE_NORTH_MATCH_ID,
  MERCH_FIXTURE_NORTH_TOP_SKU,
  MERCH_FIXTURE_OFF_MATCH_RECEIPTS,
  MERCH_FIXTURE_OFF_MATCH_REVENUE,
  MERCH_FIXTURE_OFF_MATCH_UNITS,
} from "@/lib/merch-sales-tree.fixture";
import {
  computeMerchSalesTree,
  flattenExpandedMerchSalesTree,
  MERCH_SALES_SECTION_LABELS,
  MERCH_SALES_TOP_PRODUCTS_LIMIT,
  sortMerchSalesNodes,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";

function findSection(match: MerchSalesTreeNode, label: string) {
  return match.children.find((child) => child.label === label);
}

function sumChildren(
  node: MerchSalesTreeNode,
  field: "revenue" | "units" | "receipts",
): number {
  return node.children.reduce((sum, child) => sum + child[field], 0);
}

function shareSum(node: MerchSalesTreeNode): number {
  return node.children.reduce((sum, child) => sum + (child.sharePct ?? 0), 0);
}

describe("merch sales tree", () => {
  it("builds match → three parallel sections, not nested into each other", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    expect(tree).toHaveLength(3);

    for (const match of tree) {
      expect(match.level).toBe("match");
      expect(match.children.map((child) => child.label)).toEqual([
        MERCH_SALES_SECTION_LABELS.salesChannel,
        MERCH_SALES_SECTION_LABELS.productCategory,
        MERCH_SALES_SECTION_LABELS.topProducts,
      ]);
      expect(match.children.every((child) => child.level === "section")).toBe(
        true,
      );
      expect(
        match.children.every((child) =>
          child.children.every((leaf) => leaf.children.length === 0),
        ),
      ).toBe(true);
    }

    const arena = tree.find((node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID)!;
    const channels = findSection(arena, MERCH_SALES_SECTION_LABELS.salesChannel)!;
    const categories = findSection(
      arena,
      MERCH_SALES_SECTION_LABELS.productCategory,
    )!;
    expect(channels.children.map((child) => child.level)).toEqual([
      "salesChannel",
      "salesChannel",
    ]);
    expect(categories.children.map((child) => child.level)).toEqual([
      "productCategory",
      "productCategory",
    ]);
    expect(channels.children.map((child) => child.label)).toEqual([
      MERCH_SALES_POINT_LABELS.flagship,
      MERCH_SALES_POINT_LABELS.arena_north,
    ]);
    expect(categories.children.map((child) => child.label)).toEqual([
      MERCH_PRODUCT_CATEGORY_LABELS.jerseys,
      MERCH_PRODUCT_CATEGORY_LABELS.souvenirs,
    ]);
  });

  it("keeps match KPIs identical to the original merch match rows", () => {
    const { rows, tree } = buildDefaultMerchFixtureTree();
    const byId = new Map(rows.map((row) => [row.matchId, row]));
    for (const node of tree) {
      const row = byId.get(node.matchId)!;
      expect(node.revenue).toBe(row.revenue);
      expect(node.avgCheck).toBe(row.avgCheck);
      expect(node.receipts).toBe(row.receipts);
      expect(node.units).toBe(row.units);
      expect(node.upt).toBe(row.upt);
      expect(node.purchaseConversionPct).toBe(row.purchaseConversionPct);
      expect(node.planRevenue).toBe(row.planRevenue);
      expect(node.label).toBe(row.eventLabel);
    }
  });

  it("sums channel and category revenue/units/shares back to the match", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    for (const match of tree) {
      const channels = findSection(
        match,
        MERCH_SALES_SECTION_LABELS.salesChannel,
      )!;
      const categories = findSection(
        match,
        MERCH_SALES_SECTION_LABELS.productCategory,
      )!;
      expect(channels.revenue).toBe(match.revenue);
      expect(categories.revenue).toBe(match.revenue);
      expect(findSection(match, MERCH_SALES_SECTION_LABELS.topProducts)!.revenue).toBe(
        match.revenue,
      );
      expect(sumChildren(channels, "revenue")).toBe(match.revenue);
      expect(sumChildren(categories, "revenue")).toBe(match.revenue);
      expect(sumChildren(channels, "units")).toBe(match.units);
      expect(sumChildren(categories, "units")).toBe(match.units);
      expect(shareSum(channels)).toBeCloseTo(100, 8);
      expect(shareSum(categories)).toBeCloseTo(100, 8);
      expect(channels.planRevenue).toBe(match.planRevenue);
      expect(categories.planRevenue).toBe(match.planRevenue);
      expect(channels.children[0]?.planRevenue).toBeNull();
      expect(categories.children[0]?.planRevenue).toBeNull();
    }
  });

  it("excludes mall/online from match channels so the original table total is unchanged", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    const arena = tree.find((node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID)!;
    const labels = flattenExpandedMerchSalesTree(
      [arena],
      new Set([
        arena.id,
        findSection(arena, MERCH_SALES_SECTION_LABELS.salesChannel)!.id,
        findSection(arena, MERCH_SALES_SECTION_LABELS.productCategory)!.id,
      ]),
    ).map((row) => row.label);
    expect(labels).not.toContain(MERCH_SALES_POINT_LABELS.mall_raduga);
    expect(labels).not.toContain(MERCH_SALES_POINT_LABELS.mall_continent);
    expect(labels).not.toContain(MERCH_SALES_POINT_LABELS.online_store);
    expect(labels).not.toContain(MERCH_PRODUCT_CATEGORY_LABELS.apparel);
  });

  it("gives different matches different channel and category mixes", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    const arena = tree.find((node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID)!;
    const north = tree.find((node) => node.matchId === MERCH_FIXTURE_NORTH_MATCH_ID)!;
    const arenaFlagship = findSection(
      arena,
      MERCH_SALES_SECTION_LABELS.salesChannel,
    )!.children.find((child) => child.label === MERCH_SALES_POINT_LABELS.flagship)!;
    const northFlagship = findSection(
      north,
      MERCH_SALES_SECTION_LABELS.salesChannel,
    )!.children.find((child) => child.label === MERCH_SALES_POINT_LABELS.flagship)!;
    expect(arenaFlagship.sharePct).toBeCloseTo(80, 8);
    expect(northFlagship.sharePct).toBeCloseTo(20, 8);

    const arenaJerseys = findSection(
      arena,
      MERCH_SALES_SECTION_LABELS.productCategory,
    )!.children.find(
      (child) => child.label === MERCH_PRODUCT_CATEGORY_LABELS.jerseys,
    )!;
    const northApparel = findSection(
      north,
      MERCH_SALES_SECTION_LABELS.productCategory,
    )!.children.find(
      (child) => child.label === MERCH_PRODUCT_CATEGORY_LABELS.apparel,
    )!;
    expect(arenaJerseys.sharePct).toBeCloseTo(80, 8);
    expect(northApparel.sharePct).toBeCloseTo(80, 8);
  });

  it("hides collapsed children from the flattened rows", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    const collapsed = flattenExpandedMerchSalesTree(tree, new Set());
    expect(collapsed.every((row) => row.level === "match")).toBe(true);
    expect(collapsed).toHaveLength(3);

    const match = tree[0]!;
    const matchOnly = flattenExpandedMerchSalesTree(
      [match],
      new Set([match.id]),
    );
    expect(matchOnly.map((row) => row.level)).toEqual([
      "match",
      "section",
      "section",
      "section",
    ]);

    const channels = findSection(match, MERCH_SALES_SECTION_LABELS.salesChannel)!;
    const oneSection = flattenExpandedMerchSalesTree(
      [match],
      new Set([match.id, channels.id]),
    );
    expect(oneSection.some((row) => row.level === "salesChannel")).toBe(true);
    expect(oneSection.some((row) => row.level === "productCategory")).toBe(
      false,
    );
    expect(oneSection.filter((row) => row.level === "section")).toHaveLength(3);
    expect(oneSection.some((row) => row.level === "topProduct")).toBe(false);
  });

  it("ranks top-5 SKUs by match revenue and shows fewer when a match has <5", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    const arena = tree.find((node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID)!;
    const north = tree.find((node) => node.matchId === MERCH_FIXTURE_NORTH_MATCH_ID)!;
    const arenaTop = findSection(arena, MERCH_SALES_SECTION_LABELS.topProducts)!;
    const northTop = findSection(north, MERCH_SALES_SECTION_LABELS.topProducts)!;

    expect(arenaTop.children).toHaveLength(MERCH_SALES_TOP_PRODUCTS_LIMIT);
    expect(arenaTop.children.map((child) => child.level)).toEqual(
      Array(MERCH_SALES_TOP_PRODUCTS_LIMIT).fill("topProduct"),
    );
    expect(arenaTop.children.map((child) => child.label)).toEqual([
      ...MERCH_FIXTURE_ARENA_TOP_PRODUCTS,
    ]);
    expect(arenaTop.children.map((child) => child.revenue)).toEqual([
      180_000, 120_000, 70_000, 45_000, 32_000,
    ]);
    expect(arenaTop.children.every((child) => child.planRevenue === null)).toBe(
      true,
    );
    expect(
      arenaTop.children.every((child) => child.purchaseConversionPct === 0),
    ).toBe(true);
    expect(arenaTop.children.some((child) => child.label === MERCH_FIXTURE_ARENA_EXCLUDED_SKU)).toBe(
      false,
    );
    expect(sumChildren(arenaTop, "revenue")).toBe(447_000);
    expect(sumChildren(arenaTop, "revenue")).toBeLessThan(arena.revenue);

    expect(northTop.children).toHaveLength(2);
    expect(northTop.children[0]?.label).toBe(MERCH_FIXTURE_NORTH_TOP_SKU);
    expect(northTop.children.map((child) => child.revenue)).toEqual([
      320_000, 80_000,
    ]);
    expect(sumChildren(northTop, "revenue")).toBe(north.revenue);

    expect(arenaTop.children[1]?.label).toBe("Футболка домашняя");
    expect(
      northTop.children.some((child) => child.label === "Футболка домашняя"),
    ).toBe(false);
  });

  it("adds a root-level off-match row that expands to the three retail/online channels", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    const offMatch = tree.find((node) => node.matchId === MERCH_OFF_MATCH_ID);
    expect(offMatch).toBeDefined();
    expect(offMatch!.label).toBe(MERCH_OFF_MATCH_LABEL);
    expect(offMatch!.level).toBe("match");
    expect(offMatch!.revenue).toBe(MERCH_FIXTURE_OFF_MATCH_REVENUE);
    expect(offMatch!.receipts).toBe(MERCH_FIXTURE_OFF_MATCH_RECEIPTS);
    expect(offMatch!.units).toBe(MERCH_FIXTURE_OFF_MATCH_UNITS);
    expect(offMatch!.attendance).toBe(0);
    expect(offMatch!.planRevenue).toBe(0);

    const channels = findSection(
      offMatch!,
      MERCH_SALES_SECTION_LABELS.salesChannel,
    )!;
    expect(channels.children.map((child) => child.label)).toEqual([
      MERCH_SALES_POINT_LABELS.mall_raduga,
      MERCH_SALES_POINT_LABELS.mall_continent,
      MERCH_SALES_POINT_LABELS.online_store,
    ]);
    expect(
      channels.children.find(
        (child) => child.label === MERCH_SALES_POINT_LABELS.mall_raduga,
      )!.revenue,
    ).toBe(130_000);
    expect(
      channels.children.find(
        (child) => child.label === MERCH_SALES_POINT_LABELS.mall_continent,
      )!.revenue,
    ).toBe(40_000);
    expect(
      channels.children.find(
        (child) => child.label === MERCH_SALES_POINT_LABELS.online_store,
      )!.revenue,
    ).toBe(120_000);
    expect(sumChildren(channels, "revenue")).toBe(offMatch!.revenue);

    expect(tree.at(-1)?.matchId).toBe(MERCH_OFF_MATCH_ID);

    const matchLabels = flattenExpandedMerchSalesTree(
      tree.filter((node) => node.matchId !== MERCH_OFF_MATCH_ID),
      new Set(),
    ).map((row) => row.label);
    expect(matchLabels).not.toContain(MERCH_SALES_POINT_LABELS.mall_raduga);
    expect(matchLabels).not.toContain(MERCH_OFF_MATCH_LABEL);
  });

  it("pins off-match last after date or revenue sort", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    const offMatch = tree.find((node) => node.matchId === MERCH_OFF_MATCH_ID)!;
    expect(offMatch.date!.getTime()).toBeGreaterThan(
      Math.max(
        ...tree
          .filter((node) => node.matchId !== MERCH_OFF_MATCH_ID)
          .map((node) => node.date?.getTime() ?? 0),
      ),
    );
    expect(tree.at(-1)?.matchId).toBe(MERCH_OFF_MATCH_ID);

    const byDate = sortMerchSalesNodes(tree, { id: "date", desc: true });
    expect(byDate.at(-1)?.matchId).toBe(MERCH_OFF_MATCH_ID);
    expect(byDate.slice(0, -1).every((node) => node.matchId !== MERCH_OFF_MATCH_ID)).toBe(
      true,
    );

    const byRevenueAsc = sortMerchSalesNodes(tree, { id: "revenue", desc: false });
    expect(byRevenueAsc[0]?.revenue).toBeLessThanOrEqual(
      byRevenueAsc[1]?.revenue ?? Infinity,
    );
    expect(byRevenueAsc.at(-1)?.matchId).toBe(MERCH_OFF_MATCH_ID);
  });
});

describe("merch sales tree vs live mock", () => {
  it("preserves computeMerchMatchSalesTable metrics and invariants", () => {
    const rows = computeMerchMatchSalesTable(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
    );
    const tree = computeMerchSalesTree(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
      rows,
    );
    expect(tree.length).toBe(rows.length);
    expect(tree.length).toBeGreaterThan(1);

    const byId = new Map(rows.map((row) => [row.matchId, row]));
    const channelVectors = new Set<string>();
    const categoryVectors = new Set<string>();
    const topProductVectors = new Set<string>();

    for (const match of tree) {
      const row = byId.get(match.matchId)!;
      expect(match.revenue).toBe(row.revenue);
      expect(match.receipts).toBe(row.receipts);
      expect(match.units).toBe(row.units);
      expect(match.avgCheck).toBe(row.avgCheck);
      expect(match.upt).toBe(row.upt);
      expect(match.purchaseConversionPct).toBe(row.purchaseConversionPct);
      expect(match.planRevenue).toBe(row.planRevenue);
      expect(match.planRevenue).toBeGreaterThan(0);

      const channels = findSection(
        match,
        MERCH_SALES_SECTION_LABELS.salesChannel,
      );
      const categories = findSection(
        match,
        MERCH_SALES_SECTION_LABELS.productCategory,
      );
      const topProducts = findSection(
        match,
        MERCH_SALES_SECTION_LABELS.topProducts,
      );

      expect(match.receipts).toBeGreaterThan(0);
      expect(match.revenue).toBeGreaterThan(0);

      expect(channels).toBeDefined();
      expect(categories).toBeDefined();
      expect(topProducts).toBeDefined();
      expect(match.children.map((child) => child.label)).toEqual([
        MERCH_SALES_SECTION_LABELS.salesChannel,
        MERCH_SALES_SECTION_LABELS.productCategory,
        MERCH_SALES_SECTION_LABELS.topProducts,
      ]);
      expect(sumChildren(channels!, "revenue")).toBe(match.revenue);
      expect(sumChildren(categories!, "revenue")).toBe(match.revenue);
      expect(shareSum(channels!)).toBeCloseTo(100, 5);
      expect(shareSum(categories!)).toBeCloseTo(100, 5);
      expect(topProducts!.children.length).toBeGreaterThan(0);
      expect(topProducts!.children.length).toBeLessThanOrEqual(
        MERCH_SALES_TOP_PRODUCTS_LIMIT,
      );
      expect(
        topProducts!.children.every((child) => child.level === "topProduct"),
      ).toBe(true);
      const topRevenues = topProducts!.children.map((child) => child.revenue);
      expect(topRevenues).toEqual([...topRevenues].sort((a, b) => b - a));
      expect(sumChildren(topProducts!, "revenue")).toBeLessThanOrEqual(
        match.revenue,
      );
      expect(
        channels!.children.every(
          (child) =>
            child.label !== MERCH_SALES_POINT_LABELS.online_store &&
            child.label !== MERCH_SALES_POINT_LABELS.mall_raduga &&
            child.label !== MERCH_SALES_POINT_LABELS.mall_continent,
        ),
      ).toBe(true);

      channelVectors.add(
        channels!.children
          .map((child) => `${child.label}:${(child.sharePct ?? 0).toFixed(1)}`)
          .join("|"),
      );
      categoryVectors.add(
        categories!.children
          .map((child) => `${child.label}:${(child.sharePct ?? 0).toFixed(1)}`)
          .join("|"),
      );
      topProductVectors.add(
        topProducts!.children.map((child) => child.label).join("|"),
      );
    }

    expect(channelVectors.size).toBeGreaterThan(1);
    expect(categoryVectors.size).toBeGreaterThan(1);
    expect(topProductVectors.size).toBeGreaterThan(1);

    const allowed = filterMatchesByMerchFilters(DEFAULT_MERCH_FILTERS);
    const ticketRows = computeMatchSalesTable(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const completed = allowed.filter((match) => match.eventCompleted);
    const upcoming = allowed.filter((match) => !match.eventCompleted);
    const rowIds = new Set(rows.map((row) => row.matchId));

    expect(upcoming.length).toBeGreaterThan(0);
    expect(rows).toHaveLength(completed.length);
    expect(rowIds).toEqual(new Set(completed.map((match) => match.id)));
    expect(rows.every((row) => row.receipts > 0 && row.revenue > 0)).toBe(true);
    expect(ticketRows.length).toBeGreaterThan(rows.length);
    expect(ticketRows.length).toBe(allowed.length);

    const fulfillmentKeys = new Set(
      tree.map((match) => (match.revenue / (match.planRevenue ?? 0)).toFixed(3)),
    );
    expect(fulfillmentKeys.size).toBeGreaterThan(1);
    expect(
      tree.every((match) =>
        match.children.every((section) =>
          section.children.every((leaf) => leaf.planRevenue === null),
        ),
      ),
    ).toBe(true);
  });

  it("adds off-match Продажи aggregating ТРК Радуга, ТРК Континент, and Онлайн-магазин", () => {
    const matchRows = computeMerchMatchSalesTable(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
    );
    const offMatch = computeMerchOffMatchSalesRow(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
    );
    const rows = computeMerchSalesTableWithOffMatch(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
    );
    expect(offMatch).not.toBeNull();
    expect(rows).toHaveLength(matchRows.length + 1);
    expect(rows.some((row) => row.matchId === MERCH_OFF_MATCH_ID)).toBe(true);
    expect(rows.at(-1)?.matchId).toBe(MERCH_OFF_MATCH_ID);
    expect(matchRows.some((row) => row.matchId === MERCH_OFF_MATCH_ID)).toBe(
      false,
    );

    const txs = filterMerchTransactions(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
      { useSeasonRange: true },
    );
    let revenue = 0;
    let receipts = 0;
    let units = 0;
    const byPoint: Record<"mall_raduga" | "mall_continent" | "online_store", number> =
      {
        mall_raduga: 0,
        mall_continent: 0,
        online_store: 0,
      };
    for (const tx of txs) {
      const point = tx.merchSalesPoint;
      if (
        point !== "mall_raduga" &&
        point !== "mall_continent" &&
        point !== "online_store"
      ) {
        continue;
      }
      if (tx.isReturn) {
        revenue -= tx.amount;
        units -= tx.quantity;
        receipts = Math.max(0, receipts - 1);
        byPoint[point] -= tx.amount;
      } else {
        revenue += tx.amount;
        units += tx.quantity;
        receipts += 1;
        byPoint[point] += tx.amount;
      }
    }

    expect(offMatch!.eventLabel).toBe(MERCH_OFF_MATCH_LABEL);
    expect(offMatch!.revenue).toBe(revenue);
    expect(offMatch!.receipts).toBe(receipts);
    expect(offMatch!.units).toBe(units);
    expect(offMatch!.revenue).toBeGreaterThan(0);
    expect(byPoint.mall_raduga).toBeGreaterThan(0);
    expect(byPoint.mall_continent).toBeGreaterThan(0);
    expect(byPoint.online_store).toBeGreaterThan(0);

    const tree = computeMerchSalesTree(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_MERCH_FILTERS,
      rows,
    );
    const offNode = tree.find((node) => node.matchId === MERCH_OFF_MATCH_ID)!;
    expect(tree.at(-1)?.matchId).toBe(MERCH_OFF_MATCH_ID);
    const channels = findSection(
      offNode,
      MERCH_SALES_SECTION_LABELS.salesChannel,
    )!;
    expect(channels.children.map((child) => child.label)).toEqual([
      MERCH_SALES_POINT_LABELS.mall_raduga,
      MERCH_SALES_POINT_LABELS.mall_continent,
      MERCH_SALES_POINT_LABELS.online_store,
    ]);
    expect(
      channels.children.find(
        (child) => child.label === MERCH_SALES_POINT_LABELS.mall_raduga,
      )!.revenue,
    ).toBe(byPoint.mall_raduga);
    expect(
      channels.children.find(
        (child) => child.label === MERCH_SALES_POINT_LABELS.mall_continent,
      )!.revenue,
    ).toBe(byPoint.mall_continent);
    expect(
      channels.children.find(
        (child) => child.label === MERCH_SALES_POINT_LABELS.online_store,
      )!.revenue,
    ).toBe(byPoint.online_store);
    expect(sumChildren(channels, "revenue")).toBe(offNode.revenue);

    const hiddenWhenMatchFilter = computeMerchOffMatchSalesRow(
      DEFAULT_DASHBOARD_FILTERS,
      { ...DEFAULT_MERCH_FILTERS, matchId: [matchRows[0]!.matchId] },
    );
    expect(hiddenWhenMatchFilter).toBeNull();

    const allowed = filterMatchesByMerchFilters(DEFAULT_MERCH_FILTERS);
    const upcoming = allowed.filter((match) => !match.eventCompleted);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(matchRows).toHaveLength(
      allowed.filter((match) => match.eventCompleted).length,
    );
    expect(
      matchRows.some((row) =>
        upcoming.some((match) => match.id === row.matchId),
      ),
    ).toBe(false);
  });
});

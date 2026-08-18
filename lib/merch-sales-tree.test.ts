import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeMerchMatchSalesTable } from "@/lib/filters";
import {
  DEFAULT_MERCH_FILTERS,
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
} from "@/lib/merch-filter-options";
import {
  buildDefaultMerchFixtureTree,
  MERCH_FIXTURE_ARENA_MATCH_ID,
  MERCH_FIXTURE_NORTH_MATCH_ID,
} from "@/lib/merch-sales-tree.fixture";
import {
  computeMerchSalesTree,
  flattenExpandedMerchSalesTree,
  MERCH_SALES_SECTION_LABELS,
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
  it("builds match → two parallel sections, not nested into each other", () => {
    const { tree } = buildDefaultMerchFixtureTree();
    expect(tree).toHaveLength(2);

    for (const match of tree) {
      expect(match.level).toBe("match");
      expect(match.children.map((child) => child.label)).toEqual([
        MERCH_SALES_SECTION_LABELS.salesChannel,
        MERCH_SALES_SECTION_LABELS.productCategory,
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
      expect(sumChildren(channels, "revenue")).toBe(match.revenue);
      expect(sumChildren(categories, "revenue")).toBe(match.revenue);
      expect(sumChildren(channels, "units")).toBe(match.units);
      expect(sumChildren(categories, "units")).toBe(match.units);
      expect(shareSum(channels)).toBeCloseTo(100, 8);
      expect(shareSum(categories)).toBeCloseTo(100, 8);
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
    expect(collapsed).toHaveLength(2);

    const match = tree[0]!;
    const matchOnly = flattenExpandedMerchSalesTree(
      [match],
      new Set([match.id]),
    );
    expect(matchOnly.map((row) => row.level)).toEqual([
      "match",
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
    expect(oneSection.filter((row) => row.level === "section")).toHaveLength(2);
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

    for (const match of tree) {
      const row = byId.get(match.matchId)!;
      expect(match.revenue).toBe(row.revenue);
      expect(match.receipts).toBe(row.receipts);
      expect(match.units).toBe(row.units);
      expect(match.avgCheck).toBe(row.avgCheck);
      expect(match.upt).toBe(row.upt);
      expect(match.purchaseConversionPct).toBe(row.purchaseConversionPct);

      const channels = findSection(
        match,
        MERCH_SALES_SECTION_LABELS.salesChannel,
      );
      const categories = findSection(
        match,
        MERCH_SALES_SECTION_LABELS.productCategory,
      );
      expect(channels).toBeDefined();
      expect(categories).toBeDefined();
      expect(sumChildren(channels!, "revenue")).toBe(match.revenue);
      expect(sumChildren(categories!, "revenue")).toBe(match.revenue);
      expect(shareSum(channels!)).toBeCloseTo(100, 5);
      expect(shareSum(categories!)).toBeCloseTo(100, 5);
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
    }

    expect(channelVectors.size).toBeGreaterThan(1);
    expect(categoryVectors.size).toBeGreaterThan(1);
  });
});

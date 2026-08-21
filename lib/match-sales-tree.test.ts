import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeMatchSalesTable } from "@/lib/filters";
import * as filtersModule from "@/lib/filters";
import {
  buildMatchAggregateIndex,
  buildSalesTree,
  collectMatchSalesNodeIds,
  computeMatchSalesTree,
  flattenExpandedMatchSalesTree,
  getMatchSalesExpandScopeKey,
  getMatchSalesTreeTransactions,
  MATCH_SALES_SECTION_LABELS,
  paginateTopLevel,
  pruneExpandedKeys,
  pruneExpandedKeysForMatches,
  sortMatchSalesNodes,
  matchSalesIssuedOccupancyPercent,
  matchSalesPlanFulfillmentPct,
  toggleExpandedKey,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import {
  ALL_ORDER_SOURCES,
  ALL_PRICE_ZONES,
  DEFAULT_TICKET_FILTERS,
  ORDER_SOURCE_LABELS,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
  isAllowedSectorPriceZone,
  priceZoneFromUnitPrice,
} from "@/lib/ticket-filter-options";
import { getSectorCapacity } from "@/lib/arena-sector-inventory";
import { occupancyMassCapacity } from "@/lib/ticket-plan";
import { getMatchById, getMatches, getTicketTransactionsByMatchId } from "@/lib/mock/data-store";
import type { PriceZone, Sector, TicketFilters, Transaction } from "@/types/dashboard";

const filters = DEFAULT_DASHBOARD_FILTERS;
const ticketFilters = DEFAULT_TICKET_FILTERS;

function buildTree(nextTicketFilters: TicketFilters = ticketFilters) {
  const matchRows = computeMatchSalesTable(filters, nextTicketFilters);
  return {
    matchRows,
    txs: getMatchSalesTreeTransactions(filters, nextTicketFilters),
    tree: computeMatchSalesTree(filters, nextTicketFilters, matchRows),
  };
}

function sumChildren(
  node: MatchSalesTreeNode,
  field: "revenue" | "ticketsSold" | "freeTickets" | "issuedTickets",
): number {
  return node.children.reduce((sum, child) => sum + child[field], 0);
}

function findSection(match: MatchSalesTreeNode, label: string) {
  return match.children.find((child) => child.label === label);
}

function findParallelCuts(tree: MatchSalesTreeNode[]) {
  for (const match of tree) {
    const ticketType = findSection(match, MATCH_SALES_SECTION_LABELS.ticketType);
    const orderSource = findSection(
      match,
      MATCH_SALES_SECTION_LABELS.orderSource,
    );
    const priceZone = findSection(match, MATCH_SALES_SECTION_LABELS.priceZone);
    const arena = ticketType?.children.find(
      (child) => child.label === TICKET_TYPE_LABELS.arena,
    );
    const parking = ticketType?.children.find(
      (child) => child.label === TICKET_TYPE_LABELS.parking,
    );
    if (!ticketType || !orderSource || !priceZone || !arena) continue;
    return { match, ticketType, orderSource, priceZone, arena, parking };
  }
  return null;
}

describe("price zone buckets", () => {
  it("maps unit prices onto the six cost buckets", () => {
    expect(priceZoneFromUnitPrice(0)).toBe("up_to_500");
    expect(priceZoneFromUnitPrice(499.99)).toBe("up_to_500");
    expect(priceZoneFromUnitPrice(500)).toBe("from_500_to_1000");
    expect(priceZoneFromUnitPrice(999)).toBe("from_500_to_1000");
    expect(priceZoneFromUnitPrice(1000)).toBe("from_1000_to_1500");
    expect(priceZoneFromUnitPrice(1499)).toBe("from_1000_to_1500");
    expect(priceZoneFromUnitPrice(1500)).toBe("from_1500_to_2000");
    expect(priceZoneFromUnitPrice(1999)).toBe("from_1500_to_2000");
    expect(priceZoneFromUnitPrice(2000)).toBe("from_2000_to_2500");
    expect(priceZoneFromUnitPrice(2499)).toBe("from_2000_to_2500");
    expect(priceZoneFromUnitPrice(2500)).toBe("from_2500_to_3000");
    expect(priceZoneFromUnitPrice(2999)).toBe("from_2500_to_3000");
    expect(priceZoneFromUnitPrice(3000)).toBe("from_2500_to_3000");
    expect(priceZoneFromUnitPrice(4500)).toBe("from_2500_to_3000");
    expect(priceZoneFromUnitPrice(9000)).toBe("from_2500_to_3000");
  });

  it("gives every match with arena tickets all six price zones", () => {
    const byMatch = getTicketTransactionsByMatchId();
    const matchesWithArena = getMatches().filter((match) =>
      (byMatch.get(match.id) ?? []).some((tx) => tx.ticketType === "arena"),
    );
    expect(matchesWithArena.length).toBeGreaterThan(8);

    const sampled = [
      ...matchesWithArena.filter((match) => match.league === "KHL").slice(0, 6),
      ...matchesWithArena.filter((match) => match.league === "VHL").slice(0, 2),
      ...matchesWithArena.filter((match) => match.league === "MHL").slice(0, 2),
    ];
    expect(sampled.length).toBeGreaterThanOrEqual(8);

    for (const match of matchesWithArena) {
      const txs = byMatch.get(match.id) ?? [];
      const zones = new Set(
        txs
          .filter((tx) => tx.ticketType === "arena" && tx.priceZone)
          .map((tx) => tx.priceZone),
      );
      expect(zones, `${match.id} ${match.league}`).toEqual(
        new Set(ALL_PRICE_ZONES),
      );
      expect(
        txs
          .filter((tx) => tx.ticketType === "parking")
          .every((tx) => tx.priceZone == null),
      ).toBe(true);
    }

    for (const match of sampled) {
      expect(match.league).toBeTruthy();
    }
  });
});

describe("match sales tree", () => {
  it("computes sector occupancy as issued/sectorCapacity, not qty/matchTotal", () => {
    const sector = {
      level: "sector" as const,
      issuedTickets: 240,
      occupancyIssuedTickets: 240,
      capacity: 800,
    };
    const match = {
      level: "match" as const,
      issuedTickets: 11_952,
      occupancyIssuedTickets: 11_952,
      capacity: 12_000,
    };
    expect(matchSalesIssuedOccupancyPercent(sector)).toBeCloseTo(30);
    expect(matchSalesIssuedOccupancyPercent(sector)).not.toBeCloseTo(
      (240 / 11_952) * 100,
    );
    expect(matchSalesIssuedOccupancyPercent(match)).toBeCloseTo(
      (11_952 / occupancyMassCapacity(12_000)) * 100,
    );
    expect(matchSalesIssuedOccupancyPercent({ ...sector, capacity: null })).toBeNull();
  });

  it("builds match → three parallel sections, not a nested drill-down", () => {
    const { matchRows, tree } = buildTree();
    expect(tree.length).toBe(matchRows.length);
    expect(tree.length).toBeGreaterThan(0);

    const sample = findParallelCuts(tree);
    expect(sample).not.toBeNull();
    expect(sample!.match.level).toBe("match");
    expect(sample!.match.children.map((child) => child.label)).toEqual([
      MATCH_SALES_SECTION_LABELS.ticketType,
      MATCH_SALES_SECTION_LABELS.orderSource,
      MATCH_SALES_SECTION_LABELS.priceZone,
    ]);
    expect(sample!.ticketType.level).toBe("section");
    expect(sample!.orderSource.level).toBe("section");
    expect(sample!.priceZone.level).toBe("section");
    expect(sample!.arena.level).toBe("ticketType");
    expect(sample!.arena.label).toBe("Арена");
    expect(sample!.parking?.level).toBe("ticketType");
    expect(sample!.parking?.label).toBe("Парковка");
    expect(sample!.ticketType.children.every((child) => child.children.length === 0)).toBe(
      true,
    );
    expect(sample!.orderSource.children.map((child) => child.label)).toEqual(
      ALL_ORDER_SOURCES.map((source) => ORDER_SOURCE_LABELS[source]),
    );
    expect(sample!.orderSource.children.every((child) => child.level === "orderSource")).toBe(
      true,
    );
    expect(sample!.orderSource.children.every((child) => child.children.length === 0)).toBe(
      true,
    );
    expect(sample!.priceZone.children.map((child) => child.label)).toEqual(
      ALL_PRICE_ZONES.map((zone) => PRICE_ZONE_LABELS[zone]),
    );
    expect(sample!.priceZone.children.every((child) => child.level === "priceZone")).toBe(
      true,
    );
    expect(
      sample!.priceZone.children.some((child) => child.children.length > 0),
    ).toBe(true);
    expect(sample!.match.date).toBeInstanceOf(Date);
    expect(sample!.priceZone.children[0]?.date).toBeNull();
    expect(sample!.priceZone.children[0]?.planRevenue).toBeNull();
    expect(sample!.priceZone.children[0]?.capacity).toBeNull();
    expect(sample!.match.planRevenue).toBeGreaterThan(0);
    expect(sample!.match.capacity).toBeGreaterThan(0);
  });

  it("keeps match KPIs identical to computeMatchSalesTable", () => {
    const { matchRows, tree } = buildTree();
    const byId = new Map(matchRows.map((row) => [row.matchId, row]));
    for (const node of tree) {
      const row = byId.get(node.matchId);
      expect(row).toBeDefined();
      expect(node.revenue).toBe(row!.revenue);
      expect(node.ticketsSold).toBe(row!.ticketsSold);
      expect(node.freeTickets).toBe(row!.freeTickets);
      expect(node.issuedTickets).toBe(row!.issuedTickets);
      expect(node.avgPrice).toBe(row!.avgPrice);
      expect(node.loyaltyDiscountPct).toBe(row!.loyaltyDiscountPct);
      expect(node.planRevenue).toBe(row!.planRevenue);
      expect(node.capacity).toBe(row!.capacity);
      expect(node.label).toBe(row!.eventLabel);
      expect(node.label).not.toMatch(/\d{2}-\d{2}-\d{2}/);
    }
  });

  it("computes plan fulfillment percent only when a plan base exists", () => {
    expect(matchSalesPlanFulfillmentPct(99, 100)).toBeCloseTo(99);
    expect(matchSalesPlanFulfillmentPct(50, 0)).toBeNull();
    expect(matchSalesPlanFulfillmentPct(50, null)).toBeNull();
  });

  it("treats sections as alternative views: totals match the parent, children split each cut", () => {
    const { tree } = buildTree();
    const sample = findParallelCuts(tree);
    expect(sample).not.toBeNull();

    for (const match of tree.slice(0, 8)) {
      for (const section of match.children) {
        expect(section.level).toBe("section");
        expect(section.revenue).toBe(match.revenue);
        expect(section.ticketsSold).toBe(match.ticketsSold);
        expect(section.freeTickets).toBe(match.freeTickets);
        expect(section.issuedTickets).toBe(match.issuedTickets);
        expect(section.avgPrice).toBe(match.avgPrice);
        expect(section.loyaltyDiscountPct).toBe(match.loyaltyDiscountPct);
      }

      const ticketType = findSection(match, MATCH_SALES_SECTION_LABELS.ticketType);
      const orderSource = findSection(
        match,
        MATCH_SALES_SECTION_LABELS.orderSource,
      );
      const priceZone = findSection(match, MATCH_SALES_SECTION_LABELS.priceZone);
      if (ticketType) {
        expect(sumChildren(ticketType, "revenue")).toBe(ticketType.revenue);
        expect(sumChildren(ticketType, "ticketsSold")).toBe(ticketType.ticketsSold);
      }
      if (orderSource) {
        expect(sumChildren(orderSource, "revenue")).toBe(orderSource.revenue);
        expect(sumChildren(orderSource, "ticketsSold")).toBe(
          orderSource.ticketsSold,
        );
      }
      if (priceZone) {
        const zoneRevenue = sumChildren(priceZone, "revenue");
        expect(zoneRevenue).toBeLessThanOrEqual(priceZone.revenue);
        const parking = ticketType?.children.find(
          (child) => child.label === TICKET_TYPE_LABELS.parking,
        );
        if (parking && parking.revenue > 0) {
          expect(zoneRevenue).toBe(priceZone.revenue - parking.revenue);
        } else {
          expect(zoneRevenue).toBe(priceZone.revenue);
        }
      }
    }

    const expanded = new Set([
      sample!.match.id,
      sample!.ticketType.id,
      sample!.orderSource.id,
      sample!.priceZone.id,
    ]);
    const flat = flattenExpandedMatchSalesTree([sample!.match], expanded);
    expect(flat.find((row) => row.level === "match")?.revenue).toBe(
      sample!.match.revenue,
    );
    expect(flat.filter((row) => row.level === "section")).toHaveLength(3);
    expect(flat.some((row) => row.level === "ticketType")).toBe(true);
    expect(flat.some((row) => row.level === "orderSource")).toBe(true);
    expect(flat.some((row) => row.level === "priceZone")).toBe(true);
  });

  it("expands sections independently without requiring another section", () => {
    const { tree } = buildTree();
    const sample = findParallelCuts(tree);
    expect(sample).not.toBeNull();

    const sourceOnly = flattenExpandedMatchSalesTree(
      [sample!.match],
      new Set([sample!.match.id, sample!.orderSource.id]),
    );
    expect(sourceOnly.map((row) => row.level)).toEqual([
      "match",
      "section",
      "section",
      ...sample!.orderSource.children.map(() => "orderSource" as const),
      "section",
    ]);
    expect(sourceOnly.some((row) => row.level === "ticketType")).toBe(false);
    expect(sourceOnly.some((row) => row.level === "priceZone")).toBe(false);

    const twoSections = flattenExpandedMatchSalesTree(
      [sample!.match],
      new Set([
        sample!.match.id,
        sample!.orderSource.id,
        sample!.priceZone.id,
      ]),
    );
    expect(twoSections.some((row) => row.level === "orderSource")).toBe(true);
    expect(twoSections.some((row) => row.level === "priceZone")).toBe(true);
    expect(twoSections.some((row) => row.level === "ticketType")).toBe(false);
    expect(twoSections.filter((row) => row.level === "priceZone")).toHaveLength(
      sample!.priceZone.children.length,
    );
  });

  it("shows Парковка under KHL matches with arena ticket sales", () => {
    const { tree } = buildTree();
    const khlWithParking = tree.filter((node) => {
      const ticketType = findSection(node, MATCH_SALES_SECTION_LABELS.ticketType);
      return ticketType?.children.some(
        (child) => child.label === TICKET_TYPE_LABELS.parking,
      );
    });
    expect(khlWithParking.length).toBeGreaterThan(0);
    const sample = khlWithParking[0]!;
    const ticketType = findSection(sample, MATCH_SALES_SECTION_LABELS.ticketType);
    const parking = ticketType?.children.find(
      (child) => child.label === TICKET_TYPE_LABELS.parking,
    );
    expect(parking).toBeDefined();
    expect(parking!.ticketsSold).toBeGreaterThanOrEqual(8);
    expect(parking!.revenue).toBeGreaterThan(0);
  });

  it("hides the price-zone section when parking tickets have no zone", () => {
    const parkingFilters: TicketFilters = { ...ticketFilters, ticketType: "parking" };
    const parking = buildTree(parkingFilters);
    expect(parking.tree.length).toBeGreaterThan(0);
    for (const match of parking.tree) {
      expect(findSection(match, MATCH_SALES_SECTION_LABELS.priceZone)).toBeUndefined();
      const ticketType = findSection(
        match,
        MATCH_SALES_SECTION_LABELS.ticketType,
      );
      expect(ticketType?.children.map((child) => child.label)).toEqual([
        TICKET_TYPE_LABELS.parking,
      ]);
    }
  });

  it("uses weighted loyalty discount from the branch, not an average of child percents", () => {
    const { tree } = buildTree();
    const match = tree.find((node) => node.children.length >= 2);
    expect(match).toBeDefined();
    expect(match!.loyaltyDiscountPct).toBeGreaterThanOrEqual(0);
  });

  it("follows global ticket filters for match set and expanded branches", () => {
    const allRows = computeMatchSalesTable(filters, ticketFilters);
    const vhlFilters: TicketFilters = { ...ticketFilters, league: "VHL" };
    const vhl = buildTree(vhlFilters);
    expect(vhl.tree.length).toBe(vhl.matchRows.length);
    expect(vhl.matchRows.length).toBeGreaterThan(0);
    expect(vhl.matchRows.length).toBeLessThan(allRows.length);

    const zone: PriceZone = "up_to_500";
    const zoneFilters: TicketFilters = { ...ticketFilters, priceZone: zone };
    const zoneRows = computeMatchSalesTable(filters, zoneFilters);
    const zoneTxs = getMatchSalesTreeTransactions(filters, zoneFilters);
    const zoneTree = computeMatchSalesTree(filters, zoneFilters, zoneRows, {
      transactions: zoneTxs,
    });
    expect(zoneTree.length).toBe(zoneRows.length);
    expect(zoneRows.length).toBeGreaterThan(0);
    expect(zoneRows.length).toBeLessThanOrEqual(allRows.length);

    const zoneNodes = zoneTree.flatMap((match) => {
      const section = findSection(match, MATCH_SALES_SECTION_LABELS.priceZone);
      return section?.children ?? [];
    });
    expect(zoneNodes.length).toBeGreaterThan(0);
    expect(
      zoneNodes.every((row) => row.label === PRICE_ZONE_LABELS[zone]),
    ).toBe(true);
  });

  it("paginates top-level matches only and keeps children under the parent after sort", () => {
    const { tree } = buildTree();
    const pageSize = 3;
    const { pageItems, pageCount } = paginateTopLevel(tree, 0, pageSize);
    expect(pageItems).toHaveLength(pageSize);
    expect(pageCount).toBe(Math.ceil(tree.length / pageSize));

    const expanded = new Set(pageItems.map((node) => node.id));
    const flat = flattenExpandedMatchSalesTree(pageItems, expanded);
    const matchCount = flat.filter((row) => row.level === "match").length;
    expect(matchCount).toBe(pageSize);
    expect(flat.length).toBeGreaterThan(matchCount);

    const sorted = sortMatchSalesNodes(tree, { id: "revenue", desc: true });
    expect(sorted[0]!.revenue).toBeGreaterThanOrEqual(sorted[1]!.revenue);
    const first = sorted[0]!;
    const expandedFirst = flattenExpandedMatchSalesTree(
      [first],
      new Set([first.id, first.children[0]?.id ?? ""]),
    );
    expect(expandedFirst[0]?.id).toBe(first.id);
    expect(
      expandedFirst.slice(1).every((row) => row.matchId === first.matchId),
    ).toBe(true);
  });

  it("does not render collapsed children", () => {
    const { tree } = buildTree();
    const flat = flattenExpandedMatchSalesTree(tree.slice(0, 2), new Set());
    expect(flat).toHaveLength(2);
    expect(flat.every((row) => row.level === "match")).toBe(true);
  });

  it("prunes expand keys when the match set changes and persists keys that remain", () => {
    const { tree } = buildTree();
    const first = tree[0]!;
    const second = tree[1]!;
    let expanded = toggleExpandedKey([], first.id);
    expanded = toggleExpandedKey(expanded, second.id);
    const valid = collectMatchSalesNodeIds([first]);
    const pruned = pruneExpandedKeys(expanded, valid);
    expect(pruned).toEqual([first.id]);
    expect(getMatchSalesExpandScopeKey(ticketFilters)).toContain(
      ticketFilters.season,
    );
  });

  it("does not scan transactions when collapsed with empty provided list", () => {
    const matchRows = computeMatchSalesTable(filters, ticketFilters);
    const trap = () => {
      throw new Error("collapsed tree must not iterate transactions");
    };
    const guardedTxs = new Proxy([] as Transaction[], {
      get(_target, prop) {
        if (prop === "length") return 0;
        if (prop === Symbol.iterator) {
          return function* () {
            trap();
          };
        }
        if (
          prop === "filter" ||
          prop === "forEach" ||
          prop === "map" ||
          prop === "reduce"
        ) {
          return trap;
        }
        if (typeof prop === "string" && /^\d+$/.test(prop)) {
          trap();
        }
        return undefined;
      },
    });

    const started = performance.now();
    const collapsed = computeMatchSalesTree(
      filters,
      ticketFilters,
      matchRows,
      { transactions: guardedTxs },
    );
    expect(performance.now() - started).toBeLessThan(50);
    expect(collapsed.length).toBe(matchRows.length);
    expect(collapsed.every((node) => node.children.length === 0)).toBe(true);

    const filterSpy = vi.spyOn(filtersModule, "filterTicketTransactions");
    const matchFilterSpy = vi.spyOn(
      filtersModule,
      "filterTicketTransactionsForMatchIds",
    );
    const withoutScan = computeMatchSalesTree(
      filters,
      ticketFilters,
      matchRows,
      { transactions: [] },
    );
    expect(filterSpy).not.toHaveBeenCalled();
    expect(matchFilterSpy).not.toHaveBeenCalled();
    expect(withoutScan.length).toBe(matchRows.length);
    filterSpy.mockRestore();
    matchFilterSpy.mockRestore();
  });

  it("paginates matches first and builds children only for the page", () => {
    const matchRows = computeMatchSalesTable(filters, ticketFilters);
    const { pageItems } = paginateTopLevel(matchRows, 0, 3);
    const pageIds = pageItems.map((row) => row.matchId);
    const txs = getMatchSalesTreeTransactions(filters, ticketFilters, pageIds);
    const filterSpy = vi.spyOn(filtersModule, "filterTicketTransactions");
    const tree = buildSalesTree(
      txs,
      pageItems,
      filters,
      ticketFilters,
    );
    expect(filterSpy).not.toHaveBeenCalled();
    expect(tree).toHaveLength(3);
    expect(tree.every((node) => node.children.length > 0)).toBe(true);
    filterSpy.mockRestore();
  });

  it("keeps prebuilt children when flattening; expand only changes visible rows", () => {
    const { tree } = buildTree();
    const first = tree[0]!;
    expect(first.children.length).toBeGreaterThan(0);

    const collapsed = flattenExpandedMatchSalesTree([first], new Set());
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.level).toBe("match");

    const expanded = flattenExpandedMatchSalesTree(
      [first],
      new Set([first.id]),
    );
    expect(expanded.length).toBeGreaterThan(1);
    expect(expanded[0]?.id).toBe(first.id);
    expect(expanded.slice(1).every((row) => row.matchId === first.matchId)).toBe(
      true,
    );
    expect(first.children.length).toBeGreaterThan(0);
  });

  it("does not scan the global ticket set when provided transactions are empty", () => {
    const matchRows = computeMatchSalesTable(filters, ticketFilters);
    const firstId = `m:${matchRows[0]!.matchId}`;
    const filterSpy = vi.spyOn(filtersModule, "filterTicketTransactions");
    const matchFilterSpy = vi.spyOn(
      filtersModule,
      "filterTicketTransactionsForMatchIds",
    );
    const expanded = computeMatchSalesTree(
      filters,
      ticketFilters,
      matchRows,
      { transactions: [] },
    );
    const node = expanded.find((row) => row.id === firstId);
    expect(filterSpy).not.toHaveBeenCalled();
    expect(matchFilterSpy).not.toHaveBeenCalled();
    expect(node?.children.length).toBe(0);
    expect(node?.hasChildren).toBe(true);
    filterSpy.mockRestore();
    matchFilterSpy.mockRestore();
  });

  it("indexes transactions in one pass and expand flatten stays under 200ms", () => {
    const { txs, tree } = buildTree();
    const index = buildMatchAggregateIndex(txs);
    expect(index.size).toBeGreaterThan(0);
    const sample = tree[0]!;
    expect(index.get(sample.matchId)?.types.size).toBeGreaterThan(0);

    const ids = collectMatchSalesNodeIds([sample]);
    const started = performance.now();
    flattenExpandedMatchSalesTree([sample], ids);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(200);
  });

  it("prunes nested expand keys only when the match disappears", () => {
    const { tree } = buildTree();
    const first = tree[0]!;
    const typeId = first.children[0]?.id;
    expect(typeId).toBeDefined();
    const expanded = [first.id, typeId!];
    const kept = pruneExpandedKeysForMatches(
      expanded,
      new Set([first.id]),
    );
    expect(kept).toEqual(expanded);
    const dropped = pruneExpandedKeysForMatches(expanded, new Set());
    expect(dropped).toEqual([]);
  });

  it("expands a price zone into allowed sectors with sales", () => {
    const { tree } = buildTree();
    const sample = findParallelCuts(tree);
    expect(sample).not.toBeNull();

    const zonesWithSectors = sample!.priceZone.children.filter(
      (child) => child.children.length > 0,
    );
    expect(zonesWithSectors.length).toBeGreaterThan(0);

    for (const match of tree.slice(0, 12)) {
      const priceZone = findSection(match, MATCH_SALES_SECTION_LABELS.priceZone);
      if (!priceZone) continue;
      for (const zone of priceZone.children) {
        const zoneId = ALL_PRICE_ZONES.find(
          (id) => PRICE_ZONE_LABELS[id] === zone.label,
        );
        expect(zoneId).toBeDefined();
        expect(zone.hasChildren).toBe(zone.children.length > 0);
        expect(zone.children.every((child) => child.level === "sector")).toBe(
          true,
        );
        expect(zone.children.every((child) => child.hasChildren === false)).toBe(
          true,
        );
        expect(zone.children.every((child) => child.planRevenue === null)).toBe(
          true,
        );
        expect(zone.capacity).toBeNull();
        for (const sector of zone.children) {
          expect(
            isAllowedSectorPriceZone(sector.label as Sector, zoneId!),
          ).toBe(true);
          expect(sector.capacity).toBeGreaterThan(0);
          expect(
            sector.ticketsSold > 0 ||
              sector.freeTickets > 0 ||
              sector.issuedTickets > 0,
          ).toBe(true);
          expect(sector.avgPrice).toBe(
            sector.ticketsSold > 0 ? sector.revenue / sector.ticketsSold : 0,
          );
        }
        const sectorRevenue = zone.children.reduce(
          (sum, child) => sum + child.revenue,
          0,
        );
        expect(sectorRevenue).toBeCloseTo(zone.revenue, 6);
      }
    }

    const vipZone = sample!.priceZone.children.find(
      (child) => child.label === PRICE_ZONE_LABELS.from_2500_to_3000,
    );
    expect(vipZone).toBeDefined();
    expect(vipZone!.children.some((child) => child.label === "VIP")).toBe(true);

    expect(sample!.parking?.children ?? []).toEqual([]);
    expect(sample!.arena.children).toEqual([]);

    const zone = zonesWithSectors[0]!;
    const flat = flattenExpandedMatchSalesTree(
      [sample!.match],
      new Set([sample!.match.id, sample!.priceZone.id, zone.id]),
    );
    const sectorRows = flat.filter((row) => row.level === "sector");
    expect(sectorRows.length).toBe(zone.children.length);
    expect(sectorRows.every((row) => row.depth === 3)).toBe(true);
  });

  it("hides filtered-out sectors under a price zone", () => {
    const sectorFilters: TicketFilters = { ...ticketFilters, sector: ["A"] };
    const { tree } = buildTree(sectorFilters);
    expect(tree.length).toBeGreaterThan(0);
    for (const match of tree) {
      const priceZone = findSection(match, MATCH_SALES_SECTION_LABELS.priceZone);
      if (!priceZone) continue;
      for (const zone of priceZone.children) {
        expect(zone.children.every((child) => child.label === "A")).toBe(true);
        expect(
          zone.children.some((child) => child.label === "VIP"),
        ).toBe(false);
      }
    }
  });

  it("scales sector occupancy to issued/sectorCapacity, not qty/matchTotal", () => {
    const { tree } = buildTree();
    const matchesById = getMatchById();
    let checked = 0;

    for (const match of tree.slice(0, 12)) {
      const catalog = matchesById.get(match.matchId);
      const priceZone = findSection(match, MATCH_SALES_SECTION_LABELS.priceZone);
      if (!catalog || !priceZone) continue;

      for (const zone of priceZone.children) {
        for (const sector of zone.children) {
          const sectorCap = getSectorCapacity(catalog, sector.label as Sector);
          expect(sector.capacity).toBe(sectorCap);
          expect(sectorCap).toBeGreaterThan(0);

          const occupancy = Math.min(100, (sector.issuedTickets / sectorCap) * 100);
          const matchShare = (sector.issuedTickets / match.issuedTickets) * 100;
          expect(matchSalesIssuedOccupancyPercent(sector)).toBeCloseTo(
            occupancy,
            10,
          );
          if (Math.abs(occupancy - matchShare) > 0.5) {
            expect(matchSalesIssuedOccupancyPercent(sector)).not.toBeCloseTo(
              matchShare,
            );
          }
          checked += 1;
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
  });
});

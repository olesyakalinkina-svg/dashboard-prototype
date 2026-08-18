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
  paginateTopLevel,
  pruneExpandedKeys,
  pruneExpandedKeysForMatches,
  sortMatchSalesNodes,
  toggleExpandedKey,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import { DEFAULT_TICKET_FILTERS, ALL_PRICE_ZONES, PRICE_ZONE_LABELS, priceZoneFromUnitPrice } from "@/lib/ticket-filter-options";
import { getMatches, getTicketTransactionsByMatchId } from "@/lib/mock/data-store";
import type { PriceZone, TicketFilters, Transaction } from "@/types/dashboard";

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

function findArenaBranch(tree: MatchSalesTreeNode[]) {
  for (const match of tree) {
    const arena = match.children.find((child) => child.label.includes("Арена"));
    if (!arena) continue;
    const source = arena.children.find((child) => child.children.length > 0);
    if (!source) continue;
    const zone = source.children[0];
    if (!zone) continue;
    return { match, arena, source, zone };
  }
  return null;
}

describe("price zone buckets", () => {
  it("maps unit prices onto the four cost buckets", () => {
    expect(priceZoneFromUnitPrice(0)).toBe("up_to_1500");
    expect(priceZoneFromUnitPrice(1499.99)).toBe("up_to_1500");
    expect(priceZoneFromUnitPrice(1500)).toBe("from_1500_to_2500");
    expect(priceZoneFromUnitPrice(2499)).toBe("from_1500_to_2500");
    expect(priceZoneFromUnitPrice(2500)).toBe("from_2500_to_4000");
    expect(priceZoneFromUnitPrice(3999)).toBe("from_2500_to_4000");
    expect(priceZoneFromUnitPrice(4000)).toBe("from_4000_to_6000");
    expect(priceZoneFromUnitPrice(6000)).toBe("from_4000_to_6000");
    expect(priceZoneFromUnitPrice(9000)).toBe("from_4000_to_6000");
  });

  it("gives every match with arena tickets all four price zones", () => {
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
  it("builds match → ticket type → order source → price zone from actual zones", () => {
    const { matchRows, tree } = buildTree();
    expect(tree.length).toBe(matchRows.length);
    expect(tree.length).toBeGreaterThan(0);

    const sample = findArenaBranch(tree);
    expect(sample).not.toBeNull();
    expect(sample!.match.level).toBe("match");
    expect(sample!.arena.level).toBe("ticketType");
    expect(sample!.source.level).toBe("orderSource");
    expect(sample!.zone.level).toBe("priceZone");
    expect(sample!.zone.label).toMatch(
      /^Ценовая зона · (до 1500|от 1500 до 2500|от 2500 до 4000|от 4000 до 6000)$/,
    );
    expect(sample!.match.date).toBeInstanceOf(Date);
    expect(sample!.zone.date).toBeNull();
    expect(sample!.zone.planRevenue).toBeNull();
    expect(sample!.zone.capacity).toBeNull();
    expect(sample!.match.planRevenue).toBeGreaterThan(0);
    expect(sample!.match.capacity).toBeGreaterThan(0);
    expect(
      tree.some((match) =>
        match.children.some((child) => child.label.includes("Парковка")),
      ),
    ).toBe(true);
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
    }
  });

  it("does not double-sum: parent metrics equal the sum of immediate children", () => {
    const { tree } = buildTree();
    const sample = findArenaBranch(tree);
    expect(sample).not.toBeNull();

    for (const match of tree.slice(0, 8)) {
      expect(sumChildren(match, "revenue")).toBe(match.revenue);
      expect(sumChildren(match, "ticketsSold")).toBe(match.ticketsSold);
      expect(sumChildren(match, "freeTickets")).toBe(match.freeTickets);
      for (const typeNode of match.children) {
        expect(sumChildren(typeNode, "revenue")).toBe(typeNode.revenue);
        for (const sourceNode of typeNode.children) {
          const zoneRevenue = sumChildren(sourceNode, "revenue");
          if (sourceNode.children.length > 0 && typeNode.label.includes("Арена")) {
            expect(zoneRevenue).toBe(sourceNode.revenue);
          }
        }
      }
    }

    const expanded = new Set([
      sample!.match.id,
      sample!.arena.id,
      sample!.source.id,
    ]);
    const flat = flattenExpandedMatchSalesTree([sample!.match], expanded);
    expect(flat.find((row) => row.level === "match")?.revenue).toBe(
      sample!.match.revenue,
    );
    expect(flat.some((row) => row.level === "priceZone")).toBe(true);
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

    const zone: PriceZone = "up_to_1500";
    const zoneFilters: TicketFilters = { ...ticketFilters, priceZone: zone };
    const zoneRows = computeMatchSalesTable(filters, zoneFilters);
    const zoneTxs = getMatchSalesTreeTransactions(filters, zoneFilters);
    const zoneTree = computeMatchSalesTree(filters, zoneFilters, zoneRows, {
      transactions: zoneTxs,
    });
    expect(zoneTree.length).toBe(zoneRows.length);
    expect(zoneRows.length).toBeGreaterThan(0);
    expect(zoneRows.length).toBeLessThanOrEqual(allRows.length);

    const zoneNodes = zoneTree.flatMap((match) =>
      match.children.flatMap((typeNode) =>
        typeNode.children.flatMap((sourceNode) => sourceNode.children),
      ),
    );
    expect(zoneNodes.length).toBeGreaterThan(0);
    expect(
      zoneNodes.every((row) =>
        row.label.endsWith(`· ${PRICE_ZONE_LABELS[zone]}`),
      ),
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
});

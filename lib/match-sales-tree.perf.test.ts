import { describe, expect, it } from "vitest";
import {
  buildMatchAggregateIndex,
  buildSalesTree,
  collectMatchSalesNodeIds,
  flattenExpandedMatchSalesTree,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { DEFAULT_TICKET_FILTERS } from "@/lib/ticket-filter-options";
import type { MatchSalesRow, OrderSource, PriceZone, TicketType, Transaction } from "@/types/dashboard";

const TYPES: TicketType[] = ["arena", "parking"];
const SOURCES: OrderSource[] = ["box_office", "official_site", "yandex_afisha"];
const ZONES: PriceZone[] = [
  "up_to_500",
  "from_500_to_1000",
  "from_1000_to_1500",
  "from_1500_to_2000",
  "from_2000_to_2500",
  "from_2500_to_3000",
];

function syntheticDataset(matchCount: number, txsPerMatch: number): {
  txs: Transaction[];
  rows: MatchSalesRow[];
} {
  const txs: Transaction[] = [];
  const rows: MatchSalesRow[] = [];
  const matchDate = new Date(2025, 10, 1);

  for (let m = 0; m < matchCount; m += 1) {
    const matchId = `perf-match-${m}`;
    let revenue = 0;
    let ticketsSold = 0;
    for (let t = 0; t < txsPerMatch; t += 1) {
      const quantity = (t % 5) + 1;
      const unit = 800 + (t % 7) * 700;
      const amount = quantity * unit;
      revenue += amount;
      ticketsSold += quantity;
      txs.push({
        id: `perf-tx-${m}-${t}`,
        date: matchDate,
        stream: "tickets",
        description: "perf",
        matchId,
        channel: "online",
        amount,
        quantity,
        ticketType: TYPES[t % TYPES.length],
        orderSource: SOURCES[t % SOURCES.length],
        priceZone: t % 11 === 0 ? undefined : ZONES[t % ZONES.length],
      });
    }
    rows.push({
      matchId,
      eventLabel: `Perf ${m}`,
      date: new Date(matchDate.getTime() - m * 86_400_000),
      revenue,
      planRevenue: revenue,
      avgPrice: ticketsSold > 0 ? revenue / ticketsSold : 0,
      ticketsSold,
      freeTickets: 0,
      issuedTickets: ticketsSold,
      occupancyIssuedTickets: ticketsSold,
      capacity: 12_000,
      loyaltyDiscountPct: 0,
    });
  }

  return { txs, rows };
}

function countLargeFilters(run: () => void, minLength: number): number {
  const original = Array.prototype.filter;
  let calls = 0;
  Array.prototype.filter = function filterPatched(
    this: unknown[],
    ...args: Parameters<typeof original>
  ) {
    if (Array.isArray(this) && this.length >= minLength) {
      calls += 1;
    }
    return original.apply(this, args);
  };
  try {
    run();
  } finally {
    Array.prototype.filter = original;
  }
  return calls;
}

function expandOneMatch(tree: MatchSalesTreeNode[]): {
  ids: Set<string>;
  match: MatchSalesTreeNode;
} {
  const match = tree[0]!;
  const ids = new Set<string>([
    match.id,
    ...match.children.map((child) => child.id),
  ]);
  return { ids, match };
}

describe("§14 performance (Node, not Chrome long-task)", () => {
  it("builds and flattens ~100k txs without per-child full-array filter", () => {
    const large = syntheticDataset(100, 1000);
    expect(large.txs).toHaveLength(100_000);

    const small = syntheticDataset(10, 1000);

    const tSmallStart = performance.now();
    const smallTree = buildSalesTree(
      small.txs,
      small.rows,
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const tSmall = performance.now() - tSmallStart;

    const largeFilterCalls = countLargeFilters(() => {
      buildMatchAggregateIndex(large.txs);
    }, 50_000);
    expect(largeFilterCalls).toBe(0);

    const tBuildStart = performance.now();
    const tree = buildSalesTree(
      large.txs,
      large.rows,
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const tBuild = performance.now() - tBuildStart;

    expect(tree).toHaveLength(100);
    const { ids, match } = expandOneMatch(tree);
    expect(match.children).toHaveLength(3);

    const tFlatStart = performance.now();
    const flat = flattenExpandedMatchSalesTree([match], ids);
    const tFlat = performance.now() - tFlatStart;

    expect(flat[0]?.level).toBe("match");
    expect(flat.filter((row) => row.level === "section")).toHaveLength(3);
    expect(flat.length).toBeGreaterThan(6);

    const ratio = tBuild / Math.max(tSmall, 0.1);
    expect(ratio, `build ratio ${ratio.toFixed(1)}x (small ${tSmall.toFixed(1)}ms, large ${tBuild.toFixed(1)}ms)`).toBeLessThan(40);

    const otherMatch = tree[50]!;
    const otherRevenue = otherMatch.revenue;
    flattenExpandedMatchSalesTree([match], ids);
    expect(tree[50]!.revenue).toBe(otherRevenue);
    expect(tree[50]).toBe(otherMatch);

    console.info(
      `[match-sales-tree.perf] build 10k=${tSmall.toFixed(1)}ms, build 100k=${tBuild.toFixed(1)}ms, flatten 1 match=${tFlat.toFixed(1)}ms, ratio=${ratio.toFixed(2)}`,
    );
  });

  it("keeps flatten results stable across five expand/collapse cycles", () => {
    const { txs, rows } = syntheticDataset(20, 500);
    const tree = buildSalesTree(
      txs,
      rows,
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_TICKET_FILTERS,
    );
    const match = tree[0]!;
    const sectionIds = match.children.map((child) => child.id);
    const expanded = new Set([match.id, ...sectionIds]);
    const expected = flattenExpandedMatchSalesTree([match], expanded).map(
      (row) => row.id,
    );

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const collapsed = flattenExpandedMatchSalesTree([match], new Set());
      expect(collapsed).toHaveLength(1);
      expect(collapsed[0]?.id).toBe(match.id);
      const opened = flattenExpandedMatchSalesTree([match], expanded);
      expect(opened.map((row) => row.id)).toEqual(expected);
      expect(opened.filter((row) => row.level === "match")).toHaveLength(1);
      const visibleIds = opened.map((row) => row.id);
      expect(new Set(visibleIds).size).toBe(visibleIds.length);
    }

    const allIds = collectMatchSalesNodeIds([match]);
    const fullyOpen = flattenExpandedMatchSalesTree([match], allIds);
    expect(fullyOpen.every((row) => allIds.has(row.id))).toBe(true);
  });
});

import {
  filterTicketTransactions,
  filterTicketTransactionsForMatchIds,
} from "@/lib/filters";
import {
  applyTicketSalesTransaction,
  createTicketSalesAgg,
  getTicketIssuedQuantity,
  isEmptyTicketSalesAgg,
  ticketSalesAvgPrice,
  ticketSalesLoyaltyDiscountPct,
  type TicketSalesAgg,
} from "@/lib/ticket-sales-metrics";
import {
  ALL_ORDER_SOURCES,
  ALL_PRICE_ZONES,
  ORDER_SOURCE_LABELS,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-filter-options";
import type {
  DashboardFilters,
  MatchSalesRow,
  OrderSource,
  PriceZone,
  TicketFilters,
  TicketType,
  Transaction,
} from "@/types/dashboard";

export type MatchSalesTreeLevel =
  | "match"
  | "ticketType"
  | "orderSource"
  | "priceZone";

export type MatchSalesTreeNode = {
  id: string;
  level: MatchSalesTreeLevel;
  matchId: string;
  date: Date | null;
  label: string;
  revenue: number;
  planRevenue: number | null;
  avgPrice: number;
  ticketsSold: number;
  freeTickets: number;
  issuedTickets: number;
  capacity: number | null;
  loyaltyDiscountPct: number;
  hasChildren: boolean;
  children: MatchSalesTreeNode[];
};

export type MatchSalesFlatRow = Omit<MatchSalesTreeNode, "children"> & {
  depth: number;
  hasChildren: boolean;
};

const TICKET_TYPE_ORDER: TicketType[] = ["arena", "parking"];

const LEVEL_LABELS: Record<Exclude<MatchSalesTreeLevel, "match">, string> = {
  ticketType: "Тип билета",
  orderSource: "Источник",
  priceZone: "Ценовая зона",
};

type BranchAgg = TicketSalesAgg & { issuedTickets: number };

function createBranchAgg(): BranchAgg {
  return { ...createTicketSalesAgg(), issuedTickets: 0 };
}

function applyBranchTransaction(agg: BranchAgg, tx: Transaction): void {
  applyTicketSalesTransaction(agg, tx);
  agg.issuedTickets += getTicketIssuedQuantity(tx);
}

function metricsFromAgg(
  agg: BranchAgg,
  extras: {
    id: string;
    level: MatchSalesTreeLevel;
    matchId: string;
    date: Date | null;
    label: string;
    planRevenue: number | null;
    capacity: number | null;
    hasChildren: boolean;
    children: MatchSalesTreeNode[];
  },
): MatchSalesTreeNode {
  return {
    ...extras,
    revenue: agg.revenue,
    avgPrice: ticketSalesAvgPrice(agg),
    ticketsSold: agg.ticketsSold,
    freeTickets: agg.freeTickets,
    issuedTickets: agg.issuedTickets,
    loyaltyDiscountPct: ticketSalesLoyaltyDiscountPct(agg),
  };
}

function childLabel(
  level: Exclude<MatchSalesTreeLevel, "match">,
  value: string,
): string {
  return `${LEVEL_LABELS[level]} · ${value}`;
}

function typeKey(matchId: string, type: TicketType): string {
  return `m:${matchId}|t:${type}`;
}

function sourceKey(
  matchId: string,
  type: TicketType,
  source: OrderSource,
): string {
  return `m:${matchId}|t:${type}|s:${source}`;
}

function zoneKey(
  matchId: string,
  type: TicketType,
  source: OrderSource,
  zone: PriceZone,
): string {
  return `m:${matchId}|t:${type}|s:${source}|z:${zone}`;
}

export function matchSalesNodeId(matchId: string): string {
  return `m:${matchId}`;
}

export function getMatchSalesExpandScopeKey(
  ticketFilters: Pick<TicketFilters, "season" | "matchId">,
): string {
  return `${ticketFilters.season}|${ticketFilters.matchId.slice().sort().join(",")}`;
}

export function collectMatchSalesNodeIds(
  nodes: MatchSalesTreeNode[],
): Set<string> {
  const ids = new Set<string>();
  const walk = (node: MatchSalesTreeNode) => {
    ids.add(node.id);
    for (const child of node.children) walk(child);
  };
  for (const node of nodes) walk(node);
  return ids;
}

export function pruneExpandedKeys(
  expanded: Iterable<string>,
  validIds: Set<string>,
): string[] {
  const next: string[] = [];
  for (const id of expanded) {
    if (validIds.has(id)) next.push(id);
  }
  return next;
}

/** Keep expand keys whose match still exists, including nested type/source/zone ids. */
export function pruneExpandedKeysForMatches(
  expanded: Iterable<string>,
  validMatchNodeIds: ReadonlySet<string>,
): string[] {
  const next: string[] = [];
  for (const id of expanded) {
    const matchId = matchIdFromExpandedNodeId(id);
    if (matchId && validMatchNodeIds.has(matchSalesNodeId(matchId))) {
      next.push(id);
    }
  }
  return next;
}

export function toggleExpandedKey(
  expanded: Iterable<string>,
  id: string,
): string[] {
  const set = new Set(expanded);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set];
}

export function paginateTopLevel<T>(
  items: T[],
  pageIndex: number,
  pageSize: number,
): { pageItems: T[]; pageCount: number; pageIndex: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const start = safePage * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    pageCount,
    pageIndex: safePage,
  };
}

export type MatchSalesSortId =
  | "eventLabel"
  | "date"
  | "revenue"
  | "avgPrice"
  | "ticketsSold"
  | "freeTickets"
  | "issuedTickets"
  | "loyaltyDiscountPct";

export function sortMatchSalesNodes(
  nodes: MatchSalesTreeNode[],
  sort: { id: MatchSalesSortId; desc: boolean } | null,
): MatchSalesTreeNode[] {
  if (!sort) return nodes;
  const direction = sort.desc ? -1 : 1;
  return [...nodes].sort((a, b) => {
    const cmp = compareMatchSalesNodes(a, b, sort.id);
    if (cmp !== 0) return cmp * direction;
    return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
  });
}

function compareMatchSalesNodes(
  a: MatchSalesTreeNode,
  b: MatchSalesTreeNode,
  id: MatchSalesSortId,
): number {
  switch (id) {
    case "eventLabel":
      return a.label.localeCompare(b.label, "ru");
    case "date":
      return (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
    case "revenue":
      return a.revenue - b.revenue;
    case "avgPrice":
      return a.avgPrice - b.avgPrice;
    case "ticketsSold":
      return a.ticketsSold - b.ticketsSold;
    case "freeTickets":
      return a.freeTickets - b.freeTickets;
    case "issuedTickets":
      return a.issuedTickets - b.issuedTickets;
    case "loyaltyDiscountPct":
      return a.loyaltyDiscountPct - b.loyaltyDiscountPct;
    default:
      return 0;
  }
}

export function flattenExpandedMatchSalesTree(
  nodes: MatchSalesTreeNode[],
  expanded: ReadonlySet<string>,
): MatchSalesFlatRow[] {
  const rows: MatchSalesFlatRow[] = [];

  const walk = (node: MatchSalesTreeNode, depth: number) => {
    const hasChildren = node.hasChildren || node.children.length > 0;
    rows.push({
      id: node.id,
      level: node.level,
      matchId: node.matchId,
      date: node.date,
      label: node.label,
      revenue: node.revenue,
      planRevenue: node.planRevenue,
      avgPrice: node.avgPrice,
      ticketsSold: node.ticketsSold,
      freeTickets: node.freeTickets,
      issuedTickets: node.issuedTickets,
      capacity: node.capacity,
      loyaltyDiscountPct: node.loyaltyDiscountPct,
      depth,
      hasChildren,
    });
    if (!hasChildren || !expanded.has(node.id)) return;
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };

  for (const node of nodes) walk(node, 0);
  return rows;
}

export function matchIdFromExpandedNodeId(id: string): string | null {
  if (!id.startsWith("m:")) return null;
  const rest = id.slice(2);
  const pipe = rest.indexOf("|");
  return pipe === -1 ? rest : rest.slice(0, pipe);
}

type ZoneBucket = BranchAgg;
type SourceBucket = {
  agg: BranchAgg;
  zones: Map<PriceZone, ZoneBucket>;
};
type TypeBucket = {
  agg: BranchAgg;
  sources: Map<OrderSource, SourceBucket>;
};

export type MatchAggregate = {
  agg: BranchAgg;
  types: Map<TicketType, TypeBucket>;
};

/**
 * One pass over transactions: match → ticketTypes → orderSources → priceZones.
 * Callers must not .filter() the full array per node.
 */
export function buildMatchAggregateIndex(
  transactions: Transaction[],
): Map<string, MatchAggregate> {
  const index = new Map<string, MatchAggregate>();

  for (const tx of transactions) {
    if (!tx.matchId) continue;

    let match = index.get(tx.matchId);
    if (!match) {
      match = { agg: createBranchAgg(), types: new Map() };
      index.set(tx.matchId, match);
    }
    applyBranchTransaction(match.agg, tx);

    if (!tx.ticketType) continue;
    let typeBucket = match.types.get(tx.ticketType);
    if (!typeBucket) {
      typeBucket = { agg: createBranchAgg(), sources: new Map() };
      match.types.set(tx.ticketType, typeBucket);
    }
    applyBranchTransaction(typeBucket.agg, tx);

    if (!tx.orderSource) continue;
    let sourceBucket = typeBucket.sources.get(tx.orderSource);
    if (!sourceBucket) {
      sourceBucket = { agg: createBranchAgg(), zones: new Map() };
      typeBucket.sources.set(tx.orderSource, sourceBucket);
    }
    applyBranchTransaction(sourceBucket.agg, tx);

    if (!tx.priceZone) continue;
    let zoneAgg = sourceBucket.zones.get(tx.priceZone);
    if (!zoneAgg) {
      zoneAgg = createBranchAgg();
      sourceBucket.zones.set(tx.priceZone, zoneAgg);
    }
    applyBranchTransaction(zoneAgg, tx);
  }

  return index;
}

function typeNodesFromAggregate(
  matchId: string,
  aggregate: MatchAggregate | undefined,
): MatchSalesTreeNode[] {
  if (!aggregate) return [];
  const typeNodes: MatchSalesTreeNode[] = [];

  for (const type of TICKET_TYPE_ORDER) {
    const typeBucket = aggregate.types.get(type);
    if (!typeBucket) continue;

    const sourceNodes: MatchSalesTreeNode[] = [];
    for (const source of ALL_ORDER_SOURCES) {
      const sourceBucket = typeBucket.sources.get(source);
      if (!sourceBucket) continue;

      const zoneNodes: MatchSalesTreeNode[] = [];
      for (const zone of ALL_PRICE_ZONES) {
        const zoneAgg = sourceBucket.zones.get(zone);
        if (!zoneAgg) continue;
        zoneNodes.push(
          metricsFromAgg(zoneAgg, {
            id: zoneKey(matchId, type, source, zone),
            level: "priceZone",
            matchId,
            date: null,
            label: childLabel("priceZone", PRICE_ZONE_LABELS[zone]),
            planRevenue: null,
            capacity: null,
            hasChildren: false,
            children: [],
          }),
        );
      }

      sourceNodes.push(
        metricsFromAgg(sourceBucket.agg, {
          id: sourceKey(matchId, type, source),
          level: "orderSource",
          matchId,
          date: null,
          label: childLabel("orderSource", ORDER_SOURCE_LABELS[source]),
          planRevenue: null,
          capacity: null,
          hasChildren: zoneNodes.length > 0,
          children: zoneNodes,
        }),
      );
    }

    typeNodes.push(
      metricsFromAgg(typeBucket.agg, {
        id: typeKey(matchId, type),
        level: "ticketType",
        matchId,
        date: null,
        label: childLabel("ticketType", TICKET_TYPE_LABELS[type]),
        planRevenue: null,
        capacity: null,
        hasChildren: sourceNodes.length > 0,
        children: sourceNodes,
      }),
    );
  }

  return typeNodes;
}

export type ComputeMatchSalesTreeOptions = {
  /**
   * When provided (including an empty array), never scan the global ticket set.
   * Empty array = match-level rows only, no children.
   */
  transactions?: Transaction[];
};

export function getMatchSalesTreeTransactions(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  matchIds?: Iterable<string>,
): Transaction[] {
  if (matchIds) {
    return filterTicketTransactionsForMatchIds(filters, ticketFilters, matchIds);
  }
  return filterTicketTransactions(filters, ticketFilters);
}

export function buildSalesTree(
  filteredTransactions: Transaction[],
  matchRows: MatchSalesRow[],
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): MatchSalesTreeNode[] {
  return computeMatchSalesTree(filters, ticketFilters, matchRows, {
    transactions: filteredTransactions,
  });
}

export function computeMatchSalesTree(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  matchRows: MatchSalesRow[],
  options?: ComputeMatchSalesTreeOptions,
): MatchSalesTreeNode[] {
  const providedTransactions = options != null && "transactions" in options;
  const providedTxs = providedTransactions
    ? (options.transactions ?? [])
    : undefined;

  const globalTxs =
    providedTxs != null
      ? providedTxs
      : filterTicketTransactions(filters, ticketFilters);

  const index =
    globalTxs.length === 0
      ? new Map<string, MatchAggregate>()
      : buildMatchAggregateIndex(globalTxs);

  const childrenReady = index.size > 0;
  const nodes: MatchSalesTreeNode[] = [];

  for (const row of matchRows) {
    if (
      isEmptyTicketSalesAgg(
        {
          revenue: row.revenue,
          loyaltyDiscount: 0,
          ticketsSold: row.ticketsSold,
          freeTickets: row.freeTickets,
        },
        row.issuedTickets,
      )
    ) {
      continue;
    }

    const aggregate = index.get(row.matchId);
    const typeNodes = typeNodesFromAggregate(row.matchId, aggregate);
    const hasChildren = childrenReady
      ? typeNodes.length > 0
      : row.ticketsSold > 0 || row.issuedTickets > 0;

    nodes.push({
      id: matchSalesNodeId(row.matchId),
      level: "match",
      matchId: row.matchId,
      date: row.date,
      label: row.eventLabel,
      revenue: row.revenue,
      planRevenue: row.planRevenue,
      avgPrice: row.avgPrice,
      ticketsSold: row.ticketsSold,
      freeTickets: row.freeTickets,
      issuedTickets: row.issuedTickets,
      capacity: row.capacity,
      loyaltyDiscountPct: row.loyaltyDiscountPct,
      hasChildren,
      children: typeNodes,
    });
  }

  return nodes.sort(
    (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
  );
}

export function getMatchSalesBarMaxima(nodes: MatchSalesTreeNode[]): {
  revenue: number;
  avgPrice: number;
  ticketsSold: number;
  issuedTickets: number;
  loyaltyDiscountPct: number;
} {
  let revenue = 0;
  let avgPrice = 0;
  let ticketsSold = 0;
  let issuedTickets = 0;
  let loyaltyDiscountPct = 0;

  for (const node of nodes) {
    revenue = Math.max(revenue, node.revenue, node.planRevenue ?? 0);
    avgPrice = Math.max(avgPrice, node.avgPrice);
    ticketsSold = Math.max(ticketsSold, node.ticketsSold);
    issuedTickets = Math.max(issuedTickets, node.issuedTickets);
    loyaltyDiscountPct = Math.max(loyaltyDiscountPct, node.loyaltyDiscountPct);
  }

  return {
    revenue,
    avgPrice,
    ticketsSold,
    issuedTickets,
    loyaltyDiscountPct,
  };
}

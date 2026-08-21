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
import { getSectorCapacity } from "@/lib/arena-sector-inventory";
import {
  ALL_ORDER_SOURCES,
  ALL_PRICE_ZONES,
  allowedSectorsForPriceZone,
  isAllowedSectorPriceZone,
  ORDER_SOURCE_LABELS,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-filter-options";
import {
  issuedOccupancyPercent,
  MHL_ARENA_CAPACITY,
  SECONDARY_ARENA_CAPACITY,
} from "@/lib/ticket-plan";
import type {
  DashboardFilters,
  Match,
  MatchSalesRow,
  OrderSource,
  PriceZone,
  Sector,
  TicketFilters,
  TicketType,
  Transaction,
} from "@/types/dashboard";

export type MatchSalesSectionKind = "ticketType" | "orderSource" | "priceZone";

export type MatchSalesTreeLevel =
  | "match"
  | "section"
  | "ticketType"
  | "orderSource"
  | "priceZone"
  | "sector";

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
  occupancyIssuedTickets: number;
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

const SECTION_ORDER: MatchSalesSectionKind[] = [
  "ticketType",
  "orderSource",
  "priceZone",
];

export const MATCH_SALES_SECTION_LABELS: Record<MatchSalesSectionKind, string> =
  {
    ticketType: "Тип билета",
    orderSource: "Источник заказа",
    priceZone: "Ценовая зона",
  };

/** Revenue / plan as a percent, or null when there is no plan base. */
export function matchSalesPlanFulfillmentPct(
  revenue: number,
  planRevenue: number | null | undefined,
): number | null {
  if (planRevenue == null || planRevenue <= 0) return null;
  return (revenue / planRevenue) * 100;
}

/**
 * «Оформлено» occupancy for the green bar.
 * Match / section / zone groups: (arena+parking issued) / occupancy mass.
 * Sector leaves: this row's issued / that sector's seat capacity (no parking,
 * not a share of match-level issued).
 */
export function matchSalesIssuedOccupancyPercent(
  row: Pick<
    MatchSalesTreeNode,
    "level" | "issuedTickets" | "occupancyIssuedTickets" | "capacity"
  >,
): number | null {
  if (row.capacity == null || !(row.capacity > 0)) return null;
  if (row.level === "sector") {
    return Math.min(100, (row.issuedTickets / row.capacity) * 100);
  }
  return issuedOccupancyPercent(row.occupancyIssuedTickets, row.capacity);
}

function inventoryMatchFromCapacity(
  capacity: number,
): Pick<Match, "arena" | "league" | "capacity"> | null {
  if (!(capacity > 0)) return null;
  if (capacity === SECONDARY_ARENA_CAPACITY) {
    return { arena: "secondary", league: "VHL", capacity };
  }
  if (capacity === MHL_ARENA_CAPACITY) {
    return { arena: "main", league: "MHL", capacity };
  }
  return { arena: "main", league: "KHL", capacity };
}

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
    occupancyIssuedTickets?: number;
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
    occupancyIssuedTickets: extras.occupancyIssuedTickets ?? 0,
    loyaltyDiscountPct: ticketSalesLoyaltyDiscountPct(agg),
  };
}

function typeKey(matchId: string, type: TicketType): string {
  return `m:${matchId}|t:${type}`;
}

function sourceKey(matchId: string, source: OrderSource): string {
  return `m:${matchId}|s:${source}`;
}

function zoneKey(matchId: string, zone: PriceZone): string {
  return `m:${matchId}|z:${zone}`;
}

function sectorKey(matchId: string, zone: PriceZone, sector: Sector): string {
  return `m:${matchId}|z:${zone}|sec:${sector}`;
}

export function matchSalesNodeId(matchId: string): string {
  return `m:${matchId}`;
}

export function matchSalesSectionId(
  matchId: string,
  section: MatchSalesSectionKind,
): string {
  return `m:${matchId}|sec:${section}`;
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

/** Keep expand keys whose match still exists, including nested type/source/zone/sector ids. */
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
  | "planFulfillment"
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
    case "planFulfillment": {
      const aPct = matchSalesPlanFulfillmentPct(a.revenue, a.planRevenue);
      const bPct = matchSalesPlanFulfillmentPct(b.revenue, b.planRevenue);
      return (aPct ?? Number.NEGATIVE_INFINITY) - (bPct ?? Number.NEGATIVE_INFINITY);
    }
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
      occupancyIssuedTickets: node.occupancyIssuedTickets,
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

export type MatchAggregate = {
  agg: BranchAgg;
  types: Map<TicketType, BranchAgg>;
  sources: Map<OrderSource, BranchAgg>;
  zones: Map<PriceZone, BranchAgg>;
  zoneSectors: Map<PriceZone, Map<Sector, BranchAgg>>;
};

function applyDimensionTransaction<K>(
  buckets: Map<K, BranchAgg>,
  key: K | undefined | null,
  tx: Transaction,
): void {
  if (key == null) return;
  let agg = buckets.get(key);
  if (!agg) {
    agg = createBranchAgg();
    buckets.set(key, agg);
  }
  applyBranchTransaction(agg, tx);
}

function applyZoneSectorTransaction(
  zoneSectors: Map<PriceZone, Map<Sector, BranchAgg>>,
  tx: Transaction,
): void {
  if (tx.ticketType === "parking") return;
  const zone = tx.priceZone;
  const sector = tx.sector;
  if (!zone || !sector) return;
  if (!isAllowedSectorPriceZone(sector, zone)) return;
  let bySector = zoneSectors.get(zone);
  if (!bySector) {
    bySector = new Map();
    zoneSectors.set(zone, bySector);
  }
  applyDimensionTransaction(bySector, sector, tx);
}

/**
 * One pass over transactions: three parallel cuts of a match
 * (ticket type, order source, price zone) plus sector children under
 * each seating price zone. Callers must not .filter() the full array
 * per node.
 */
export function buildMatchAggregateIndex(
  transactions: Transaction[],
): Map<string, MatchAggregate> {
  const index = new Map<string, MatchAggregate>();

  for (const tx of transactions) {
    if (!tx.matchId) continue;

    let match = index.get(tx.matchId);
    if (!match) {
      match = {
        agg: createBranchAgg(),
        types: new Map(),
        sources: new Map(),
        zones: new Map(),
        zoneSectors: new Map(),
      };
      index.set(tx.matchId, match);
    }
    applyBranchTransaction(match.agg, tx);
    applyDimensionTransaction(match.types, tx.ticketType, tx);
    applyDimensionTransaction(match.sources, tx.orderSource, tx);
    applyDimensionTransaction(match.zones, tx.priceZone, tx);
    applyZoneSectorTransaction(match.zoneSectors, tx);
  }

  return index;
}

function leafNodesFromBuckets<K extends string>(
  matchId: string,
  level: Exclude<MatchSalesTreeLevel, "match" | "section">,
  order: readonly K[],
  buckets: Map<K, BranchAgg>,
  labels: Record<K, string>,
  idFor: (matchId: string, key: K) => string,
): MatchSalesTreeNode[] {
  const nodes: MatchSalesTreeNode[] = [];
  for (const key of order) {
    const agg = buckets.get(key);
    if (!agg) continue;
    nodes.push(
      metricsFromAgg(agg, {
        id: idFor(matchId, key),
        level,
        matchId,
        date: null,
        label: labels[key],
        planRevenue: null,
        capacity: null,
        hasChildren: false,
        children: [],
      }),
    );
  }
  return nodes;
}

function sectorNodesFromBuckets(
  matchId: string,
  zone: PriceZone,
  buckets: Map<Sector, BranchAgg> | undefined,
  inventoryMatch: Pick<Match, "arena" | "league" | "capacity"> | null,
): MatchSalesTreeNode[] {
  if (!buckets || buckets.size === 0) return [];
  const nodes: MatchSalesTreeNode[] = [];
  for (const sector of allowedSectorsForPriceZone(zone)) {
    const agg = buckets.get(sector);
    if (!agg || isEmptyTicketSalesAgg(agg, agg.issuedTickets)) continue;
    const sectorCapacity = inventoryMatch
      ? getSectorCapacity(inventoryMatch, sector)
      : 0;
    nodes.push(
      metricsFromAgg(agg, {
        id: sectorKey(matchId, zone, sector),
        level: "sector",
        matchId,
        date: null,
        label: sector,
        planRevenue: null,
        occupancyIssuedTickets: agg.issuedTickets,
        capacity: sectorCapacity > 0 ? sectorCapacity : null,
        hasChildren: false,
        children: [],
      }),
    );
  }
  return nodes;
}

function priceZoneNodesFromAggregate(
  matchId: string,
  zones: Map<PriceZone, BranchAgg>,
  zoneSectors: Map<PriceZone, Map<Sector, BranchAgg>>,
  inventoryMatch: Pick<Match, "arena" | "league" | "capacity"> | null,
): MatchSalesTreeNode[] {
  const nodes: MatchSalesTreeNode[] = [];
  for (const zone of ALL_PRICE_ZONES) {
    const agg = zones.get(zone);
    if (!agg) continue;
    const children = sectorNodesFromBuckets(
      matchId,
      zone,
      zoneSectors.get(zone),
      inventoryMatch,
    );
    nodes.push(
      metricsFromAgg(agg, {
        id: zoneKey(matchId, zone),
        level: "priceZone",
        matchId,
        date: null,
        label: PRICE_ZONE_LABELS[zone],
        planRevenue: null,
        capacity: null,
        hasChildren: children.length > 0,
        children,
      }),
    );
  }
  return nodes;
}

function sectionNodeFromMatchRow(
  row: MatchSalesRow,
  section: MatchSalesSectionKind,
  children: MatchSalesTreeNode[],
): MatchSalesTreeNode {
  return {
    id: matchSalesSectionId(row.matchId, section),
    level: "section",
    matchId: row.matchId,
    date: null,
    label: MATCH_SALES_SECTION_LABELS[section],
    revenue: row.revenue,
    planRevenue: row.planRevenue,
    avgPrice: row.avgPrice,
    ticketsSold: row.ticketsSold,
    freeTickets: row.freeTickets,
    issuedTickets: row.issuedTickets,
    occupancyIssuedTickets: row.occupancyIssuedTickets,
    capacity: row.capacity,
    loyaltyDiscountPct: row.loyaltyDiscountPct,
    hasChildren: children.length > 0,
    children,
  };
}

function sectionNodesFromAggregate(
  row: MatchSalesRow,
  aggregate: MatchAggregate | undefined,
): MatchSalesTreeNode[] {
  if (!aggregate) return [];

  const childrenBySection: Record<MatchSalesSectionKind, MatchSalesTreeNode[]> =
    {
      ticketType: leafNodesFromBuckets(
        row.matchId,
        "ticketType",
        TICKET_TYPE_ORDER,
        aggregate.types,
        TICKET_TYPE_LABELS,
        typeKey,
      ),
      orderSource: leafNodesFromBuckets(
        row.matchId,
        "orderSource",
        ALL_ORDER_SOURCES,
        aggregate.sources,
        ORDER_SOURCE_LABELS,
        sourceKey,
      ),
      priceZone: priceZoneNodesFromAggregate(
        row.matchId,
        aggregate.zones,
        aggregate.zoneSectors,
        inventoryMatchFromCapacity(row.capacity),
      ),
    };

  const sections: MatchSalesTreeNode[] = [];
  for (const kind of SECTION_ORDER) {
    const children = childrenBySection[kind];
    if (children.length === 0) continue;
    sections.push(sectionNodeFromMatchRow(row, kind, children));
  }
  return sections;
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
    const sectionNodes = sectionNodesFromAggregate(row, aggregate);
    const hasChildren = childrenReady
      ? sectionNodes.length > 0
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
      occupancyIssuedTickets: row.occupancyIssuedTickets,
      capacity: row.capacity,
      loyaltyDiscountPct: row.loyaltyDiscountPct,
      hasChildren,
      children: sectionNodes,
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

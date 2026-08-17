import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  filterMatchesByTicketFilters,
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
  ALL_SECTORS,
  ORDER_SOURCE_LABELS,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-filter-options";
import type {
  DashboardFilters,
  MatchSalesRow,
  OrderSource,
  PriceZone,
  Sector,
  TicketFilters,
  TicketType,
  Transaction,
} from "@/types/dashboard";

export type MatchSalesTreeLevel =
  | "match"
  | "ticketType"
  | "orderSource"
  | "priceZone";

export type MatchSalesLocalFilters = {
  matchId: string[];
  ticketType: TicketType[];
  orderSource: OrderSource[];
  sector: Sector[];
  priceZone: PriceZone[];
};

export const EMPTY_MATCH_SALES_LOCAL_FILTERS: MatchSalesLocalFilters = {
  matchId: [],
  ticketType: [],
  orderSource: [],
  sector: [],
  priceZone: [],
};

export type MatchSalesFilterOption = {
  value: string;
  label: string;
};

export type MatchSalesLocalFilterOptions = {
  matches: MatchSalesFilterOption[];
  ticketTypes: MatchSalesFilterOption[];
  orderSources: MatchSalesFilterOption[];
  sectors: MatchSalesFilterOption[];
  priceZones: MatchSalesFilterOption[];
};

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

export function isMatchSalesLocalFiltersEmpty(
  filters: MatchSalesLocalFilters,
): boolean {
  return (
    filters.matchId.length === 0 &&
    filters.ticketType.length === 0 &&
    filters.orderSource.length === 0 &&
    filters.sector.length === 0 &&
    filters.priceZone.length === 0
  );
}

export function hasMatchSalesBranchFilters(
  filters: MatchSalesLocalFilters,
): boolean {
  return (
    filters.ticketType.length > 0 ||
    filters.orderSource.length > 0 ||
    filters.sector.length > 0 ||
    filters.priceZone.length > 0
  );
}

export function countActiveMatchSalesLocalFilters(
  filters: MatchSalesLocalFilters,
): number {
  let count = 0;
  if (filters.matchId.length > 0) count += 1;
  if (filters.ticketType.length > 0) count += 1;
  if (filters.orderSource.length > 0) count += 1;
  if (filters.sector.length > 0) count += 1;
  if (filters.priceZone.length > 0) count += 1;
  return count;
}

export function localFilterArraysEqual(
  a: MatchSalesLocalFilters,
  b: MatchSalesLocalFilters,
): boolean {
  return (
    arraysEqual(a.matchId, b.matchId) &&
    arraysEqual(a.ticketType, b.ticketType) &&
    arraysEqual(a.orderSource, b.orderSource) &&
    arraysEqual(a.sector, b.sector) &&
    arraysEqual(a.priceZone, b.priceZone)
  );
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function transactionPassesLocalFilters(
  tx: Transaction,
  filters: MatchSalesLocalFilters,
): boolean {
  if (
    filters.matchId.length > 0 &&
    (!tx.matchId || !filters.matchId.includes(tx.matchId))
  ) {
    return false;
  }
  if (
    filters.ticketType.length > 0 &&
    (!tx.ticketType || !filters.ticketType.includes(tx.ticketType))
  ) {
    return false;
  }
  if (
    filters.orderSource.length > 0 &&
    (!tx.orderSource || !filters.orderSource.includes(tx.orderSource))
  ) {
    return false;
  }
  if (
    filters.sector.length > 0 &&
    (!tx.sector || !filters.sector.includes(tx.sector))
  ) {
    return false;
  }
  if (
    filters.priceZone.length > 0 &&
    (!tx.priceZone || !filters.priceZone.includes(tx.priceZone))
  ) {
    return false;
  }
  return true;
}

function passesExcept(
  tx: Transaction,
  filters: MatchSalesLocalFilters,
  except: keyof MatchSalesLocalFilters,
): boolean {
  return transactionPassesLocalFilters(tx, { ...filters, [except]: [] });
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

export function getMatchSalesLocalFilterOptions(
  txs: Transaction[],
  matchRows: MatchSalesRow[],
  filters: MatchSalesLocalFilters,
): MatchSalesLocalFilterOptions {
  if (isMatchSalesLocalFiltersEmpty(filters)) {
    return {
      matches: matchRows
        .slice()
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((row) => ({
          value: row.matchId,
          label: `${row.eventLabel}`,
        })),
      ticketTypes: TICKET_TYPE_ORDER.map((type) => ({
        value: type,
        label: TICKET_TYPE_LABELS[type],
      })),
      orderSources: ALL_ORDER_SOURCES.map((source) => ({
        value: source,
        label: ORDER_SOURCE_LABELS[source],
      })),
      sectors: ALL_SECTORS.map((sector) => ({
        value: sector,
        label: sector,
      })),
      priceZones: ALL_PRICE_ZONES.map((zone) => ({
        value: zone,
        label: PRICE_ZONE_LABELS[zone],
      })),
    };
  }

  const matchById = new Map(matchRows.map((row) => [row.matchId, row]));

  const matchIds = new Set<string>();
  const ticketTypes = new Set<TicketType>();
  const orderSources = new Set<OrderSource>();
  const sectors = new Set<Sector>();
  const priceZones = new Set<PriceZone>();

  for (const tx of txs) {
    if (!tx.matchId || !matchById.has(tx.matchId)) continue;
    if (passesExcept(tx, filters, "matchId")) matchIds.add(tx.matchId);
    if (tx.ticketType && passesExcept(tx, filters, "ticketType")) {
      ticketTypes.add(tx.ticketType);
    }
    if (tx.orderSource && passesExcept(tx, filters, "orderSource")) {
      orderSources.add(tx.orderSource);
    }
    if (tx.sector && passesExcept(tx, filters, "sector")) {
      sectors.add(tx.sector);
    }
    if (tx.priceZone && passesExcept(tx, filters, "priceZone")) {
      priceZones.add(tx.priceZone);
    }
  }

  const matches = matchRows
    .filter((row) => matchIds.has(row.matchId))
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((row) => ({
      value: row.matchId,
      label: `${row.eventLabel}`,
    }));

  return {
    matches,
    ticketTypes: TICKET_TYPE_ORDER.filter((type) => ticketTypes.has(type)).map(
      (type) => ({ value: type, label: TICKET_TYPE_LABELS[type] }),
    ),
    orderSources: ALL_ORDER_SOURCES.filter((source) =>
      orderSources.has(source),
    ).map((source) => ({
      value: source,
      label: ORDER_SOURCE_LABELS[source],
    })),
    sectors: ALL_SECTORS.filter((sector) => sectors.has(sector)).map(
      (sector) => ({ value: sector, label: sector }),
    ),
    priceZones: ALL_PRICE_ZONES.filter((zone) => priceZones.has(zone)).map(
      (zone) => ({ value: zone, label: PRICE_ZONE_LABELS[zone] }),
    ),
  };
}

export function sanitizeMatchSalesLocalFilters(
  filters: MatchSalesLocalFilters,
  options: MatchSalesLocalFilterOptions,
): MatchSalesLocalFilters {
  const matchValues = new Set(options.matches.map((opt) => opt.value));
  const typeValues = new Set(options.ticketTypes.map((opt) => opt.value));
  const sourceValues = new Set(options.orderSources.map((opt) => opt.value));
  const sectorValues = new Set(options.sectors.map((opt) => opt.value));
  const zoneValues = new Set(options.priceZones.map((opt) => opt.value));

  return {
    matchId: filters.matchId.filter((id) => matchValues.has(id)),
    ticketType: filters.ticketType.filter((type) => typeValues.has(type)),
    orderSource: filters.orderSource.filter((source) =>
      sourceValues.has(source),
    ),
    sector: filters.sector.filter((sector) => sectorValues.has(sector)),
    priceZone: filters.priceZone.filter((zone) => zoneValues.has(zone)),
  };
}

export type MatchSalesLocalFilterChip = {
  key: string;
  dimension: keyof MatchSalesLocalFilters;
  value: string;
  label: string;
};

export function getMatchSalesLocalFilterChips(
  filters: MatchSalesLocalFilters,
  options: MatchSalesLocalFilterOptions,
): MatchSalesLocalFilterChip[] {
  const chips: MatchSalesLocalFilterChip[] = [];
  const push = (
    dimension: keyof MatchSalesLocalFilters,
    value: string,
    optionList: MatchSalesFilterOption[],
  ) => {
    const label =
      optionList.find((opt) => opt.value === value)?.label ?? value;
    chips.push({
      key: `${dimension}:${value}`,
      dimension,
      value,
      label,
    });
  };

  for (const value of filters.matchId) {
    push("matchId", value, options.matches);
  }
  for (const value of filters.ticketType) {
    push("ticketType", value, options.ticketTypes);
  }
  for (const value of filters.orderSource) {
    push("orderSource", value, options.orderSources);
  }
  for (const value of filters.sector) {
    push("sector", value, options.sectors);
  }
  for (const value of filters.priceZone) {
    push("priceZone", value, options.priceZones);
  }
  return chips;
}

export function removeMatchSalesLocalFilterValue(
  filters: MatchSalesLocalFilters,
  dimension: keyof MatchSalesLocalFilters,
  value: string,
): MatchSalesLocalFilters {
  return {
    ...filters,
    [dimension]: filters[dimension].filter((item) => item !== value),
  };
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
  localFilters: MatchSalesLocalFilters = EMPTY_MATCH_SALES_LOCAL_FILTERS,
): Map<string, MatchAggregate> {
  const index = new Map<string, MatchAggregate>();
  const applyLocal = !isMatchSalesLocalFiltersEmpty(localFilters);

  for (const tx of transactions) {
    if (!tx.matchId) continue;
    if (applyLocal && !transactionPassesLocalFilters(tx, localFilters)) continue;

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
  localFilters: MatchSalesLocalFilters,
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): MatchSalesTreeNode[] {
  return computeMatchSalesTree(filters, ticketFilters, localFilters, matchRows, {
    transactions: filteredTransactions,
  });
}

export function computeMatchSalesTree(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
  localFilters: MatchSalesLocalFilters,
  matchRows: MatchSalesRow[],
  options?: ComputeMatchSalesTreeOptions,
): MatchSalesTreeNode[] {
  const branchFilters = hasMatchSalesBranchFilters(localFilters);
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
      : buildMatchAggregateIndex(globalTxs, localFilters);

  const matchById = new Map(matchRows.map((row) => [row.matchId, row]));
  const allowedMatches = filterMatchesByTicketFilters(ticketFilters);
  const matchMeta = new Map(allowedMatches.map((match) => [match.id, match]));
  const useRowMetrics = !branchFilters;
  const childrenReady = index.size > 0;

  const nodes: MatchSalesTreeNode[] = [];
  const matchIds = localFilters.matchId.length
    ? localFilters.matchId
    : matchRows.map((row) => row.matchId);

  const seen = new Set<string>();
  for (const matchId of matchIds) {
    if (seen.has(matchId)) continue;
    seen.add(matchId);

    const row = matchById.get(matchId);
    const aggregate = index.get(matchId);
    const agg = aggregate?.agg ?? createBranchAgg();
    const issuedForEmptyCheck = useRowMetrics
      ? (row?.issuedTickets ?? agg.issuedTickets)
      : agg.issuedTickets;

    if (useRowMetrics && row) {
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
    } else if (isEmptyTicketSalesAgg(agg, issuedForEmptyCheck)) {
      continue;
    }

    const match = matchMeta.get(matchId);
    const eventLabel =
      row?.eventLabel ??
      (match
        ? `${match.opponent} ${format(match.date, "dd-MM-yy", { locale: ru })}`
        : matchId);
    const date = row?.date ?? match?.date ?? null;
    const planRevenue = row?.planRevenue ?? null;
    const capacity = row?.capacity ?? match?.capacity ?? null;
    const typeNodes = typeNodesFromAggregate(matchId, aggregate);
    const hasChildren = childrenReady
      ? typeNodes.length > 0
      : Boolean(row && (row.ticketsSold > 0 || row.issuedTickets > 0));

    if (useRowMetrics && row) {
      nodes.push({
        id: matchSalesNodeId(matchId),
        level: "match",
        matchId,
        date,
        label: eventLabel,
        revenue: row.revenue,
        planRevenue,
        avgPrice: row.avgPrice,
        ticketsSold: row.ticketsSold,
        freeTickets: row.freeTickets,
        issuedTickets: row.issuedTickets,
        capacity,
        loyaltyDiscountPct: row.loyaltyDiscountPct,
        hasChildren,
        children: typeNodes,
      });
    } else {
      nodes.push(
        metricsFromAgg(agg, {
          id: matchSalesNodeId(matchId),
          level: "match",
          matchId,
          date,
          label: eventLabel,
          planRevenue,
          capacity,
          hasChildren,
          children: typeNodes,
        }),
      );
    }
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

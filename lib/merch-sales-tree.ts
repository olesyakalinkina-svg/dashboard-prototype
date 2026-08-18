import { filterMerchTransactions } from "@/lib/filters";
import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  getMerchProductCategory,
  isMerchMatchTablePoint,
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
} from "@/lib/merch-filter-options";
import { paginateTopLevel, toggleExpandedKey } from "@/lib/match-sales-tree";
import type {
  DashboardFilters,
  MerchFilters,
  MerchMatchSalesRow,
  MerchProductCategory,
  MerchSalesPoint,
  Transaction,
} from "@/types/dashboard";

export { paginateTopLevel, toggleExpandedKey };

export type MerchSalesSectionKind = "salesChannel" | "productCategory";

export type MerchSalesTreeLevel =
  | "match"
  | "section"
  | "salesChannel"
  | "productCategory";

export type MerchSalesMetrics = {
  revenue: number;
  avgCheck: number;
  receipts: number;
  units: number;
  upt: number;
  attendance: number;
  purchaseConversionPct: number;
  sharePct: number | null;
};

export type MerchSalesTreeNode = MerchSalesMetrics & {
  id: string;
  level: MerchSalesTreeLevel;
  matchId: string;
  date: Date | null;
  label: string;
  hasChildren: boolean;
  children: MerchSalesTreeNode[];
};

export type MerchSalesFlatRow = Omit<MerchSalesTreeNode, "children"> & {
  depth: number;
  hasChildren: boolean;
};

type BranchAgg = {
  revenue: number;
  receipts: number;
  units: number;
};

const SECTION_ORDER: MerchSalesSectionKind[] = [
  "salesChannel",
  "productCategory",
];

export const MERCH_SALES_SECTION_LABELS: Record<MerchSalesSectionKind, string> =
  {
    salesChannel: "Канал продаж",
    productCategory: "Категория товара",
  };

function createBranchAgg(): BranchAgg {
  return { revenue: 0, receipts: 0, units: 0 };
}

function applyMerchBranchTransaction(agg: BranchAgg, tx: Transaction): void {
  if (tx.isReturn) {
    agg.revenue -= tx.amount;
    agg.units -= tx.quantity;
    agg.receipts = Math.max(0, agg.receipts - 1);
    return;
  }
  agg.revenue += tx.amount;
  agg.units += tx.quantity;
  agg.receipts += 1;
}

function avgCheckFrom(agg: BranchAgg): number {
  return agg.receipts > 0 ? agg.revenue / agg.receipts : 0;
}

function uptFrom(agg: BranchAgg): number {
  return agg.receipts > 0 ? agg.units / agg.receipts : 0;
}

function sharePct(revenue: number, matchRevenue: number): number | null {
  if (matchRevenue <= 0) return null;
  return (revenue / matchRevenue) * 100;
}

export function merchSalesNodeId(matchId: string): string {
  return `mm:${matchId}`;
}

export function merchSalesSectionId(
  matchId: string,
  section: MerchSalesSectionKind,
): string {
  return `mm:${matchId}|sec:${section}`;
}

function channelKey(matchId: string, channel: MerchSalesPoint): string {
  return `mm:${matchId}|ch:${channel}`;
}

function categoryKey(matchId: string, category: MerchProductCategory): string {
  return `mm:${matchId}|cat:${category}`;
}

export function getMerchSalesExpandScopeKey(
  merchFilters: Pick<MerchFilters, "season" | "matchId">,
): string {
  return `${merchFilters.season}|${merchFilters.matchId.slice().sort().join(",")}`;
}

export function matchIdFromMerchExpandedNodeId(id: string): string | null {
  if (!id.startsWith("mm:")) return null;
  const rest = id.slice(3);
  const pipe = rest.indexOf("|");
  return pipe === -1 ? rest : rest.slice(0, pipe);
}

export function pruneMerchExpandedKeysForMatches(
  expanded: Iterable<string>,
  validMatchNodeIds: ReadonlySet<string>,
): string[] {
  const next: string[] = [];
  for (const id of expanded) {
    const matchId = matchIdFromMerchExpandedNodeId(id);
    if (matchId && validMatchNodeIds.has(merchSalesNodeId(matchId))) {
      next.push(id);
    }
  }
  return next;
}

export type MerchSalesSortId =
  | "eventLabel"
  | "date"
  | "revenue"
  | "avgCheck"
  | "receipts"
  | "units"
  | "upt"
  | "purchaseConversionPct";

export function sortMerchSalesNodes(
  nodes: MerchSalesTreeNode[],
  sort: { id: MerchSalesSortId; desc: boolean } | null,
): MerchSalesTreeNode[] {
  if (!sort) return nodes;
  const direction = sort.desc ? -1 : 1;
  return [...nodes].sort((a, b) => {
    const cmp = compareMerchSalesNodes(a, b, sort.id);
    if (cmp !== 0) return cmp * direction;
    return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
  });
}

function compareMerchSalesNodes(
  a: MerchSalesTreeNode,
  b: MerchSalesTreeNode,
  id: MerchSalesSortId,
): number {
  switch (id) {
    case "eventLabel":
      return a.label.localeCompare(b.label, "ru");
    case "date":
      return (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
    case "revenue":
      return a.revenue - b.revenue;
    case "avgCheck":
      return a.avgCheck - b.avgCheck;
    case "receipts":
      return a.receipts - b.receipts;
    case "units":
      return a.units - b.units;
    case "upt":
      return a.upt - b.upt;
    case "purchaseConversionPct":
      return a.purchaseConversionPct - b.purchaseConversionPct;
    default:
      return 0;
  }
}

export function flattenExpandedMerchSalesTree(
  nodes: MerchSalesTreeNode[],
  expanded: ReadonlySet<string>,
): MerchSalesFlatRow[] {
  const rows: MerchSalesFlatRow[] = [];

  const walk = (node: MerchSalesTreeNode, depth: number) => {
    const hasChildren = node.hasChildren || node.children.length > 0;
    rows.push({
      id: node.id,
      level: node.level,
      matchId: node.matchId,
      date: node.date,
      label: node.label,
      revenue: node.revenue,
      avgCheck: node.avgCheck,
      receipts: node.receipts,
      units: node.units,
      upt: node.upt,
      attendance: node.attendance,
      purchaseConversionPct: node.purchaseConversionPct,
      sharePct: node.sharePct,
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

export type MerchMatchAggregate = {
  agg: BranchAgg;
  channels: Map<MerchSalesPoint, BranchAgg>;
  categories: Map<MerchProductCategory, BranchAgg>;
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
  applyMerchBranchTransaction(agg, tx);
}

export function buildMerchMatchAggregateIndex(
  transactions: Transaction[],
): Map<string, MerchMatchAggregate> {
  const index = new Map<string, MerchMatchAggregate>();

  for (const tx of transactions) {
    if (!tx.matchId) continue;
    if (!isMerchMatchTablePoint(tx.merchSalesPoint)) continue;

    let match = index.get(tx.matchId);
    if (!match) {
      match = {
        agg: createBranchAgg(),
        channels: new Map(),
        categories: new Map(),
      };
      index.set(tx.matchId, match);
    }
    applyMerchBranchTransaction(match.agg, tx);
    applyDimensionTransaction(match.channels, tx.merchSalesPoint, tx);
    applyDimensionTransaction(
      match.categories,
      getMerchProductCategory(tx),
      tx,
    );
  }

  return index;
}

function metricsFromAgg(
  agg: BranchAgg,
  extras: {
    id: string;
    level: MerchSalesTreeLevel;
    matchId: string;
    date: Date | null;
    label: string;
    attendance: number;
    purchaseConversionPct: number;
    sharePct: number | null;
    hasChildren: boolean;
    children: MerchSalesTreeNode[];
  },
): MerchSalesTreeNode {
  return {
    ...extras,
    revenue: agg.revenue,
    avgCheck: avgCheckFrom(agg),
    receipts: agg.receipts,
    units: agg.units,
    upt: uptFrom(agg),
  };
}

function leafNodesFromBuckets<K extends string>(
  matchId: string,
  level: Exclude<MerchSalesTreeLevel, "match" | "section">,
  order: readonly K[],
  buckets: Map<K, BranchAgg>,
  labels: Record<K, string>,
  idFor: (matchId: string, key: K) => string,
  matchRevenue: number,
): MerchSalesTreeNode[] {
  const nodes: MerchSalesTreeNode[] = [];
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
        attendance: 0,
        purchaseConversionPct: 0,
        sharePct: sharePct(agg.revenue, matchRevenue),
        hasChildren: false,
        children: [],
      }),
    );
  }
  return nodes;
}

function sectionNodeFromMatchRow(
  row: MerchMatchSalesRow,
  section: MerchSalesSectionKind,
  children: MerchSalesTreeNode[],
): MerchSalesTreeNode {
  return {
    id: merchSalesSectionId(row.matchId, section),
    level: "section",
    matchId: row.matchId,
    date: null,
    label: MERCH_SALES_SECTION_LABELS[section],
    revenue: row.revenue,
    avgCheck: row.avgCheck,
    receipts: row.receipts,
    units: row.units,
    upt: row.upt,
    attendance: row.attendance,
    purchaseConversionPct: row.purchaseConversionPct,
    sharePct: null,
    hasChildren: children.length > 0,
    children,
  };
}

function sectionNodesFromAggregate(
  row: MerchMatchSalesRow,
  aggregate: MerchMatchAggregate | undefined,
): MerchSalesTreeNode[] {
  if (!aggregate) return [];

  const childrenBySection: Record<MerchSalesSectionKind, MerchSalesTreeNode[]> =
    {
      salesChannel: leafNodesFromBuckets(
        row.matchId,
        "salesChannel",
        ALL_MERCH_SALES_POINTS.filter((point) => isMerchMatchTablePoint(point)),
        aggregate.channels,
        MERCH_SALES_POINT_LABELS,
        channelKey,
        row.revenue,
      ),
      productCategory: leafNodesFromBuckets(
        row.matchId,
        "productCategory",
        ALL_MERCH_PRODUCT_CATEGORIES,
        aggregate.categories,
        MERCH_PRODUCT_CATEGORY_LABELS,
        categoryKey,
        row.revenue,
      ),
    };

  const sections: MerchSalesTreeNode[] = [];
  for (const kind of SECTION_ORDER) {
    const children = childrenBySection[kind];
    if (children.length === 0) continue;
    sections.push(sectionNodeFromMatchRow(row, kind, children));
  }
  return sections;
}

export type ComputeMerchSalesTreeOptions = {
  transactions?: Transaction[];
};

export function getMerchSalesTreeTransactions(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  matchIds?: Iterable<string>,
): Transaction[] {
  const txs = filterMerchTransactions(filters, merchFilters, {
    useSeasonRange: true,
  });
  const allowed = matchIds ? new Set(matchIds) : null;
  const result: Transaction[] = [];
  for (const tx of txs) {
    if (!tx.matchId) continue;
    if (allowed && !allowed.has(tx.matchId)) continue;
    if (!isMerchMatchTablePoint(tx.merchSalesPoint)) continue;
    result.push(tx);
  }
  return result;
}

export function computeMerchSalesTree(
  filters: DashboardFilters,
  merchFilters: MerchFilters,
  matchRows: MerchMatchSalesRow[],
  options?: ComputeMerchSalesTreeOptions,
): MerchSalesTreeNode[] {
  const providedTransactions = options != null && "transactions" in options;
  const providedTxs = providedTransactions
    ? (options.transactions ?? [])
    : undefined;

  const globalTxs =
    providedTxs != null
      ? providedTxs
      : getMerchSalesTreeTransactions(filters, merchFilters);

  const index =
    globalTxs.length === 0
      ? new Map<string, MerchMatchAggregate>()
      : buildMerchMatchAggregateIndex(globalTxs);

  const childrenReady = index.size > 0;
  const nodes: MerchSalesTreeNode[] = [];

  for (const row of matchRows) {
    const aggregate = index.get(row.matchId);
    const sectionNodes = sectionNodesFromAggregate(row, aggregate);
    const hasChildren = childrenReady
      ? sectionNodes.length > 0
      : row.receipts > 0 || row.revenue > 0;

    nodes.push({
      id: merchSalesNodeId(row.matchId),
      level: "match",
      matchId: row.matchId,
      date: row.date,
      label: row.eventLabel,
      revenue: row.revenue,
      avgCheck: row.avgCheck,
      receipts: row.receipts,
      units: row.units,
      upt: row.upt,
      attendance: row.attendance,
      purchaseConversionPct: row.purchaseConversionPct,
      sharePct: null,
      hasChildren,
      children: sectionNodes,
    });
  }

  return nodes.sort(
    (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
  );
}

export function getMerchSalesBarMaxima(nodes: MerchSalesTreeNode[]): {
  revenue: number;
  avgCheck: number;
  receipts: number;
  units: number;
} {
  let revenue = 0;
  let avgCheck = 0;
  let receipts = 0;
  let units = 0;

  for (const node of nodes) {
    revenue = Math.max(revenue, node.revenue);
    avgCheck = Math.max(avgCheck, node.avgCheck);
    receipts = Math.max(receipts, node.receipts);
    units = Math.max(units, node.units);
  }

  return { revenue, avgCheck, receipts, units };
}

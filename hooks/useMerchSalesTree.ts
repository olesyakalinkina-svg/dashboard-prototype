"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeMerchSalesTree,
  getMerchSalesBarMaxima,
  getMerchSalesExpandScopeKey,
  getMerchSalesTreeTransactions,
  merchSalesNodeId,
  pruneMerchExpandedKeysForMatches,
  toggleExpandedKey,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import type {
  DashboardFilters,
  MerchFilters,
  MerchMatchSalesRow,
  Transaction,
} from "@/types/dashboard";

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_PAGE_TREE: MerchSalesTreeNode[] = [];

export function useMerchSalesTreeState(
  matchRows: MerchMatchSalesRow[],
  filters: DashboardFilters,
  merchFilters: MerchFilters,
) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);

  const matchRowIdsKey = useMemo(
    () => matchRows.map((row) => row.matchId).join("\0"),
    [matchRows],
  );

  const tree = useMemo(
    () =>
      computeMerchSalesTree(filters, merchFilters, matchRows, {
        transactions: EMPTY_TRANSACTIONS,
      }),
    [filters, merchFilters, matchRows],
  );

  const scopeKey = getMerchSalesExpandScopeKey(merchFilters);

  useEffect(() => {
    const validMatchNodeIds = new Set(
      matchRows.map((row) => merchSalesNodeId(row.matchId)),
    );
    setExpanded((current) => {
      const pruned = pruneMerchExpandedKeysForMatches(
        current,
        validMatchNodeIds,
      );
      if (
        pruned.length === current.length &&
        pruned.every((id, index) => id === current[index])
      ) {
        return current;
      }
      return pruned;
    });
  }, [scopeKey, matchRowIdsKey, matchRows]);

  const barMax = useMemo(() => getMerchSalesBarMaxima(tree), [tree]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((current) => toggleExpandedKey(current, id));
  }, []);

  return {
    tree,
    matchRows,
    filters,
    merchFilters,
    expandedSet,
    toggleExpanded,
    barMax,
  };
}

export function useMerchSalesPageTree(
  pageNodes: MerchSalesTreeNode[],
  state: {
    matchRows: MerchMatchSalesRow[];
    filters: DashboardFilters;
    merchFilters: MerchFilters;
  },
): MerchSalesTreeNode[] {
  const { matchRows, filters, merchFilters } = state;
  const matchIdsKey = pageNodes.map((node) => node.matchId).join("\0");
  const needsHydration = pageNodes.some(
    (node) => node.hasChildren && node.children.length === 0,
  );

  const pageRows = useMemo(() => {
    if (!matchIdsKey) return [];
    const order = matchIdsKey.split("\0");
    const byId = new Map(matchRows.map((row) => [row.matchId, row]));
    const rows: MerchMatchSalesRow[] = [];
    for (const id of order) {
      const row = byId.get(id);
      if (row) rows.push(row);
    }
    return rows;
  }, [matchRows, matchIdsKey]);

  const txs = useMemo(() => {
    if (!needsHydration || !matchIdsKey) return EMPTY_TRANSACTIONS;
    return getMerchSalesTreeTransactions(
      filters,
      merchFilters,
      matchIdsKey.split("\0"),
    );
  }, [needsHydration, matchIdsKey, filters, merchFilters]);

  return useMemo(() => {
    if (pageNodes.length === 0) return EMPTY_PAGE_TREE;
    if (!needsHydration) return pageNodes;
    return computeMerchSalesTree(filters, merchFilters, pageRows, {
      transactions: txs,
    });
  }, [pageNodes, needsHydration, filters, merchFilters, pageRows, txs]);
}

export type MerchSalesTreeState = ReturnType<typeof useMerchSalesTreeState> & {
  tree: MerchSalesTreeNode[];
};

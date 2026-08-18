"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeMatchSalesTree,
  getMatchSalesBarMaxima,
  getMatchSalesExpandScopeKey,
  getMatchSalesTreeTransactions,
  matchSalesNodeId,
  pruneExpandedKeysForMatches,
  toggleExpandedKey,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import type {
  DashboardFilters,
  MatchSalesRow,
  TicketFilters,
  Transaction,
} from "@/types/dashboard";

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_PAGE_TREE: MatchSalesTreeNode[] = [];

export function useMatchSalesTreeState(
  matchRows: MatchSalesRow[],
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);

  const matchRowIdsKey = useMemo(
    () => matchRows.map((row) => row.matchId).join("\0"),
    [matchRows],
  );

  const tree = useMemo(
    () =>
      computeMatchSalesTree(filters, ticketFilters, matchRows, {
        transactions: EMPTY_TRANSACTIONS,
      }),
    [filters, ticketFilters, matchRows],
  );

  const scopeKey = getMatchSalesExpandScopeKey(ticketFilters);

  useEffect(() => {
    const validMatchNodeIds = new Set(
      matchRows.map((row) => matchSalesNodeId(row.matchId)),
    );
    setExpanded((current) => {
      const pruned = pruneExpandedKeysForMatches(current, validMatchNodeIds);
      if (
        pruned.length === current.length &&
        pruned.every((id, index) => id === current[index])
      ) {
        return current;
      }
      return pruned;
    });
  }, [scopeKey, matchRowIdsKey, matchRows]);

  const barMax = useMemo(() => getMatchSalesBarMaxima(tree), [tree]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((current) => toggleExpandedKey(current, id));
  }, []);

  return {
    tree,
    matchRows,
    filters,
    ticketFilters,
    expandedSet,
    toggleExpanded,
    barMax,
  };
}

/**
 * Attach the 4-level hierarchy for the current page of matches only.
 * Expand/collapse must not call this — it depends on page ids and filters, not expandedNodeIds.
 */
export function useMatchSalesPageTree(
  pageNodes: MatchSalesTreeNode[],
  state: {
    matchRows: MatchSalesRow[];
    filters: DashboardFilters;
    ticketFilters: TicketFilters;
  },
): MatchSalesTreeNode[] {
  const { matchRows, filters, ticketFilters } = state;
  const matchIdsKey = pageNodes.map((node) => node.matchId).join("\0");
  const needsHydration = pageNodes.some(
    (node) => node.hasChildren && node.children.length === 0,
  );

  const pageRows = useMemo(() => {
    if (!matchIdsKey) return [];
    const order = matchIdsKey.split("\0");
    const byId = new Map(matchRows.map((row) => [row.matchId, row]));
    const rows: MatchSalesRow[] = [];
    for (const id of order) {
      const row = byId.get(id);
      if (row) rows.push(row);
    }
    return rows;
  }, [matchRows, matchIdsKey]);

  const txs = useMemo(() => {
    if (!needsHydration || !matchIdsKey) return EMPTY_TRANSACTIONS;
    return getMatchSalesTreeTransactions(
      filters,
      ticketFilters,
      matchIdsKey.split("\0"),
    );
  }, [needsHydration, matchIdsKey, filters, ticketFilters]);

  return useMemo(() => {
    if (pageNodes.length === 0) return EMPTY_PAGE_TREE;
    if (!needsHydration) return pageNodes;
    return computeMatchSalesTree(filters, ticketFilters, pageRows, {
      transactions: txs,
    });
  }, [
    pageNodes,
    needsHydration,
    filters,
    ticketFilters,
    pageRows,
    txs,
  ]);
}

export type MatchSalesTreeState = ReturnType<typeof useMatchSalesTreeState> & {
  tree: MatchSalesTreeNode[];
};

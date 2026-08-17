"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFilterData } from "@/context/FilterContext";
import { waitForPaint } from "@/lib/idle";
import {
  collectMatchSalesNodeIds,
  computeMatchSalesTree,
  countActiveMatchSalesLocalFilters,
  EMPTY_MATCH_SALES_LOCAL_FILTERS,
  getMatchSalesBarMaxima,
  getMatchSalesExpandScopeKey,
  getMatchSalesLocalFilterChips,
  getMatchSalesLocalFilterOptions,
  getMatchSalesTreeTransactions,
  hasMatchSalesBranchFilters,
  localFilterArraysEqual,
  matchIdFromExpandedNodeId,
  matchSalesNodeId,
  pruneExpandedKeys,
  removeMatchSalesLocalFilterValue,
  sanitizeMatchSalesLocalFilters,
  toggleExpandedKey,
  type MatchSalesLocalFilters,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import type { MatchSalesRow, Transaction } from "@/types/dashboard";

const EMPTY_TRANSACTIONS: Transaction[] = [];

function expandedMatchIdsFromKeys(expanded: string[]): string[] {
  const ids: string[] = [];
  for (const id of expanded) {
    const matchId = matchIdFromExpandedNodeId(id);
    if (matchId) ids.push(matchId);
  }
  return [...new Set(ids)];
}

export function useMatchSalesTreeState(matchRows: MatchSalesRow[]) {
  const { appliedFilters: filters, appliedTicketFilters: ticketFilters } =
    useFilterData();
  const [localFilters, setLocalFilters] = useState<MatchSalesLocalFilters>(
    EMPTY_MATCH_SALES_LOCAL_FILTERS,
  );
  const [expanded, setExpanded] = useState<string[]>([]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const expandedMatchIds = useMemo(
    () => expandedMatchIdsFromKeys(expanded),
    [expanded],
  );
  const branchFilters = hasMatchSalesBranchFilters(localFilters);
  const needsTransactions =
    expanded.length > 0 ||
    branchFilters ||
    localFilters.matchId.length > 0;
  const [txs, setTxs] = useState<Transaction[]>(EMPTY_TRANSACTIONS);

  useEffect(() => {
    if (!needsTransactions) {
      setTxs(EMPTY_TRANSACTIONS);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        await waitForPaint();
        if (cancelled) return;
        const next =
          branchFilters && localFilters.matchId.length === 0
            ? getMatchSalesTreeTransactions(filters, ticketFilters)
            : (() => {
                const matchIds = [
                  ...new Set([...expandedMatchIds, ...localFilters.matchId]),
                ];
                if (matchIds.length > 0) {
                  return getMatchSalesTreeTransactions(
                    filters,
                    ticketFilters,
                    matchIds,
                  );
                }
                return getMatchSalesTreeTransactions(filters, ticketFilters);
              })();
        if (cancelled) return;
        setTxs(next);
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    needsTransactions,
    branchFilters,
    expandedMatchIds,
    localFilters.matchId,
    filters,
    ticketFilters,
    ticketFilters.season,
    ticketFilters.league,
    ticketFilters.tournamentStage,
    ticketFilters.matchClass,
    ticketFilters.arena,
    ticketFilters.eventCompleted,
    ticketFilters.matchId,
    ticketFilters.ticketType,
    ticketFilters.priceZone,
    ticketFilters.orderSource,
    ticketFilters.transactionDateRange.from,
    ticketFilters.transactionDateRange.to,
  ]);

  const options = useMemo(
    () => getMatchSalesLocalFilterOptions(txs, matchRows, localFilters),
    [txs, matchRows, localFilters],
  );

  useEffect(() => {
    const sanitized = sanitizeMatchSalesLocalFilters(localFilters, options);
    if (!localFilterArraysEqual(sanitized, localFilters)) {
      setLocalFilters(sanitized);
    }
  }, [localFilters, options]);

  const tree = useMemo(
    () =>
      computeMatchSalesTree(filters, ticketFilters, localFilters, matchRows, {
        expandedIds: expandedSet,
        ...(needsTransactions
          ? { transactions: txs }
          : { transactions: EMPTY_TRANSACTIONS }),
      }),
    [
      filters,
      ticketFilters,
      localFilters,
      matchRows,
      expandedSet,
      txs,
      needsTransactions,
    ],
  );

  const scopeKey = getMatchSalesExpandScopeKey(ticketFilters);

  useEffect(() => {
    const validIds = collectMatchSalesNodeIds(tree);
    // Match-level rows exist even on a collapsed snapshot (no children yet).
    // Keep those ids so prune cannot drop a just-toggled "+" before children attach.
    for (const row of matchRows) {
      validIds.add(matchSalesNodeId(row.matchId));
    }
    setExpanded((current) => {
      const pruned = pruneExpandedKeys(current, validIds);
      if (
        pruned.length === current.length &&
        pruned.every((id, index) => id === current[index])
      ) {
        return current;
      }
      return pruned;
    });
  }, [scopeKey, tree, matchRows]);
  const barMax = useMemo(() => getMatchSalesBarMaxima(tree), [tree]);
  const activeFilterCount = countActiveMatchSalesLocalFilters(localFilters);
  const chips = useMemo(
    () => getMatchSalesLocalFilterChips(localFilters, options),
    [localFilters, options],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((current) => toggleExpandedKey(current, id));
  }, []);

  const resetLocalFilters = useCallback(() => {
    setLocalFilters(EMPTY_MATCH_SALES_LOCAL_FILTERS);
  }, []);

  const removeChip = useCallback(
    (dimension: keyof MatchSalesLocalFilters, value: string) => {
      setLocalFilters((current) =>
        removeMatchSalesLocalFilterValue(current, dimension, value),
      );
    },
    [],
  );

  return {
    tree,
    localFilters,
    setLocalFilters,
    options,
    expandedSet,
    toggleExpanded,
    barMax,
    activeFilterCount,
    chips,
    resetLocalFilters,
    removeChip,
  };
}

export type MatchSalesTreeState = ReturnType<typeof useMatchSalesTreeState> & {
  tree: MatchSalesTreeNode[];
};

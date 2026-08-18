"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RowsExcelButton } from "@/components/ui/ExcelDownloadButton";
import {
  useMatchSalesPageTree,
  type MatchSalesTreeState,
} from "@/hooks/useMatchSalesTree";
import {
  flattenExpandedMatchSalesTree,
  paginateTopLevel,
  type MatchSalesFlatRow,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { ExcelValue } from "@/lib/excel-export";

const MATCH_SALES_EXCEL_HEADERS = [
  "Мероприятие",
  "Дата",
  "Выручка",
  "Средняя цена",
  "Продано",
  "Бесплатно",
  "Оформлено",
  "Скидка ПЛ",
];

function getNestedBranchBorderClass(node: MatchSalesTreeNode): string {
  if (node.level === "section") {
    if (node.id.includes("|sec:ticketType")) return "border-l-blue-500";
    if (node.id.includes("|sec:orderSource")) return "border-l-green-500";
    if (node.id.includes("|sec:priceZone")) return "border-l-violet-500";
  }
  if (node.level === "ticketType") return "border-l-blue-300";
  if (node.level === "orderSource") return "border-l-green-300";
  if (node.level === "priceZone") return "border-l-violet-300";
  return "border-l-[var(--border)]";
}

function matchSalesTreeNodeMatchesQuery(
  node: MatchSalesTreeNode,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const label = node.label.toLowerCase();
  const dateText = node.date ? formatDate(node.date).toLowerCase() : "";

  return label.includes(q) || dateText.includes(q);
}

function getTreeExcelRows(rows: MatchSalesFlatRow[]): ExcelValue[][] {
  return rows.map((row) => [
    row.label,
    row.date ? formatDate(row.date) : "",
    row.revenue,
    row.avgPrice,
    row.ticketsSold,
    row.freeTickets,
    row.issuedTickets,
    Math.round(row.loyaltyDiscountPct * 10) / 10,
  ]);
}

function MetricsGrid({ row }: { row: MatchSalesTreeNode | MatchSalesFlatRow }) {
  const fillPct =
    row.capacity != null && row.capacity > 0
      ? (row.issuedTickets / row.capacity) * 100
      : null;
  const revenueFulfillmentPct =
    row.planRevenue != null && row.planRevenue > 0
      ? (row.revenue / row.planRevenue) * 100
      : null;

  return (
    <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
      <div className="col-span-2">
        <dt className="text-[var(--muted)]">Выручка</dt>
        <dd className="font-medium text-[var(--foreground)]">
          {formatCurrency(row.revenue)}
          <span className="ml-1.5 font-normal text-[var(--muted)]">
            (
            {revenueFulfillmentPct !== null
              ? formatPercent(revenueFulfillmentPct)
              : "—"}
            )
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Средняя цена</dt>
        <dd className="text-[var(--foreground)]">
          {formatCurrency(row.avgPrice)}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Продано</dt>
        <dd className="text-[var(--foreground)]">
          {formatNumber(row.ticketsSold)} шт
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Бесплатно</dt>
        <dd className="text-[var(--foreground)]">
          {formatNumber(row.freeTickets)} шт
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Оформлено</dt>
        <dd className="text-[var(--foreground)]">
          {formatNumber(row.issuedTickets)} шт
          {fillPct !== null ? ` (${formatPercent(fillPct)})` : " (—)"}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Скидка ПЛ</dt>
        <dd className="text-[var(--foreground)]">
          {row.loyaltyDiscountPct.toFixed(1)}%
        </dd>
      </div>
    </dl>
  );
}

const NestedBranch = memo(function NestedBranch({
  node,
  expandedSet,
  toggleExpanded,
}: {
  node: MatchSalesTreeNode;
  expandedSet: Set<string>;
  toggleExpanded: (id: string) => void;
}) {
  const expanded = expandedSet.has(node.id);
  const hasChildren = node.hasChildren || node.children.length > 0;

  const borderClass = getNestedBranchBorderClass(node);
  return (
    <div className={clsx("rounded-md border border-[var(--border)] border-l-4 p-2.5", borderClass)}>
      <p
        className={clsx(
          "text-xs font-medium",
          node.level === "section"
            ? "text-[var(--foreground)]"
            : "text-[var(--muted)]",
        )}
      >
        {node.label}
      </p>
      <MetricsGrid row={node} />
      {hasChildren && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleExpanded(node.id);
          }}
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--border)] text-xs font-medium"
          aria-expanded={expanded}
          aria-label={
            expanded ? `Свернуть: ${node.label}` : `Развернуть: ${node.label}`
          }
        >
          {expanded ? "Скрыть детализацию" : "Показать детализацию"}
        </button>
      )}
      {hasChildren && expanded && (
        <div className="mt-2 space-y-2 pl-2">
          {node.children.map((child) => (
            <NestedBranch
              key={child.id}
              node={child}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const MobileSalesCards = memo(function MobileSalesCards({
  treeState,
}: {
  treeState: MatchSalesTreeState;
}) {
  const { tree, expandedSet, toggleExpanded } = treeState;
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 8;

  const sorted = useMemo(
    () =>
      [...tree].sort(
        (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
      ),
    [tree],
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sorted;
    return sorted.filter((node) =>
      matchSalesTreeNodeMatchesQuery(node, searchQuery),
    );
  }, [sorted, searchQuery]);

  const pagination = useMemo(
    () => paginateTopLevel(filtered, page, pageSize),
    [filtered, page],
  );

  const pageTree = useMatchSalesPageTree(pagination.pageItems, treeState);

  useEffect(() => {
    if (page !== pagination.pageIndex) {
      setPage(pagination.pageIndex);
    }
  }, [page, pagination.pageIndex]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const excelRows = useMemo(
    () =>
      getTreeExcelRows(flattenExpandedMatchSalesTree(pageTree, expandedSet)),
    [pageTree, expandedSet],
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex w-full items-center justify-between gap-3">
          <CardTitle>Продажи</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 w-48">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по мероприятию..."
                aria-label="Поиск по мероприятию..."
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <RowsExcelButton
              fileName="Продажи"
              headers={MATCH_SALES_EXCEL_HEADERS}
              rows={excelRows}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pageTree.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            Нет данных
          </p>
        ) : (
          pageTree.map((row) => {
            const expanded = expandedSet.has(row.id);
            return (
              <article
                key={row.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {row.label}
                  </p>
                  {row.date && (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {formatDate(row.date)}
                    </p>
                  )}
                </div>
                <MetricsGrid row={row} />
                {(row.hasChildren || row.children.length > 0) && (
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleExpanded(row.id);
                    }}
                    className="mt-3 min-h-11 w-full rounded-md border border-[var(--border)] bg-white text-sm font-medium"
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? `Свернуть: ${row.label}`
                        : `Развернуть: ${row.label}`
                    }
                  >
                    {expanded ? "Скрыть детализацию" : "Показать детализацию"}
                  </button>
                )}
                {expanded && (
                  <div className="mt-2 space-y-2">
                    {row.children.map((child) => (
                      <NestedBranch
                        key={child.id}
                        node={child}
                        expandedSet={expandedSet}
                        toggleExpanded={toggleExpanded}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}

        {pagination.pageCount > 1 && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              disabled={pagination.pageIndex === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className={clsx(
                "min-h-10 rounded-md border border-[var(--border)] px-3",
                pagination.pageIndex === 0 && "opacity-40",
              )}
            >
              Назад
            </button>
            <span className="text-[var(--muted)]">
              {pagination.pageIndex + 1} / {pagination.pageCount}
            </span>
            <button
              type="button"
              disabled={pagination.pageIndex >= pagination.pageCount - 1}
              onClick={() =>
                setPage((value) =>
                  Math.min(pagination.pageCount - 1, value + 1),
                )
              }
              className={clsx(
                "min-h-10 rounded-md border border-[var(--border)] px-3",
                pagination.pageIndex >= pagination.pageCount - 1 &&
                  "opacity-40",
              )}
            >
              Вперёд
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

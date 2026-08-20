"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RowsExcelButton } from "@/components/ui/ExcelDownloadButton";
import {
  useMerchSalesPageTree,
  type MerchSalesTreeState,
} from "@/hooks/useMerchSalesTree";
import {
  flattenExpandedMerchSalesTree,
  merchSalesPlanFulfillmentPct,
  paginateTopLevel,
  sortMerchSalesNodes,
  type MerchSalesFlatRow,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { ExcelValue } from "@/lib/excel-export";

const MERCH_SALES_EXCEL_HEADERS = [
  "Мероприятие",
  "Дата",
  "Выручка",
  "% выполнения плана",
  "Средний чек",
  "Чеки",
  "Товары",
  "UPT",
  "Конверсия в покупку",
];

function formatUpt(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function CompactKpis({ row }: { row: MerchSalesTreeNode | MerchSalesFlatRow }) {
  const planPct = merchSalesPlanFulfillmentPct(row.revenue, row.planRevenue);
  const planPctLabel = planPct !== null ? formatPercent(planPct) : "—";

  return (
    <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs leading-snug">
      <div className="col-span-2">
        <dt className="text-[var(--muted)]">Выручка</dt>
        <dd className="font-medium text-[var(--foreground)]">
          {formatCurrency(row.revenue)}
        </dd>
      </div>
      <div className="col-span-2">
        <dt className="text-[var(--muted)]">% выполнения плана</dt>
        <dd className="text-[var(--foreground)]">{planPctLabel}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Чеки</dt>
        <dd className="text-[var(--foreground)]">{formatNumber(row.receipts)}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Товары</dt>
        <dd className="text-[var(--foreground)]">
          {formatNumber(row.units)} шт
        </dd>
      </div>
    </dl>
  );
}

function DetailKpis({ row }: { row: MerchSalesTreeNode | MerchSalesFlatRow }) {
  const showConversion =
    (row.level === "match" || row.level === "section") && row.attendance > 0;

  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs leading-snug">
      <div>
        <dt className="text-[var(--muted)]">Средний чек</dt>
        <dd className="text-[var(--foreground)]">{formatCurrency(row.avgCheck)}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">UPT</dt>
        <dd className="text-[var(--foreground)]">{formatUpt(row.upt)}</dd>
      </div>
      {showConversion ? (
        <div>
          <dt className="text-[var(--muted)]">Конверсия в покупку</dt>
          <dd className="text-[var(--foreground)]">
            {formatPercent(row.purchaseConversionPct)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

const NestedBranch = memo(function NestedBranch({
  node,
  expandedSet,
  toggleExpanded,
}: {
  node: MerchSalesTreeNode;
  expandedSet: Set<string>;
  toggleExpanded: (id: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const expanded = expandedSet.has(node.id);
  const hasChildren = node.hasChildren || node.children.length > 0;

  return (
    <div className="rounded-md border border-[var(--border)] border-l-4 p-2.5">
      <p
        className={clsx(
          "text-xs font-medium leading-snug",
          node.level === "section"
            ? "text-[var(--foreground)]"
            : "text-[var(--muted)]",
        )}
      >
        {node.label}
      </p>
      <CompactKpis row={node} />
      <button
        type="button"
        onClick={() => setDetailsOpen((value) => !value)}
        className="mt-2 min-h-11 w-full rounded-md border border-[var(--border)] text-xs font-medium"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? "Скрыть" : "Подробнее"}
      </button>
      {detailsOpen ? <DetailKpis row={node} /> : null}
      {hasChildren && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleExpanded(node.id);
          }}
          className="mt-2 min-h-11 w-full rounded-md border border-[var(--border)] text-xs font-medium"
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

const TopLevelCard = memo(function TopLevelCard({
  row,
  expandedSet,
  toggleExpanded,
}: {
  row: MerchSalesTreeNode;
  expandedSet: Set<string>;
  toggleExpanded: (id: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const expanded = expandedSet.has(row.id);
  const hasChildren = row.hasChildren || row.children.length > 0;

  return (
    <article
      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
      data-testid="merch-mobile-card"
    >
      <p className="break-words text-sm font-medium leading-snug text-[var(--foreground)]">
        {row.label}
      </p>
      {row.date ? (
        <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
          {formatDate(row.date)}
        </p>
      ) : null}
      <CompactKpis row={row} />
      <button
        type="button"
        onClick={() => setDetailsOpen((value) => !value)}
        className="mt-3 min-h-11 w-full rounded-md border border-[var(--border)] bg-white text-sm font-medium"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? "Скрыть" : "Подробнее"}
      </button>
      {detailsOpen ? <DetailKpis row={row} /> : null}
      {hasChildren && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleExpanded(row.id);
          }}
          className="mt-2 min-h-11 w-full rounded-md border border-[var(--border)] bg-white text-sm font-medium"
          aria-expanded={expanded}
          aria-label={
            expanded ? `Свернуть: ${row.label}` : `Развернуть: ${row.label}`
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
});

function getTreeExcelRows(rows: MerchSalesFlatRow[]): ExcelValue[][] {
  return rows.map((row) => {
    const pct = merchSalesPlanFulfillmentPct(row.revenue, row.planRevenue);
    return [
      row.label,
      row.date ? formatDate(row.date) : "",
      row.revenue,
      pct !== null ? Math.round(pct * 10) / 10 : "—",
      row.avgCheck,
      row.receipts,
      row.units,
      Math.round(row.upt * 100) / 100,
      Math.round(row.purchaseConversionPct * 10) / 10,
    ];
  });
}

export const MerchMobileSalesCards = memo(function MerchMobileSalesCards({
  treeState,
}: {
  treeState: MerchSalesTreeState;
}) {
  const { tree, expandedSet, toggleExpanded } = treeState;
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 8;

  const sorted = useMemo(
    () => sortMerchSalesNodes(tree, { id: "date", desc: true }),
    [tree],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((node) => {
      const dateText = node.date ? formatDate(node.date).toLowerCase() : "";
      return node.label.toLowerCase().includes(q) || dateText.includes(q);
    });
  }, [sorted, searchQuery]);

  const pagination = useMemo(
    () => paginateTopLevel(filtered, page, pageSize),
    [filtered, page],
  );

  const pageTree = useMerchSalesPageTree(pagination.pageItems, treeState);

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
      getTreeExcelRows(flattenExpandedMerchSalesTree(pageTree, expandedSet)),
    [pageTree, expandedSet],
  );

  return (
    <Card className="min-w-0" data-testid="merch-mobile-sales-cards">
      <CardHeader>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
          <CardTitle>Продажи</CardTitle>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по мероприятию..."
                aria-label="Поиск по мероприятию..."
                className="h-11 w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <RowsExcelButton
              fileName="Продажи"
              headers={MERCH_SALES_EXCEL_HEADERS}
              rows={excelRows}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pageTree.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Нет данных</p>
        ) : (
          pageTree.map((row) => (
            <TopLevelCard
              key={row.id}
              row={row}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
            />
          ))
        )}
        {pagination.pageCount > 1 && (
          <div className="flex items-center justify-between pt-1 text-xs leading-none">
            <button
              type="button"
              disabled={pagination.pageIndex === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className={clsx(
                "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 leading-none",
                pagination.pageIndex === 0 && "opacity-40",
              )}
            >
              Назад
            </button>
            <span className="inline-flex min-h-11 items-center leading-none text-[var(--muted)]">
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
                "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 leading-none",
                pagination.pageIndex >= pagination.pageCount - 1 && "opacity-40",
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

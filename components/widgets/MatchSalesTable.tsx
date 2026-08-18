"use client";

import clsx from "clsx";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { TableExcelButton } from "@/components/ui/ExcelDownloadButton";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MobileSalesCards } from "@/components/widgets/MobileSalesCards";
import {
  useMatchSalesPageTree,
  useMatchSalesTreeState,
  type MatchSalesTreeState,
} from "@/hooks/useMatchSalesTree";
import {
  flattenExpandedMatchSalesTree,
  paginateTopLevel,
  sortMatchSalesNodes,
  type MatchSalesFlatRow,
  type MatchSalesTreeNode,
  type MatchSalesSortId,
} from "@/lib/match-sales-tree";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { DashboardFilters, MatchSalesRow, TicketFilters } from "@/types/dashboard";

const PAGE_SIZE = 15;

type MatchSalesTableMeta = {
  expandedSet: ReadonlySet<string>;
  toggleExpanded: (id: string) => void;
  barMax: {
    revenue: number;
    avgPrice: number;
    ticketsSold: number;
    issuedTickets: number;
    loyaltyDiscountPct: number;
  };
};

function getBarClass(
  level: MatchSalesFlatRow["level"],
  matchClass: string,
  sectionClass: string,
  leafClass: string,
): string {
  if (level === "match") return matchClass;
  if (level === "section") return sectionClass;
  return leafClass;
}

function isMatchSalesSortId(id: string): id is MatchSalesSortId {
  return (
    id === "eventLabel" ||
    id === "date" ||
    id === "revenue" ||
    id === "avgPrice" ||
    id === "ticketsSold" ||
    id === "freeTickets" ||
    id === "issuedTickets" ||
    id === "loyaltyDiscountPct"
  );
}

function MatchSalesExpandButton({
  expanded,
  hasChildren,
  label,
  onToggle,
}: {
  expanded: boolean;
  hasChildren: boolean;
  label: string;
  onToggle: () => void;
}) {
  if (!hasChildren) {
    return <span className="inline-block w-5 shrink-0" aria-hidden />;
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className="relative z-20 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-white text-xs font-medium leading-none text-[var(--foreground)]"
      aria-expanded={expanded}
      aria-label={expanded ? `Свернуть: ${label}` : `Развернуть: ${label}`}
    >
      {expanded ? "−" : "+"}
    </button>
  );
}

export function matchSalesTreeNodeMatchesQuery(
  node: MatchSalesTreeNode,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // Match row UI shows `${eventLabel} + formatted(date)` in separate columns,
  // so global search must match against that combined label string.
  const dateText = node.date ? formatDate(node.date) : "";
  const matchLabel = `${node.label} ${dateText}`.toLowerCase().trim();

  return matchLabel.includes(q);
}

const MATCH_SALES_COLUMNS: ColumnDef<MatchSalesFlatRow, unknown>[] = [
  {
    accessorKey: "eventLabel",
    accessorFn: (row) => row.label,
    header: "Мероприятие",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as MatchSalesTableMeta;
      const expanded = meta.expandedSet.has(item.id);
      return (
        <div
          className="flex min-w-0 items-center gap-2"
          style={{ paddingLeft: item.depth * 16 }}
        >
          <MatchSalesExpandButton
            expanded={expanded}
            hasChildren={item.hasChildren}
            label={item.label}
            onToggle={() => meta.toggleExpanded(item.id)}
          />
          <span
            className={clsx(
              "whitespace-nowrap",
              item.level === "match" || item.level === "section"
                ? "font-medium"
                : "text-[var(--muted)]",
            )}
          >
            {item.label}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "date",
    header: "Дата",
    cell: ({ row }) =>
      row.original.date ? formatDate(row.original.date) : "",
  },
  {
    accessorKey: "revenue",
    header: "Выручка",
    cell: ({ row, table }) => {
      const item = row.original;
      const { revenue, planRevenue } = item;
      const { barMax } = table.options.meta as MatchSalesTableMeta;
      const fulfillmentPct =
        planRevenue != null && planRevenue > 0
          ? (revenue / planRevenue) * 100
          : null;
      return (
        <InlineBarCell
          value={revenue}
          max={barMax.revenue}
          share={fulfillmentPct ?? undefined}
          formatted={formatCurrency(revenue)}
          trailingFormatted={
            fulfillmentPct !== null ? formatPercent(fulfillmentPct) : "—"
          }
          barClassName={getBarClass(item.level, "bg-rose-400", "bg-rose-300", "bg-rose-200")}
        />
      );
    },
  },
  {
    accessorKey: "avgPrice",
    header: "Средняя цена",
    cell: ({ row, table }) => {
      const { barMax } = table.options.meta as MatchSalesTableMeta;
      return (
        <InlineBarCell
          value={row.original.avgPrice}
          max={barMax.avgPrice}
          formatted={formatCurrency(row.original.avgPrice)}
          barClassName={getBarClass(row.original.level, "bg-blue-500", "bg-blue-300", "bg-blue-200")}
        />
      );
    },
  },
  {
    accessorKey: "ticketsSold",
    header: "Продано",
    cell: ({ row, table }) => {
      const { barMax } = table.options.meta as MatchSalesTableMeta;
      return (
        <InlineBarCell
          value={row.original.ticketsSold}
          max={barMax.ticketsSold}
          formatted={`${formatNumber(row.original.ticketsSold)} шт`}
          barClassName={getBarClass(row.original.level, "bg-slate-400", "bg-slate-300", "bg-slate-200")}
        />
      );
    },
  },
  {
    accessorKey: "freeTickets",
    header: "Бесплатно",
    cell: ({ row }) => `${formatNumber(row.original.freeTickets)} шт`,
  },
  {
    accessorKey: "issuedTickets",
    header: "Оформлено",
    cell: ({ row, table }) => {
      const { issuedTickets, capacity } = row.original;
      const { barMax } = table.options.meta as MatchSalesTableMeta;
      const issuedBarClass = getBarClass(row.original.level, "bg-emerald-500", "bg-emerald-300", "bg-emerald-200");
      if (capacity != null && capacity > 0) {
        const fillPct = (issuedTickets / capacity) * 100;
        return (
          <InlineBarCell
            value={issuedTickets}
            max={capacity}
            formatted={`${formatNumber(issuedTickets)} шт (${formatPercent(fillPct)})`}
            barClassName={issuedBarClass}
          />
        );
      }
      return (
        <InlineBarCell
          value={issuedTickets}
          max={barMax.issuedTickets}
          formatted={`${formatNumber(issuedTickets)} шт`}
          trailingFormatted="—"
          barClassName={issuedBarClass}
        />
      );
    },
  },
  {
    accessorKey: "loyaltyDiscountPct",
    header: "Скидка ПЛ",
    cell: ({ row, table }) => {
      const { barMax } = table.options.meta as MatchSalesTableMeta;
      return (
        <InlineBarCell
          value={row.original.loyaltyDiscountPct}
          max={barMax.loyaltyDiscountPct}
          formatted={`${row.original.loyaltyDiscountPct.toFixed(1)}%`}
          barClassName={getBarClass(row.original.level, "bg-amber-500", "bg-amber-300", "bg-amber-200")}
        />
      );
    },
  },
];

export const ResponsiveMatchSalesTable = memo(function ResponsiveMatchSalesTable({
  data,
  filters,
  ticketFilters,
}: {
  data: MatchSalesRow[];
  filters: DashboardFilters;
  ticketFilters: TicketFilters;
}) {
  const treeState = useMatchSalesTreeState(data, filters, ticketFilters);
  return (
    <>
      <div className="min-w-0 md:hidden">
        <MobileSalesCards treeState={treeState} />
      </div>
      <div className="hidden min-w-0 md:block">
        <MatchSalesTable treeState={treeState} />
      </div>
    </>
  );
});

export const MatchSalesTable = memo(function MatchSalesTable({
  embedded = false,
  treeState,
}: {
  embedded?: boolean;
  treeState: MatchSalesTreeState;
}) {
  const { tree, expandedSet, toggleExpanded, barMax } = treeState;
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const sort = sorting[0];
  const sortedTree = useMemo(
    () =>
      sortMatchSalesNodes(
        tree,
        sort && isMatchSalesSortId(sort.id)
          ? { id: sort.id, desc: sort.desc }
          : { id: "date", desc: true },
      ),
    [tree, sort],
  );

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return sortedTree;
    return sortedTree.filter((node) =>
      matchSalesTreeNodeMatchesQuery(node, searchQuery),
    );
  }, [sortedTree, searchQuery]);

  const pagination = useMemo(
    () => paginateTopLevel(filteredTree, pageIndex, PAGE_SIZE),
    [filteredTree, pageIndex],
  );

  useEffect(() => {
    if (pageIndex !== pagination.pageIndex) {
      setPageIndex(pagination.pageIndex);
    }
  }, [pageIndex, pagination.pageIndex]);

  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery]);

  const pageTree = useMatchSalesPageTree(pagination.pageItems, treeState);

  const flatRows = useMemo(
    () => flattenExpandedMatchSalesTree(pageTree, expandedSet),
    [pageTree, expandedSet],
  );

  const tableMeta = useMemo<MatchSalesTableMeta>(
    () => ({ expandedSet, toggleExpanded, barMax }),
    [expandedSet, toggleExpanded, barMax],
  );

  const table = useReactTable({
    data: flatRows,
    columns: MATCH_SALES_COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  const excelRows = useMemo(
    () => flattenExpandedMatchSalesTree(pageTree, expandedSet),
    [pageTree, expandedSet],
  );

  const excelTable = useReactTable({
    data: excelRows,
    columns: MATCH_SALES_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  const goPrev = useCallback(
    () => setPageIndex((value) => Math.max(0, value - 1)),
    [],
  );
  const goNext = useCallback(
    () =>
      setPageIndex((value) =>
        Math.min(pagination.pageCount - 1, value + 1),
      ),
    [pagination.pageCount],
  );

  const tableContent = (
    <>
      {embedded && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по мероприятию..."
                aria-label="Поиск по мероприятию..."
              className="h-9 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] sm:h-8 sm:w-48"
            />
          </div>
          <TableExcelButton table={excelTable} fileName="Продажи" />
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-[var(--border)]">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-[var(--muted)]"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {{
                      asc: <ChevronUp className="h-3 w-3" />,
                      desc: <ChevronDown className="h-3 w-3" />,
                    }[header.column.getIsSorted() as string] ?? null}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--border)] last:border-0"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={clsx(
                    "px-3 py-2.5 text-[var(--foreground)]",
                    cell.column.id === "eventLabel" && "relative z-20",
                  )}
                  onClick={
                    cell.column.id === "eventLabel"
                      ? (event) => event.stopPropagation()
                      : undefined
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>{filteredTree.length} мероприятий</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={pagination.pageIndex === 0}
            className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
          >
            Назад
          </button>
          <span>
            {pagination.pageIndex + 1} / {pagination.pageCount}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={pagination.pageIndex >= pagination.pageCount - 1}
            className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      </div>
    </>
  );

  return embedded ? (
    <div className="overflow-x-auto">{tableContent}</div>
  ) : (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <div className="flex w-full items-center justify-between gap-3">
          <CardTitle>Продажи</CardTitle>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по мероприятию..."
                aria-label="Поиск по мероприятию..."
                className="h-9 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] sm:h-8 sm:w-48"
              />
            </div>
            <TableExcelButton table={excelTable} fileName="Продажи" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">{tableContent}</CardContent>
    </Card>
  );
});

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
import { SALES_COL_PERCENT } from "@/components/ui/sales-table-layout";
import { StickyScrollTable } from "@/components/ui/StickyScrollTable";
import { TreeExpandButton } from "@/components/ui/TreeExpandButton";
import { MerchMobileSalesCards } from "@/components/widgets/MerchMobileSalesCards";
import {
  useFilterData,
  useMerchViewResetEpoch,
} from "@/context/FilterContext";
import { useIsMobileLayout } from "@/hooks/useLayoutMode";
import {
  useMerchSalesPageTree,
  useMerchSalesTreeState,
  type MerchSalesTreeState,
} from "@/hooks/useMerchSalesTree";
import {
  flattenExpandedMerchSalesTree,
  merchSalesPlanFulfillmentPct,
  paginateTopLevel,
  sortMerchSalesNodes,
  type MerchSalesFlatRow,
  type MerchSalesSortId,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { MerchMatchSalesRow } from "@/types/dashboard";

const PAGE_SIZE = 15;

const BAR_COLUMN_WIDTH_CLASS = "w-[10.5rem]";
const COLUMN_WIDTH_CLASS: Record<string, string> = {
  eventLabel: "w-auto min-w-[14rem]",
  date: "w-[7rem]",
  revenue: BAR_COLUMN_WIDTH_CLASS,
  planFulfillment: SALES_COL_PERCENT,
  avgCheck: "w-[9rem]",
  receipts: "w-[8rem]",
  units: "w-[9rem]",
  upt: "w-[4.5rem]",
  purchaseConversionPct: BAR_COLUMN_WIDTH_CLASS,
};

type MerchSalesTableMeta = {
  expandedSet: ReadonlySet<string>;
  toggleExpanded: (id: string) => void;
  barMax: {
    revenue: number;
    avgCheck: number;
    receipts: number;
    units: number;
    purchaseConversionPct: number;
  };
};

function formatUpt(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function getBarClass(
  level: MerchSalesFlatRow["level"],
  matchClass: string,
  sectionClass: string,
  leafClass: string,
): string {
  if (level === "match") return matchClass;
  if (level === "section") return sectionClass;
  return leafClass;
}

function isMerchSalesSortId(id: string): id is MerchSalesSortId {
  return (
    id === "eventLabel" ||
    id === "date" ||
    id === "revenue" ||
    id === "planFulfillment" ||
    id === "avgCheck" ||
    id === "receipts" ||
    id === "units" ||
    id === "upt" ||
    id === "purchaseConversionPct"
  );
}

function MerchSalesExpandButton({
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
  return (
    <TreeExpandButton
      expanded={expanded}
      hasChildren={hasChildren}
      label={label}
      onToggle={onToggle}
    />
  );
}

export function merchSalesTreeNodeMatchesQuery(
  node: MerchSalesTreeNode,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const dateText = node.date ? formatDate(node.date) : "";
  const matchLabel = `${node.label} ${dateText}`.toLowerCase().trim();
  return matchLabel.includes(q);
}

const MERCH_SALES_COLUMNS: ColumnDef<MerchSalesFlatRow, unknown>[] = [
  {
    accessorKey: "eventLabel",
    accessorFn: (row) => row.label,
    header: "Мероприятие",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as MerchSalesTableMeta;
      const expanded = meta.expandedSet.has(item.id);
      return (
        <div
          className="flex min-w-0 items-center gap-2.5"
          style={{ paddingLeft: item.depth * 16 }}
        >
          <MerchSalesExpandButton
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
    cell: ({ row }) => {
      const item = row.original;
      const planPct = merchSalesPlanFulfillmentPct(
        item.revenue,
        item.planRevenue,
      );
      return (
        <InlineBarCell
          value={item.revenue}
          max={100}
          share={planPct ?? undefined}
          formatted={formatCurrency(item.revenue)}
          showFill={planPct !== null}
          barClassName={getBarClass(item.level, "bg-rose-400", "bg-rose-300", "bg-rose-200")}
        />
      );
    },
  },
  {
    accessorKey: "planFulfillment",
    accessorFn: (row) =>
      merchSalesPlanFulfillmentPct(row.revenue, row.planRevenue),
    header: "Выполнение плана",
    cell: ({ row }) => {
      const pct = merchSalesPlanFulfillmentPct(
        row.original.revenue,
        row.original.planRevenue,
      );
      return pct !== null ? formatPercent(pct) : "—";
    },
  },
  {
    accessorKey: "avgCheck",
    header: "Средний чек",
    cell: ({ row, table }) => {
      const { barMax } = table.options.meta as MerchSalesTableMeta;
      return (
        <InlineBarCell
          value={row.original.avgCheck}
          max={barMax.avgCheck}
          formatted={formatCurrency(row.original.avgCheck)}
          barClassName={getBarClass(
            row.original.level,
            "bg-amber-500",
            "bg-amber-300",
            "bg-amber-200",
          )}
        />
      );
    },
  },
  {
    accessorKey: "receipts",
    header: "Чеки",
    cell: ({ row, table }) => {
      const { barMax } = table.options.meta as MerchSalesTableMeta;
      return (
        <InlineBarCell
          value={row.original.receipts}
          max={barMax.receipts}
          formatted={formatNumber(row.original.receipts)}
          barClassName={getBarClass(
            row.original.level,
            "bg-slate-400",
            "bg-slate-300",
            "bg-slate-200",
          )}
        />
      );
    },
  },
  {
    accessorKey: "units",
    header: "Товары",
    cell: ({ row, table }) => {
      const { barMax } = table.options.meta as MerchSalesTableMeta;
      return (
        <InlineBarCell
          value={row.original.units}
          max={barMax.units}
          formatted={`${formatNumber(row.original.units)} шт`}
          barClassName={getBarClass(
            row.original.level,
            "bg-emerald-500",
            "bg-emerald-300",
            "bg-emerald-200",
          )}
        />
      );
    },
  },
  {
    accessorKey: "upt",
    header: "UPT",
    cell: ({ row }) => formatUpt(row.original.upt),
  },
  {
    accessorKey: "purchaseConversionPct",
    header: "Конверсия в покупку",
    cell: ({ row, table }) => {
      if (row.original.level !== "match" && row.original.level !== "section") {
        return "—";
      }
      if (row.original.attendance <= 0) {
        return "—";
      }
      const { barMax } = table.options.meta as MerchSalesTableMeta;
      return (
        <InlineBarCell
          value={row.original.purchaseConversionPct}
          max={barMax.purchaseConversionPct}
          formatted={formatPercent(row.original.purchaseConversionPct)}
          compactLabels
          barClassName={getBarClass(
            row.original.level,
            "bg-blue-400",
            "bg-blue-200",
            "bg-blue-100",
          )}
        />
      );
    },
  },
];

function summaryFromMatchNodes(nodes: MerchSalesTreeNode[]) {
  if (nodes.length === 0) return null;

  const totalRevenue = nodes.reduce((sum, row) => sum + row.revenue, 0);
  const totalPlanRevenue = nodes.reduce(
    (sum, row) => sum + (row.planRevenue ?? 0),
    0,
  );
  const totalReceipts = nodes.reduce((sum, row) => sum + row.receipts, 0);
  const totalUnits = nodes.reduce((sum, row) => sum + row.units, 0);
  const totalAttendance = nodes.reduce((sum, row) => sum + row.attendance, 0);
  const matchReceipts = nodes
    .filter((row) => row.attendance > 0)
    .reduce((sum, row) => sum + row.receipts, 0);
  const avgCheck = totalReceipts > 0 ? totalRevenue / totalReceipts : 0;
  const upt = totalReceipts > 0 ? totalUnits / totalReceipts : 0;
  const purchaseConversionPct =
    totalAttendance > 0 ? (matchReceipts / totalAttendance) * 100 : 0;
  const planPct = merchSalesPlanFulfillmentPct(totalRevenue, totalPlanRevenue);

  return (
    <tr>
      <td className="px-3 py-2.5">Итого</td>
      <td className="px-3 py-2.5" />
      <td className="px-3 py-2.5">{formatCurrency(totalRevenue)}</td>
      <td className="px-3 py-2.5">
        {planPct !== null ? formatPercent(planPct) : "—"}
      </td>
      <td className="px-3 py-2.5">{formatCurrency(avgCheck)}</td>
      <td className="px-3 py-2.5">{formatNumber(totalReceipts)}</td>
      <td className="px-3 py-2.5">{formatNumber(totalUnits)} шт</td>
      <td className="px-3 py-2.5">{formatUpt(upt)}</td>
      <td className="px-3 py-2.5">{formatPercent(purchaseConversionPct)}</td>
    </tr>
  );
}

export const MerchSalesTableView = memo(function MerchSalesTableView({
  treeState,
}: {
  treeState: MerchSalesTreeState;
}) {
  const { tree, expandedSet, toggleExpanded, barMax } = treeState;
  const [sorting, setSorting] = useState<SortingState>([
    { id: "revenue", desc: true },
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const sort = sorting[0];
  const sortedTree = useMemo(
    () =>
      sortMerchSalesNodes(
        tree,
        sort && isMerchSalesSortId(sort.id)
          ? { id: sort.id, desc: sort.desc }
          : { id: "revenue", desc: true },
      ),
    [tree, sort],
  );

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return sortedTree;
    return sortedTree.filter((node) =>
      merchSalesTreeNodeMatchesQuery(node, searchQuery),
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

  const pageTree = useMerchSalesPageTree(pagination.pageItems, treeState);

  const flatRows = useMemo(
    () => flattenExpandedMerchSalesTree(pageTree, expandedSet),
    [pageTree, expandedSet],
  );

  const tableMeta = useMemo<MerchSalesTableMeta>(
    () => ({ expandedSet, toggleExpanded, barMax }),
    [expandedSet, toggleExpanded, barMax],
  );

  const table = useReactTable({
    data: flatRows,
    columns: MERCH_SALES_COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  const excelRows = useMemo(
    () => flattenExpandedMerchSalesTree(pageTree, expandedSet),
    [pageTree, expandedSet],
  );

  const excelTable = useReactTable({
    data: excelRows,
    columns: MERCH_SALES_COLUMNS,
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
      setPageIndex((value) => Math.min(pagination.pageCount - 1, value + 1)),
    [pagination.pageCount],
  );

  const summary = summaryFromMatchNodes(filteredTree);

  return (
    <Card className="flex h-full min-w-0 flex-col" data-testid="merch-sales-table">
      <CardHeader>
        <CardTitle>Продажи</CardTitle>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <TableExcelButton table={excelTable} fileName="Продажи" />
          <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по мероприятию..."
              aria-label="Поиск по мероприятию..."
              className="h-11 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] xl:h-8 sm:w-48"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col">
        <StickyScrollTable>
        <table className="w-full min-w-[84rem] table-fixed text-sm leading-snug">
          <colgroup>
            {table.getAllLeafColumns().map((column) => (
              <col key={column.id} className={COLUMN_WIDTH_CLASS[column.id]} />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[var(--border)]">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={clsx(
                      "cursor-pointer overflow-hidden px-3 py-2 text-left text-xs font-medium leading-tight text-[var(--muted)]",
                      COLUMN_WIDTH_CLASS[header.column.id],
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap">
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
                      COLUMN_WIDTH_CLASS[cell.column.id],
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
          {summary ? (
            <tfoot className="font-medium">{summary}</tfoot>
          ) : null}
        </table>
        </StickyScrollTable>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs leading-snug text-[var(--muted)]">
          <span>
            {filteredTree.length} мероприятий
          </span>
          <div className="flex items-center gap-2 leading-none">
            <button
              type="button"
              onClick={goPrev}
              disabled={pagination.pageIndex === 0}
              className="inline-flex min-h-11 items-center rounded border border-[var(--border)] px-3 py-1.5 leading-none disabled:opacity-40"
            >
              Назад
            </button>
            <span className="inline-flex min-h-11 items-center leading-none">
              {pagination.pageIndex + 1} / {pagination.pageCount}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={pagination.pageIndex >= pagination.pageCount - 1}
              className="inline-flex min-h-11 items-center rounded border border-[var(--border)] px-3 py-1.5 leading-none disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export const MerchMatchSalesTable = memo(function MerchMatchSalesTable({
  data,
}: {
  data: MerchMatchSalesRow[];
}) {
  const merchViewResetEpoch = useMerchViewResetEpoch();
  return <MerchMatchSalesTableBody key={merchViewResetEpoch} data={data} />;
});

const MerchMatchSalesTableBody = memo(function MerchMatchSalesTableBody({
  data,
}: {
  data: MerchMatchSalesRow[];
}) {
  const { appliedFilters, appliedMerchFilters } = useFilterData();
  const treeState = useMerchSalesTreeState(
    data,
    appliedFilters,
    appliedMerchFilters,
  );
  const isMobile = useIsMobileLayout();
  if (isMobile) {
    return <MerchMobileSalesCards treeState={treeState} />;
  }
  return <MerchSalesTableView treeState={treeState} />;
});

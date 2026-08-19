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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StickyScrollTable } from "@/components/ui/StickyScrollTable";
import { TreeExpandButton } from "@/components/ui/TreeExpandButton";
import { TableExcelButton } from "@/components/ui/ExcelDownloadButton";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { TicketsZoneSectorMobileCards } from "@/components/widgets/TicketsZoneSectorMobileCards";
import { useFilterData, useTicketsViewResetEpoch } from "@/context/FilterContext";
import { useIsMobileLayout } from "@/hooks/useLayoutMode";
import {
  ALL_SECTORS,
  hasAllowedFilterIntersection,
  NO_SECTORS_FILTER_VALUE,
} from "@/lib/ticket-filter-options";
import { filterMatchesByTicketFilters, filterTicketTransactions } from "@/lib/filters";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import {
  buildAvailabilityIndex,
  buildPlanIndex,
  buildZoneSectorMatchTree,
  flattenZoneSectorTree,
  hydrateZoneSectorTree,
  preAggregateZoneSector,
  type DetailMode,
  type ZoneSectorFlatRow,
  type ZoneSectorTreeContext,
  type ZoneSectorTreeNode,
} from "@/lib/tickets-zone-sector-analytics";
import type { DashboardFilters, PriceZone, Sector, TicketFilters } from "@/types/dashboard";

const EMPTY_FILTER_COMBO_MESSAGE = "Нет данных для выбранного сочетания фильтров";

const DATE_COLUMN_WIDTH_CLASS = "w-[7rem]";
const BAR_COLUMN_WIDTH_CLASS = "w-[10.5rem] max-w-[10.5rem]";
const DATE_COLUMN_SIZE = 112;
const BAR_COLUMN_SIZE = 168;

const COLUMN_WIDTH_CLASS: Record<string, string> = {
  eventLabel: "w-auto min-w-0",
  date: DATE_COLUMN_WIDTH_CLASS,
  revenue: BAR_COLUMN_WIDTH_CLASS,
  occupancy: BAR_COLUMN_WIDTH_CLASS,
};

function isMetricColumn(columnId: string): boolean {
  return columnId === "revenue" || columnId === "occupancy";
}

function columnAlignClass(columnId: string, header: boolean): string {
  if (columnId === "date") {
    return header
      ? "text-right"
      : "whitespace-nowrap text-right tabular-nums";
  }
  if (isMetricColumn(columnId)) {
    return header ? "text-left" : "";
  }
  return "text-left";
}

function ticketsQueryKey(
  filters: DashboardFilters,
  ticketFilters: TicketFilters,
): string {
  return [
    filters.dateRange,
    filters.matchId,
    ticketFilters.season,
    ticketFilters.league,
    ticketFilters.tournamentStage,
    ticketFilters.matchClass,
    ticketFilters.arena,
    ticketFilters.eventCompleted,
    ticketFilters.matchId.join(","),
    ticketFilters.ticketType,
    ticketFilters.priceZone,
    ticketFilters.orderSource,
    ticketFilters.transactionDateRange.from ?? "",
    ticketFilters.transactionDateRange.to ?? "",
  ].join("|");
}

type ZoneSectorSortId = "eventLabel" | "date" | "revenue" | "occupancy";

type ZoneSectorTableMeta = {
  expandedSet: ReadonlySet<string>;
  toggleExpanded: (id: string) => void;
  barMax: { revenue: number };
};

function isSortId(id: string): id is ZoneSectorSortId {
  return id === "eventLabel" || id === "date" || id === "revenue" || id === "occupancy";
}

function numericOrNull(value: number | null | undefined): number {
  return value ?? Number.NEGATIVE_INFINITY;
}

function barClass(
  level: ZoneSectorFlatRow["level"],
  matchClass: string,
  sectionClass: string,
  leafClass: string,
): string {
  if (level === "match") return matchClass;
  if (level === "section") return sectionClass;
  return leafClass;
}

function capOccupancyPct(occupancy: number): number {
  return Math.min(100, occupancy);
}

function NullableBar({
  value,
  max,
  formatted,
  trailingFormatted,
  share,
  barClassName,
}: {
  value: number | null;
  max: number;
  formatted: string;
  trailingFormatted?: string;
  share?: number;
  barClassName: string;
}) {
  if (value == null) return <span className="text-[var(--muted)]">—</span>;
  return (
    <InlineBarCell
      value={value}
      max={max}
      share={share}
      formatted={formatted}
      trailingFormatted={trailingFormatted}
      barClassName={barClassName}
    />
  );
}

function ExpandButton({
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

function sortTree(
  nodes: ZoneSectorTreeNode[],
  sort: { id: ZoneSectorSortId; desc: boolean },
): ZoneSectorTreeNode[] {
  const direction = sort.desc ? -1 : 1;
  return [...nodes].sort((a, b) => {
    let cmp = 0;
    switch (sort.id) {
      case "eventLabel":
        cmp = a.label.localeCompare(b.label, "ru");
        break;
      case "date":
        cmp = (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
        break;
      case "revenue":
        cmp = numericOrNull(a.revenue) - numericOrNull(b.revenue);
        break;
      case "occupancy":
        cmp = numericOrNull(a.occupancy) - numericOrNull(b.occupancy);
        break;
      default:
        break;
    }
    if (cmp !== 0) return cmp * direction;
    return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
  });
}

const COLUMNS: ColumnDef<ZoneSectorFlatRow, unknown>[] = [
  {
    accessorKey: "eventLabel",
    accessorFn: (row) => row.label,
    header: "Мероприятие",
    cell: ({ row, table }) => {
      const item = row.original;
      const meta = table.options.meta as ZoneSectorTableMeta;
      const expanded = meta.expandedSet.has(item.id);
      return (
        <div
          className="flex min-w-0 items-center gap-2"
          style={{ paddingLeft: item.depth * 16 }}
        >
          <ExpandButton
            expanded={expanded}
            hasChildren={item.hasChildren}
            label={item.label}
            onToggle={() => meta.toggleExpanded(item.id)}
          />
          <span
            className={clsx(
              "min-w-0 break-words",
              item.level === "leaf" ? "text-[var(--muted)]" : "font-medium",
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
    size: DATE_COLUMN_SIZE,
    cell: ({ row }) => (row.original.date ? formatDate(row.original.date) : ""),
  },
  {
    accessorKey: "revenue",
    header: "Выручка",
    size: BAR_COLUMN_SIZE,
    cell: ({ row, table }) => {
      const item = row.original;
      const { revenue, planRevenue } = item;
      const { barMax } = table.options.meta as ZoneSectorTableMeta;
      const fulfillmentPct =
        revenue != null && planRevenue != null && planRevenue > 0
          ? (revenue / planRevenue) * 100
          : null;
      const showPlanPct = item.level === "match";
      return (
        <NullableBar
          value={revenue}
          max={barMax.revenue}
          share={fulfillmentPct ?? undefined}
          formatted={revenue == null ? "—" : formatCurrency(revenue)}
          trailingFormatted={
            showPlanPct
              ? revenue == null
                ? undefined
                : fulfillmentPct !== null
                  ? formatPercent(fulfillmentPct)
                  : "—"
              : undefined
          }
          barClassName={barClass(item.level, "bg-rose-400", "bg-rose-300", "bg-rose-200")}
        />
      );
    },
  },
  {
    accessorKey: "occupancy",
    header: "Заполняемость",
    size: BAR_COLUMN_SIZE,
    cell: ({ row }) => {
      const item = row.original;
      const occupancy =
        item.occupancy == null ? null : capOccupancyPct(item.occupancy);
      return (
        <NullableBar
          value={occupancy}
          max={100}
          share={occupancy ?? undefined}
          formatted={occupancy == null ? "—" : formatPercent(occupancy)}
          barClassName={barClass(item.level, "bg-emerald-500", "bg-emerald-300", "bg-emerald-200")}
        />
      );
    },
  },
];

export function TicketsZoneSectorWidget() {
  const ticketsViewResetEpoch = useTicketsViewResetEpoch();
  return <TicketsZoneSectorTable key={ticketsViewResetEpoch} />;
}

function TicketsZoneSectorTable() {
  const isMobile = useIsMobileLayout();
  const { appliedFilters, appliedTicketFilters } = useFilterData();
  const queryKey = ticketsQueryKey(appliedFilters, appliedTicketFilters);
  const transactions = useMemo(
    () => filterTicketTransactions(appliedFilters, appliedTicketFilters),
    // Identity of context objects changes on every tickets-tab publish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryKey],
  );
  const matches = useMemo(
    () => filterMatchesByTicketFilters(appliedTicketFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryKey],
  );
  const matchesById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  const [mode, setMode] = useState<DetailMode>("zones_to_sectors");
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [searchQuery, setSearchQuery] = useState("");

  const globalPriceZones = useMemo<PriceZone[]>(
    () =>
      appliedTicketFilters.priceZone === "all" ? [] : [appliedTicketFilters.priceZone],
    [appliedTicketFilters.priceZone],
  );
  const filterComboValid = hasAllowedFilterIntersection(
    globalPriceZones,
    selectedSectorIds,
  );

  const agg = useMemo(
    () => preAggregateZoneSector(transactions, matchesById),
    [transactions, matchesById],
  );
  const availability = useMemo(
    () => buildAvailabilityIndex(matchesById, agg),
    [matchesById, agg],
  );
  const planIndex = useMemo(
    () => buildPlanIndex(matchesById),
    [matchesById],
  );

  const treeContext = useMemo<ZoneSectorTreeContext>(
    () => ({
      agg,
      availability,
      matchesById,
      localMatchIds: [],
      localPriceZones: globalPriceZones,
      localSectors: selectedSectorIds as Sector[],
      planIndex,
    }),
    [agg, availability, matchesById, globalPriceZones, selectedSectorIds, planIndex],
  );

  const tree = useMemo(
    () => (filterComboValid ? buildZoneSectorMatchTree(treeContext) : []),
    [filterComboValid, treeContext],
  );

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [mode]);

  const sectorOptions = [
    ...ALL_SECTORS.filter((sector) => sector === "VIP"),
    ...ALL_SECTORS.filter((sector) => sector !== "VIP"),
  ].map((sector) => ({ value: sector, label: sector }));

  const sort = sorting[0];
  const sortedTree = useMemo(
    () =>
      sortTree(
        tree,
        sort && isSortId(sort.id)
          ? { id: sort.id, desc: sort.desc }
          : { id: "date", desc: true },
      ),
    [tree, sort],
  );

  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedTree;
    return sortedTree.filter((node) => {
      const dateText = node.date ? formatDate(node.date) : "";
      return `${node.label} ${dateText}`.toLowerCase().includes(q);
    });
  }, [sortedTree, searchQuery]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pageTree = useMemo(
    () =>
      hydrateZoneSectorTree(filteredTree, {
        ...treeContext,
        mode,
      }),
    [filteredTree, treeContext, mode],
  );

  const flatRows = useMemo(
    () => flattenZoneSectorTree(pageTree, expandedKeys),
    [pageTree, expandedKeys],
  );

  const barMax = useMemo(() => {
    let revenue = 0;
    for (const node of filteredTree) {
      revenue = Math.max(revenue, node.revenue ?? 0);
    }
    return { revenue };
  }, [filteredTree]);

  const tableMeta = useMemo<ZoneSectorTableMeta>(
    () => ({ expandedSet: expandedKeys, toggleExpanded, barMax }),
    [expandedKeys, toggleExpanded, barMax],
  );

  const table = useReactTable({
    data: flatRows,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  const excelTable = useReactTable({
    data: flatRows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  const hasLocalFilters = selectedSectorIds.length > 0;

  function rowTestAttrs(row: ZoneSectorFlatRow) {
    const parentId = row.id.includes("|")
      ? row.id.slice(0, row.id.lastIndexOf("|"))
      : undefined;
    return {
      "data-tree-level": row.level,
      "data-tree-id": row.id,
      ...(row.level === "section" && row.zoneId ? { "data-parent-zone": row.zoneId } : {}),
      ...(row.level === "section" && row.sectorId ? { "data-parent-sector": row.sectorId } : {}),
      ...(row.level === "leaf" && row.zoneId ? { "data-child-zone": row.zoneId } : {}),
      ...(row.level === "leaf" && row.sectorId ? { "data-child-sector": row.sectorId } : {}),
      ...(row.level === "leaf" && parentId ? { "data-tree-parent": parentId } : {}),
    };
  }

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <CardTitle>Продажи по ценовым зонам и секторам на арене</CardTitle>
          <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по мероприятию..."
                aria-label="Поиск по мероприятию..."
                className="h-11 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] xl:h-8"
              />
            </div>
            <TableExcelButton table={excelTable} fileName="Продажи по зонам и секторам" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="md:hidden">
          <button
            type="button"
            className="min-h-11 rounded-md border border-[var(--border)] px-3 text-sm"
            onClick={() => setShowMobileFilters((value) => !value)}
          >
            Фильтры
          </button>
        </div>

        <div className={showMobileFilters ? "block" : "hidden md:block"}>
          <div className="flex flex-wrap items-end gap-2">
            <MultiSelect
              label="Секторы"
              options={sectorOptions}
              value={selectedSectorIds}
              onChange={setSelectedSectorIds}
              emptyMeansAll
              noneValue={NO_SECTORS_FILTER_VALUE}
              searchable
              searchPlaceholder="Поиск сектора..."
              selectAllLabel="Все секторы"
              allSelectedLabel="Все секторы"
            />
            {hasLocalFilters && (
              <Button
                variant="ghost"
                onClick={() => setSelectedSectorIds([])}
                className="shrink-0"
              >
                Сбросить фильтры
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--border)] p-0.5">
            <button
              type="button"
              className={clsx(
                "min-h-11 rounded px-3 text-xs xl:h-9 xl:min-h-0 xl:px-2",
                mode === "zones_to_sectors" && "bg-[var(--background)]",
              )}
              onClick={() => setMode("zones_to_sectors")}
            >
              По ценовым зонам
            </button>
            <button
              type="button"
              className={clsx(
                "min-h-11 rounded px-3 text-xs xl:h-9 xl:min-h-0 xl:px-2",
                mode === "sectors_to_zones" && "bg-[var(--background)]",
              )}
              onClick={() => setMode("sectors_to_zones")}
            >
              По секторам
            </button>
          </div>
        </div>

        {!filterComboValid && (
          <div
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-6 text-center text-sm text-[var(--muted)]"
            data-testid="zone-sector-empty-filter"
          >
            {EMPTY_FILTER_COMBO_MESSAGE}
          </div>
        )}

        {filterComboValid && (
          <>
            {isMobile ? (
              <TicketsZoneSectorMobileCards
                rows={pageTree}
                expandedSet={expandedKeys}
                toggleExpanded={toggleExpanded}
                revenueMax={barMax.revenue}
              />
            ) : (
              <div className="min-w-0">
                <StickyScrollTable>
              <table className="w-full min-w-[37rem] table-fixed text-sm leading-snug">
                <colgroup>
                  <col className={COLUMN_WIDTH_CLASS.eventLabel} />
                  <col className={COLUMN_WIDTH_CLASS.date} />
                  <col className={COLUMN_WIDTH_CLASS.revenue} />
                  <col className={COLUMN_WIDTH_CLASS.occupancy} />
                </colgroup>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-[var(--border)]">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className={clsx(
                            "cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-medium text-[var(--muted)]",
                            COLUMN_WIDTH_CLASS[header.column.id],
                            columnAlignClass(header.column.id, true),
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1",
                              header.column.id === "date" && "justify-end",
                            )}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
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
                      {...rowTestAttrs(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={clsx(
                            "px-3 py-2.5 text-[var(--foreground)]",
                            isMetricColumn(cell.column.id) && "overflow-hidden",
                            COLUMN_WIDTH_CLASS[cell.column.id],
                            columnAlignClass(cell.column.id, false),
                            cell.column.id === "eventLabel" && "relative z-[1]",
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
              </StickyScrollTable>
            </div>
            )}
            <div className="mt-3 text-xs text-[var(--muted)]">
              <span>{filteredTree.length} мероприятий</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

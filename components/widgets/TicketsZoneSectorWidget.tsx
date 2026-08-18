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
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { TableExcelButton } from "@/components/ui/ExcelDownloadButton";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useFilterData } from "@/context/FilterContext";
import {
  ALL_PRICE_ZONES,
  ALL_SECTORS,
  PRICE_ZONE_LABELS,
  hasAllowedFilterIntersection,
} from "@/lib/ticket-filter-options";
import { filterMatchesByTicketFilters, filterTicketTransactions } from "@/lib/filters";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { paginateTopLevel } from "@/lib/match-sales-tree";
import {
  buildAvailabilityIndex,
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

const PAGE_SIZE = 15;
const EMPTY_FILTER_COMBO_MESSAGE = "Нет данных для выбранного сочетания фильтров";

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
  barMax: { occupancy: number; revenue: number };
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

function NullableBar({
  value,
  max,
  formatted,
  barClassName,
}: {
  value: number | null;
  max: number;
  formatted: string;
  barClassName: string;
}) {
  if (value == null) return <span className="text-[var(--muted)]">—</span>;
  return (
    <InlineBarCell
      value={value}
      max={max}
      formatted={formatted}
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
  if (!hasChildren) {
    return <span className="inline-block w-5 shrink-0" aria-hidden />;
  }
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
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
              "whitespace-nowrap",
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
    cell: ({ row }) => (row.original.date ? formatDate(row.original.date) : ""),
  },
  {
    accessorKey: "revenue",
    header: "Выручка",
    cell: ({ row, table }) => {
      const item = row.original;
      const { barMax } = table.options.meta as ZoneSectorTableMeta;
      return (
        <NullableBar
          value={item.revenue}
          max={barMax.revenue}
          formatted={item.revenue == null ? "—" : formatCurrency(item.revenue)}
          barClassName={barClass(item.level, "bg-rose-400", "bg-rose-300", "bg-rose-200")}
        />
      );
    },
  },
  {
    accessorKey: "occupancy",
    header: "% заполняемости",
    cell: ({ row, table }) => {
      const item = row.original;
      const { barMax } = table.options.meta as ZoneSectorTableMeta;
      return (
        <NullableBar
          value={item.occupancy}
          max={Math.max(100, barMax.occupancy)}
          formatted={item.occupancy == null ? "—" : formatPercent(item.occupancy)}
          barClassName={barClass(item.level, "bg-emerald-500", "bg-emerald-300", "bg-emerald-200")}
        />
      );
    },
  },
];

export function TicketsZoneSectorWidget() {
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
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<PriceZone[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<Sector[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [invalidHint, setInvalidHint] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const filterComboValid = hasAllowedFilterIntersection(selectedZoneIds, selectedSectorIds);

  const agg = useMemo(
    () => preAggregateZoneSector(transactions, matchesById),
    [transactions, matchesById],
  );
  const availability = useMemo(() => buildAvailabilityIndex(agg), [agg]);

  const treeContext = useMemo<ZoneSectorTreeContext>(
    () => ({
      agg,
      availability,
      matchesById,
      localMatchIds: [],
      localPriceZones: selectedZoneIds,
      localSectors: selectedSectorIds,
    }),
    [agg, availability, matchesById, selectedZoneIds, selectedSectorIds],
  );

  const allTree = useMemo(
    () => (filterComboValid ? buildZoneSectorMatchTree(treeContext) : []),
    [filterComboValid, treeContext],
  );

  const tree = useMemo(
    () =>
      selectedMatchIds.length
        ? allTree.filter((node) => selectedMatchIds.includes(node.matchId))
        : allTree,
    [allTree, selectedMatchIds],
  );

  const existingMatchIds = useMemo(() => new Set(allTree.map((row) => row.matchId)), [allTree]);

  useEffect(() => {
    if (!filterComboValid) return;
    const stale = selectedMatchIds.filter((id) => !existingMatchIds.has(id));
    if (stale.length) {
      setSelectedMatchIds((prev) => prev.filter((id) => existingMatchIds.has(id)));
      setInvalidHint("Часть локально выбранных матчей снята из-за изменения глобальных фильтров.");
    }
  }, [existingMatchIds, selectedMatchIds, filterComboValid]);

  useEffect(() => {
    setExpandedKeys(new Set());
    setPageIndex(0);
  }, [mode]);

  useEffect(() => {
    setPageIndex(0);
  }, [selectedMatchIds, selectedZoneIds, selectedSectorIds, searchQuery]);

  const matchOptions = useMemo(
    () =>
      allTree.map((row) => ({
        value: row.matchId,
        label: `${row.label} · ${row.date ? formatDate(row.date) : ""}`,
      })),
    [allTree],
  );
  const zoneOptions = ALL_PRICE_ZONES.map((zone) => ({
    value: zone,
    label: PRICE_ZONE_LABELS[zone],
  }));
  const sectorOptions = ALL_SECTORS.map((sector) => ({ value: sector, label: sector }));

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

  const pagination = useMemo(
    () => paginateTopLevel(filteredTree, pageIndex, PAGE_SIZE),
    [filteredTree, pageIndex],
  );

  useEffect(() => {
    if (pageIndex !== pagination.pageIndex) setPageIndex(pagination.pageIndex);
  }, [pageIndex, pagination.pageIndex]);

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
      hydrateZoneSectorTree(pagination.pageItems, {
        ...treeContext,
        mode,
      }),
    [pagination.pageItems, treeContext, mode],
  );

  const flatRows = useMemo(
    () => flattenZoneSectorTree(pageTree, expandedKeys),
    [pageTree, expandedKeys],
  );

  const barMax = useMemo(() => {
    let occupancy = 0;
    let revenue = 0;
    for (const node of filteredTree) {
      occupancy = Math.max(occupancy, node.occupancy ?? 0);
      revenue = Math.max(revenue, node.revenue ?? 0);
    }
    return { occupancy, revenue };
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
    manualPagination: true,
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

  const goPrev = useCallback(() => setPageIndex((value) => Math.max(0, value - 1)), []);
  const goNext = useCallback(
    () => setPageIndex((value) => Math.min(pagination.pageCount - 1, value + 1)),
    [pagination.pageCount],
  );

  const activeFilterCount =
    Number(selectedMatchIds.length > 0) +
    Number(selectedZoneIds.length > 0) +
    Number(selectedSectorIds.length > 0);

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
        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-[18px] font-semibold leading-tight text-[var(--foreground)]">
              Продажи по ценовым зонам и секторам
            </h3>
            <p className="text-[13px] leading-5 text-[var(--muted)]">
              Сравнение заполняемости, продаж и выручки по матчам
            </p>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по мероприятию..."
                aria-label="Поиск по мероприятию..."
                className="h-9 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] sm:h-8 sm:w-48"
              />
            </div>
            <TableExcelButton table={excelTable} fileName="Продажи по зонам и секторам" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        <div className="md:hidden">
          <button
            type="button"
            className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
            onClick={() => setShowMobileFilters((value) => !value)}
          >
            Фильтры
          </button>
        </div>

        <div className={clsx("hidden md:block", showMobileFilters && "block")}>
          <div className="flex flex-wrap items-end gap-2">
            <MultiSelect
              label="Матчи"
              options={matchOptions}
              value={selectedMatchIds}
              onChange={setSelectedMatchIds}
              emptyMeansAll
              searchable
              searchPlaceholder="Поиск матча..."
              selectAllLabel="Все матчи"
              allSelectedLabel="Все матчи"
            />
            <MultiSelect
              label="Ценовые зоны"
              options={zoneOptions}
              value={selectedZoneIds}
              onChange={(value) => setSelectedZoneIds(value as PriceZone[])}
              emptyMeansAll
              selectAllLabel="Все зоны"
              allSelectedLabel="Все зоны"
            />
            <MultiSelect
              label="Секторы"
              options={sectorOptions}
              value={selectedSectorIds}
              onChange={(value) => setSelectedSectorIds(value as Sector[])}
              emptyMeansAll
              searchable
              searchPlaceholder="Поиск сектора..."
              selectAllLabel="Все секторы"
              allSelectedLabel="Все секторы"
            />
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                onClick={() => {
                  setSelectedMatchIds([]);
                  setSelectedZoneIds([]);
                  setSelectedSectorIds([]);
                  setInvalidHint(null);
                }}
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--border)] p-0.5">
            <button
              type="button"
              className={clsx(
                "h-9 rounded px-2 text-xs",
                mode === "zones_to_sectors" && "bg-[var(--background)]",
              )}
              onClick={() => setMode("zones_to_sectors")}
            >
              По ценовым зонам
            </button>
            <button
              type="button"
              className={clsx(
                "h-9 rounded px-2 text-xs",
                mode === "sectors_to_zones" && "bg-[var(--background)]",
              )}
              onClick={() => setMode("sectors_to_zones")}
            >
              По секторам
            </button>
          </div>
          {activeFilterCount > 0 && (
            <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs">
              Фильтры · {activeFilterCount}
            </span>
          )}
        </div>
        {invalidHint && <p className="text-xs text-amber-700">{invalidHint}</p>}

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
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-[var(--border)]">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-[var(--muted)]"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="inline-flex items-center gap-1">
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
        )}
      </CardContent>
    </Card>
  );
}

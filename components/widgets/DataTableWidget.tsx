"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { RowsExcelButton, TableExcelButton } from "@/components/ui/ExcelDownloadButton";
import { getMatchLabel } from "@/lib/mock/hockey";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { occupancyMassCapacity } from "@/lib/ticket-plan";
import { SUBSCRIPTION_CHANNEL_LABELS } from "@/lib/subscription-filter-options";
import {
  ORDER_SOURCE_LABELS,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-filter-options";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { getMerchSalesPointLabel } from "@/lib/merch-filter-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MobileRecordCard } from "@/components/ui/MobileRecordCard";
import { StickyScrollTable } from "@/components/ui/StickyScrollTable";
import { useIsMobileLayout } from "@/hooks/useLayoutMode";
import type {
  CombinedMatchSalesRow,
  MerchSkuSalesRow,
  Subscription,
  Transaction,
} from "@/types/dashboard";

export {
  MatchSalesTable,
  ResponsiveMatchSalesTable,
} from "@/components/widgets/MatchSalesTable";
export {
  MerchMatchSalesTable,
  MerchSalesTableView,
} from "@/components/widgets/MerchMatchSalesTable";

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  expired: "Истёк",
  fully_used: "Исчерпан",
  cancelled: "Отменён",
};

function MobileTableCards<T>({
  table,
  titleKey,
  dateKey,
}: {
  table: Table<T>;
  titleKey: string;
  dateKey?: string;
}) {
  const rows = table.getRowModel().rows;
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">Нет данных</p>
    );
  }

  return (
    <div className="space-y-3" data-testid="mobile-table-cards">
      {rows.map((row) => {
        const cells = row.getVisibleCells();
        const titleCell = cells.find((cell) => cell.column.id === titleKey) ?? cells[0];
        const rest = cells.filter(
          (cell) =>
            cell.column.id !== titleCell.column.id &&
            cell.column.id !== dateKey,
        );
        const kpis = rest.slice(0, 4).map((cell) => ({
          label: String(cell.column.columnDef.header ?? cell.column.id),
          value: flexRender(cell.column.columnDef.cell, cell.getContext()),
        }));
        const details = rest.slice(4).map((cell) => ({
          label: String(cell.column.columnDef.header ?? cell.column.id),
          value: flexRender(cell.column.columnDef.cell, cell.getContext()),
        }));
        const dateCell = dateKey
          ? cells.find((cell) => cell.column.id === dateKey)
          : undefined;

        return (
          <MobileRecordCard
            key={row.id}
            title={flexRender(
              titleCell.column.columnDef.cell,
              titleCell.getContext(),
            )}
            subtitle={
              dateCell
                ? flexRender(
                    dateCell.column.columnDef.cell,
                    dateCell.getContext(),
                  )
                : undefined
            }
            kpis={kpis}
            details={details}
          />
        );
      })}
    </div>
  );
}

type DataTableProps<T> = {
  title: string;
  data: T[];
  columns: ColumnDef<T, unknown>[];
  searchPlaceholder?: string;
  titleKey?: string;
  dateKey?: string;
};

function DataTable<T>({
  title,
  data,
  columns,
  searchPlaceholder = "Поиск...",
  titleKey,
  dateKey,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const isMobile = useIsMobileLayout();

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const firstColumnId =
    (columns[0] && "accessorKey" in columns[0]
      ? String(columns[0].accessorKey)
      : columns[0]?.id) ?? "id";

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <TableExcelButton table={table} fileName={title} />
          <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] xl:h-8 xl:w-48"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          <MobileTableCards
            table={table}
            titleKey={titleKey ?? firstColumnId}
            dateKey={dateKey}
          />
        ) : (
          <StickyScrollTable>
            <table className="w-full min-w-[40rem] text-sm leading-snug">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[var(--border)]">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer px-3 py-2 text-left text-xs font-medium leading-snug text-[var(--muted)]"
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
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 text-[var(--foreground)]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
            </table>
          </StickyScrollTable>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-snug text-[var(--muted)]">
          <span>
            {table.getFilteredRowModel().rows.length} записей
          </span>
          <div className="flex items-center gap-2 leading-none">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex min-h-11 items-center rounded border border-[var(--border)] px-3 py-1.5 leading-none disabled:opacity-40"
            >
              Назад
            </button>
            <span className="inline-flex min-h-11 items-center leading-none">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex min-h-11 items-center rounded border border-[var(--border)] px-3 py-1.5 leading-none disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type MerchSalesTableProps<T> = {
  title: string;
  data: T[];
  columns: ColumnDef<T, unknown>[];
  searchPlaceholder: string;
  countLabel: string;
  defaultSort: SortingState;
  summaryRow?: (data: T[]) => ReactNode;
  pageSize?: number;
  titleKey?: string;
  dateKey?: string;
  /** Stretch to the grid row (taller neighbor). Off = hug the current page of rows. */
  fillHeight?: boolean;
};

function MerchSalesTable<T>({
  title,
  data,
  columns,
  searchPlaceholder,
  countLabel,
  defaultSort,
  summaryRow,
  pageSize = 10,
  titleKey,
  dateKey,
  fillHeight = true,
}: MerchSalesTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSort);
  const [globalFilter, setGlobalFilter] = useState("");
  const isMobile = useIsMobileLayout();

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const filteredRows = table.getFilteredRowModel().rows;
  const summary = summaryRow?.(filteredRows.map((row) => row.original));
  const firstColumnId =
    (columns[0] && "accessorKey" in columns[0]
      ? String(columns[0].accessorKey)
      : columns[0]?.id) ?? "id";

  return (
    <Card
      className={clsx(
        "min-w-0 w-full",
        fillHeight && "flex h-full flex-col",
      )}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <TableExcelButton table={table} fileName={title} />
          <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] xl:h-8 xl:w-48"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={clsx("min-w-0", fillHeight && "flex flex-1 flex-col")}
      >
        {isMobile ? (
          <MobileTableCards
            table={table}
            titleKey={titleKey ?? firstColumnId}
            dateKey={dateKey}
          />
        ) : (
          <StickyScrollTable>
            <table className="w-full min-w-[52rem] text-sm leading-snug">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[var(--border)]">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer px-3 py-2 text-left text-xs font-medium leading-snug text-[var(--muted)]"
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
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 text-[var(--foreground)]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {summary}
          </tbody>
            </table>
          </StickyScrollTable>
        )}
        <div
          className={clsx(
            "flex flex-wrap items-center justify-between gap-2 text-xs leading-snug text-[var(--muted)]",
            fillHeight ? "mt-auto pt-3" : "mt-3",
          )}
        >
          <span>
            {filteredRows.length} {countLabel}
          </span>
          <div className="flex items-center gap-2 leading-none">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex min-h-11 items-center rounded border border-[var(--border)] px-3 py-1.5 leading-none disabled:opacity-40"
            >
              Назад
            </button>
            <span className="inline-flex min-h-11 items-center leading-none">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex min-h-11 items-center rounded border border-[var(--border)] px-3 py-1.5 leading-none disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CombinedMatchSalesTable({
  data,
}: {
  data: CombinedMatchSalesRow[];
}) {
  const maxValues = useMemo(
    () => ({
      totalRevenue: Math.max(...data.map((row) => row.totalRevenue), 0),
      ticketRevenue: Math.max(...data.map((row) => row.ticketRevenue), 0),
      merchRevenue: Math.max(...data.map((row) => row.merchRevenue), 0),
      ticketsSold: Math.max(...data.map((row) => row.ticketsSold), 0),
    }),
    [data],
  );

  const columns = useMemo<ColumnDef<CombinedMatchSalesRow, unknown>[]>(
    () => [
      {
        accessorKey: "eventLabel",
        header: "Мероприятие",
        cell: ({ getValue }) => (
          <span className="break-words font-medium md:whitespace-nowrap">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "date",
        header: "Дата",
        cell: ({ getValue }) => formatDate(getValue<Date>()),
        sortingFn: (rowA, rowB) =>
          rowA.original.date.getTime() - rowB.original.date.getTime(),
      },
      {
        accessorKey: "ticketRevenue",
        header: "Билеты",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.ticketRevenue}
            formatted={formatCurrency(getValue<number>())}
            barClassName="bg-red-400"
          />
        ),
      },
      {
        accessorKey: "merchRevenue",
        header: "Мерч",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.merchRevenue}
            formatted={formatCurrency(getValue<number>())}
            barClassName="bg-[var(--accent)]"
          />
        ),
      },
      {
        accessorKey: "totalRevenue",
        header: "Итого",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.totalRevenue}
            formatted={formatCurrency(getValue<number>())}
            barClassName="bg-emerald-500"
          />
        ),
      },
      {
        accessorKey: "ticketsSold",
        header: "Билеты, шт",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.ticketsSold}
            formatted={`${formatNumber(getValue<number>())} шт`}
            barClassName="bg-gray-300"
          />
        ),
      },
      {
        accessorKey: "fillRate",
        header: "Заполняемость",
        cell: ({ row }) => (
          <InlineBarCell
            value={row.original.fillRate}
            max={100}
            formatted={formatPercent(row.original.fillRate)}
            barClassName="bg-emerald-500"
          />
        ),
      },
      {
        accessorKey: "merchReceipts",
        header: "Чеки мерча",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
    ],
    [maxValues],
  );

  const summaryRow = useCallback((rows: CombinedMatchSalesRow[]) => {
    if (rows.length === 0) return null;

    const ticketRevenue = rows.reduce((sum, row) => sum + row.ticketRevenue, 0);
    const merchRevenue = rows.reduce((sum, row) => sum + row.merchRevenue, 0);
    const totalRevenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0);
    const ticketsSold = rows.reduce((sum, row) => sum + row.ticketsSold, 0);
    const totalIssued = rows.reduce((sum, row) => sum + row.issuedTickets, 0);
    const totalOccupancyMass = rows.reduce(
      (sum, row) => sum + occupancyMassCapacity(row.capacity),
      0,
    );
    const fillRate =
      totalOccupancyMass > 0
        ? Math.min(100, (totalIssued / totalOccupancyMass) * 100)
        : 0;
    const merchReceipts = rows.reduce((sum, row) => sum + row.merchReceipts, 0);

    return (
      <tr className="border-t-2 border-[var(--border)] font-medium">
        <td className="px-3 py-2.5">Итого</td>
        <td className="px-3 py-2.5" />
        <td className="px-3 py-2.5">{formatCurrency(ticketRevenue)}</td>
        <td className="px-3 py-2.5">{formatCurrency(merchRevenue)}</td>
        <td className="px-3 py-2.5">{formatCurrency(totalRevenue)}</td>
        <td className="px-3 py-2.5">{formatNumber(ticketsSold)} шт</td>
        <td className="px-3 py-2.5">{formatPercent(fillRate)}</td>
        <td className="px-3 py-2.5">{formatNumber(merchReceipts)}</td>
      </tr>
    );
  }, []);

  const isMobile = useIsMobileLayout();

  return isMobile ? (
    <CombinedMatchSalesMobileCards data={data} />
  ) : (
    <MerchSalesTable
          title="Продажи по матчам"
          data={data}
          columns={columns}
          searchPlaceholder="Поиск по мероприятию..."
          countLabel="мероприятий"
          defaultSort={[{ id: "date", desc: true }]}
          summaryRow={summaryRow}
          pageSize={15}
          titleKey="eventLabel"
          dateKey="date"
        />
  );
}

const COMBINED_MATCH_SALES_EXCEL_HEADERS = [
  "Мероприятие",
  "Дата",
  "Билеты",
  "Мерч",
  "Итого",
  "Билеты, шт",
  "Заполняемость",
  "Чеки мерча",
];

function CombinedMatchSalesMobileCards({
  data,
}: {
  data: CombinedMatchSalesRow[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => row.eventLabel.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageIndex = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    pageIndex * pageSize,
    pageIndex * pageSize + pageSize,
  );

  const excelRows = useMemo(
    () =>
      filtered.map((row) => [
        row.eventLabel,
        formatDate(row.date),
        row.ticketRevenue,
        row.merchRevenue,
        row.totalRevenue,
        row.ticketsSold,
        Math.round(row.fillRate * 10) / 10,
        row.merchReceipts,
      ]),
    [filtered],
  );

  return (
    <Card className="min-w-0" data-testid="combined-mobile-sales-cards">
      <CardHeader>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
          <CardTitle>Продажи по матчам</CardTitle>
          <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Поиск по мероприятию..."
                aria-label="Поиск по мероприятию..."
                className="h-11 w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <RowsExcelButton
              fileName="Продажи по матчам"
              headers={COMBINED_MATCH_SALES_EXCEL_HEADERS}
              rows={excelRows}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pageItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Нет данных</p>
        ) : (
          pageItems.map((row) => (
            <MobileRecordCard
              key={row.matchId}
              title={row.eventLabel}
              subtitle={formatDate(row.date)}
              kpis={[
                { label: "Билеты", value: formatCurrency(row.ticketRevenue) },
                { label: "Мерч", value: formatCurrency(row.merchRevenue) },
                {
                  label: "Итого",
                  value: formatCurrency(row.totalRevenue),
                  wide: true,
                },
                {
                  label: "Билеты, шт",
                  value: `${formatNumber(row.ticketsSold)} шт`,
                },
              ]}
              details={[
                {
                  label: "Заполняемость",
                  value: formatPercent(row.fillRate),
                },
                {
                  label: "Чеки мерча",
                  value: formatNumber(row.merchReceipts),
                },
              ]}
            />
          ))
        )}
        {pageCount > 1 && (
          <div className="flex items-center justify-between pt-1 text-xs leading-none">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className={`inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 leading-none ${
                pageIndex === 0 ? "opacity-40" : ""
              }`}
            >
              Назад
            </button>
            <span className="inline-flex min-h-11 items-center leading-none text-[var(--muted)]">
              {pageIndex + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={pageIndex >= pageCount - 1}
              onClick={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
              className={`inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 leading-none ${
                pageIndex >= pageCount - 1 ? "opacity-40" : ""
              }`}
            >
              Вперёд
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MerchSkuSalesTable({ data }: { data: MerchSkuSalesRow[] }) {
  const maxValues = useMemo(
    () => ({
      units: Math.max(...data.map((row) => row.units), 0),
      revenue: Math.max(...data.map((row) => row.revenue), 0),
      receiptsWithProduct: Math.max(
        ...data.map((row) => row.receiptsWithProduct),
        0,
      ),
    }),
    [data],
  );

  const columns = useMemo<ColumnDef<MerchSkuSalesRow, unknown>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Товар",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "units",
        header: "Количество",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.units}
            formatted={`${formatNumber(getValue<number>())} шт`}
            barClassName="bg-gray-300"
          />
        ),
      },
      {
        accessorKey: "revenue",
        header: "Выручка",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.revenue}
            formatted={formatCurrency(getValue<number>())}
            barClassName="bg-[var(--primary)]"
          />
        ),
      },
      {
        accessorKey: "receiptsWithProduct",
        header: "Чеков с товаром",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.receiptsWithProduct}
            formatted={formatNumber(getValue<number>())}
            barClassName="bg-gray-300"
          />
        ),
      },
      {
        accessorKey: "marginPct",
        header: "Маржинальность",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={100}
            formatted={formatPercent(getValue<number>())}
            barClassName="bg-emerald-400"
          />
        ),
      },
      {
        accessorKey: "actualToListPricePct",
        header: "К рекоменд. цене",
        cell: ({ getValue }) => {
          const value = getValue<number>();
          return (
            <InlineBarCell
              value={value}
              max={100}
              formatted={formatPercent(value)}
              barClassName="bg-[var(--accent)]"
            />
          );
        },
      },
    ],
    [maxValues],
  );

  return (
    <MerchSalesTable
      title="Продажи по SKU"
      data={data}
      columns={columns}
      searchPlaceholder="Поиск по товару..."
      countLabel="товаров"
      defaultSort={[{ id: "units", desc: true }]}
      pageSize={10}
      titleKey="productName"
      fillHeight={false}
    />
  );
}

export function TransactionsTable({
  data,
  title,
  variant = "merch",
}: {
  data: Transaction[];
  title: string;
  variant?: "tickets" | "merch";
}) {
  const columns = useMemo<ColumnDef<Transaction, unknown>[]>(
    () => {
      const base: ColumnDef<Transaction, unknown>[] = [
        {
          accessorKey: "date",
          header: "Дата",
          cell: ({ getValue }) => formatDate(getValue<Date>()),
        },
        {
          accessorKey: "description",
          header: "Описание",
        },
      ];

      if (variant === "tickets") {
        base.push(
          {
            id: "ticketType",
            accessorFn: (row) =>
              row.ticketType ? TICKET_TYPE_LABELS[row.ticketType] : "—",
            header: "Тип билета",
          },
          {
            id: "sector",
            accessorFn: (row) => row.sector ?? "—",
            header: "Сектор",
          },
          {
            id: "priceZone",
            accessorFn: (row) =>
              row.priceZone ? PRICE_ZONE_LABELS[row.priceZone] : "—",
            header: "Ценовая зона",
          },
        );
      }

      base.push(
        {
          id: "match",
          accessorFn: (row) =>
            row.matchId ? getMatchLabel(row.matchId) : "—",
          header: "Матч",
        },
      );

      if (variant === "tickets") {
        base.push({
          id: "orderSource",
          accessorFn: (row) =>
            row.orderSource ? ORDER_SOURCE_LABELS[row.orderSource] : "—",
          header: "Источник заказа",
        });
      } else {
        base.push({
          id: "merchSalesPoint",
          accessorFn: (row) => getMerchSalesPointLabel(row.merchSalesPoint),
          header: "Канал продаж",
        });
      }

      base.push(
        {
          accessorKey: "quantity",
          header: "Кол-во",
        },
        {
          accessorKey: "amount",
          header: "Сумма",
          cell: ({ getValue }) => formatCurrency(getValue<number>()),
        },
      );

      return base;
    },
    [variant],
  );

  return (
    <DataTable
      title={title}
      data={data}
      columns={columns}
      searchPlaceholder="Поиск по описанию..."
      titleKey="description"
      dateKey="date"
    />
  );
}

export function SubscriptionsTable({ data }: { data: Subscription[] }) {
  const columns = useMemo<ColumnDef<Subscription, unknown>[]>(
    () => [
      {
        accessorKey: "purchasedAt",
        header: "Дата покупки",
        cell: ({ getValue }) => formatDate(getValue<Date>()),
      },
      {
        accessorKey: "planName",
        header: "Тариф",
      },
      {
        id: "usage",
        accessorFn: (row) => `${row.matchesUsed} / ${row.matchesTotal}`,
        header: "Использовано",
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: "validTo",
        header: "Действует до",
        cell: ({ getValue }) =>
          format(getValue<Date>(), "dd.MM.yyyy", { locale: ru }),
      },
      {
        id: "channel",
        accessorFn: (row) =>
          SUBSCRIPTION_CHANNEL_LABELS[row.channel] ?? row.channel,
        header: "Канал",
      },
      {
        id: "status",
        accessorFn: (row) => STATUS_LABELS[row.status] ?? row.status,
        header: "Статус",
      },
      {
        accessorKey: "price",
        header: "Сумма",
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
    ],
    [],
  );

  return (
    <DataTable
      title="Реестр абонементов"
      data={data}
      columns={columns}
      searchPlaceholder="Поиск по тарифу..."
      titleKey="planName"
      dateKey="purchasedAt"
    />
  );
}

"use client";

import clsx from "clsx";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { TableExcelButton } from "@/components/ui/ExcelDownloadButton";
import { getMatchLabel } from "@/lib/mock/hockey";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { SUBSCRIPTION_CHANNEL_LABELS } from "@/lib/subscription-filter-options";
import {
  ORDER_SOURCE_LABELS,
  PRICE_ZONE_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-filter-options";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { getMerchSalesPointLabel } from "@/lib/merch-filter-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  CombinedMatchSalesRow,
  MerchMatchSalesRow,
  MerchSkuSalesRow,
  Subscription,
  Transaction,
} from "@/types/dashboard";

export {
  MatchSalesTable,
  ResponsiveMatchSalesTable,
} from "@/components/widgets/MatchSalesTable";

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  expired: "Истёк",
  fully_used: "Исчерпан",
  cancelled: "Отменён",
};

type DataTableProps<T> = {
  title: string;
  data: T[];
  columns: ColumnDef<T, unknown>[];
  searchPlaceholder?: string;
};

function DataTable<T>({
  title,
  data,
  columns,
  searchPlaceholder = "Поиск...",
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

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

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <TableExcelButton table={table} fileName={title} />
          <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] sm:h-8 sm:w-48"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>
            {table.getFilteredRowModel().rows.length} записей
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
            >
              Назад
            </button>
            <span>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatUpt(value: number): string {
  return value.toFixed(2).replace(".", ",");
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
}: MerchSalesTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSort);
  const [globalFilter, setGlobalFilter] = useState("");

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

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <TableExcelButton table={table} fileName={title} />
          <div className="relative min-w-0 flex-1 sm:w-auto sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full max-w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)] sm:h-8 sm:w-48"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-x-auto">
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
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-[var(--muted)]">
          <span>
            {filteredRows.length} {countLabel}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
            >
              Назад
            </button>
            <span>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded border border-[var(--border)] px-3 py-1.5 disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MerchMatchSalesTable({
  data,
}: {
  data: MerchMatchSalesRow[];
}) {
  const maxValues = useMemo(
    () => ({
      revenue: Math.max(...data.map((row) => row.revenue), 0),
      avgCheck: Math.max(...data.map((row) => row.avgCheck), 0),
      receipts: Math.max(...data.map((row) => row.receipts), 0),
      units: Math.max(...data.map((row) => row.units), 0),
    }),
    [data],
  );

  const columns = useMemo<ColumnDef<MerchMatchSalesRow, unknown>[]>(
    () => [
      {
        accessorKey: "eventLabel",
        header: "Мероприятие",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "date",
        header: "Дата",
        cell: ({ getValue }) => formatDate(getValue<Date>()),
      },
      {
        accessorKey: "revenue",
        header: "Выручка",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.revenue}
            formatted={formatCurrency(getValue<number>())}
            barClassName="bg-red-400"
          />
        ),
      },
      {
        accessorKey: "avgCheck",
        header: "Средний чек",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.avgCheck}
            formatted={formatCurrency(getValue<number>())}
            barClassName="bg-red-300"
          />
        ),
      },
      {
        accessorKey: "receipts",
        header: "Чеки",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={maxValues.receipts}
            formatted={formatNumber(getValue<number>())}
            barClassName="bg-gray-300"
          />
        ),
      },
      {
        accessorKey: "units",
        header: "Товары",
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
        accessorKey: "upt",
        header: "UPT",
        cell: ({ getValue }) => formatUpt(getValue<number>()),
      },
      {
        accessorKey: "purchaseConversionPct",
        header: "Конверсия в покупку",
        cell: ({ getValue }) => (
          <InlineBarCell
            value={getValue<number>()}
            max={100}
            formatted={formatPercent(getValue<number>())}
            barClassName="bg-[var(--accent)]"
          />
        ),
      },
    ],
    [maxValues],
  );

  const summaryRow = useCallback((rows: MerchMatchSalesRow[]) => {
    if (rows.length === 0) return null;

    const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalReceipts = rows.reduce((sum, row) => sum + row.receipts, 0);
    const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
    const totalAttendance = rows.reduce((sum, row) => sum + row.attendance, 0);
    const matchReceipts = rows
      .filter((row) => row.attendance > 0)
      .reduce((sum, row) => sum + row.receipts, 0);
    const avgCheck = totalReceipts > 0 ? totalRevenue / totalReceipts : 0;
    const upt = totalReceipts > 0 ? totalUnits / totalReceipts : 0;
    const purchaseConversionPct =
      totalAttendance > 0 ? (matchReceipts / totalAttendance) * 100 : 0;

    return (
      <tr className="border-t-2 border-[var(--border)] bg-[var(--background)] font-medium">
        <td className="px-3 py-2.5">Итого</td>
        <td className="px-3 py-2.5" />
        <td className="px-3 py-2.5">{formatCurrency(totalRevenue)}</td>
        <td className="px-3 py-2.5">{formatCurrency(avgCheck)}</td>
        <td className="px-3 py-2.5">{formatNumber(totalReceipts)}</td>
        <td className="px-3 py-2.5">{formatNumber(totalUnits)} шт</td>
        <td className="px-3 py-2.5">{formatUpt(upt)}</td>
        <td className="px-3 py-2.5">{formatPercent(purchaseConversionPct)}</td>
      </tr>
    );
  }, []);

  return (
    <MerchSalesTable
      title="Продажи по матчам на основной арене"
      data={data}
      columns={columns}
      searchPlaceholder="Поиск по мероприятию..."
      countLabel="мероприятий"
      defaultSort={[{ id: "revenue", desc: true }]}
      summaryRow={summaryRow}
      pageSize={10}
    />
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
          <span className="whitespace-nowrap font-medium">{getValue<string>()}</span>
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
    const totalCapacity = rows.reduce((sum, row) => sum + row.capacity, 0);
    const fillRate = totalCapacity > 0 ? (totalIssued / totalCapacity) * 100 : 0;
    const merchReceipts = rows.reduce((sum, row) => sum + row.merchReceipts, 0);

    return (
      <tr className="border-t-2 border-[var(--border)] bg-[var(--background)] font-medium">
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

  return (
    <MerchSalesTable
      title="Продажи по матчам"
      data={data}
      columns={columns}
      searchPlaceholder="Поиск по мероприятию..."
      countLabel="мероприятий"
      defaultSort={[{ id: "date", desc: true }]}
      summaryRow={summaryRow}
      pageSize={15}
    />
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
    />
  );
}

"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { MatchSalesRow } from "@/types/dashboard";

export function MobileSalesCards({ data }: { data: MatchSalesRow[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = query
      ? data.filter((row) => row.eventLabel.toLowerCase().includes(query))
      : data;
    return [...rows].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Продажи</CardTitle>
        <div className="relative mt-2 w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Поиск по мероприятию"
            className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pageRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            Нет данных
          </p>
        ) : (
          pageRows.map((row) => {
            const fillPct =
              row.capacity > 0 ? (row.issuedTickets / row.capacity) * 100 : 0;
            const revenueFulfillmentPct =
              row.planRevenue > 0 ? (row.revenue / row.planRevenue) * 100 : null;

            return (
              <article
                key={row.matchId}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {row.eventLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {formatDate(row.date)}
                  </p>
                </div>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="col-span-2">
                    <dt className="text-[var(--muted)]">Выручка</dt>
                    <dd className="font-medium text-[var(--foreground)]">
                      {formatCurrency(row.revenue)}
                      {revenueFulfillmentPct !== null && (
                        <span className="ml-1.5 font-normal text-[var(--muted)]">
                          ({formatPercent(revenueFulfillmentPct)})
                        </span>
                      )}
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
                    <dt className="text-[var(--muted)]">Оформлено</dt>
                    <dd className="text-[var(--foreground)]">
                      {formatNumber(row.issuedTickets)} шт (
                      {formatPercent(fillPct)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Скидка ПЛ</dt>
                    <dd className="text-[var(--foreground)]">
                      {row.loyaltyDiscountPct.toFixed(1)}%
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className={clsx(
                "min-h-10 rounded-md border border-[var(--border)] px-3",
                currentPage === 0 && "opacity-40",
              )}
            >
              Назад
            </button>
            <span className="text-[var(--muted)]">
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
              className={clsx(
                "min-h-10 rounded-md border border-[var(--border)] px-3",
                currentPage >= pageCount - 1 && "opacity-40",
              )}
            >
              Вперёд
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

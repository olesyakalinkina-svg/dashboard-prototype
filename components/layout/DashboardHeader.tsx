"use client";

import { RefreshCw } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { useFilterState } from "@/context/FilterContext";
import { MOCK_TODAY } from "@/lib/mock/hockey";
import { Button } from "@/components/ui/Button";

export function DashboardHeader() {
  const { lastUpdated, refresh } = useFilterState();

  return (
    <header className="flex flex-col gap-3 border-b border-[var(--border)] bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">
          Аналитика хоккейного клуба
        </h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Текущая дата {formatDate(MOCK_TODAY)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {lastUpdated && (
          <span className="hidden text-xs text-[var(--muted)] sm:inline">
            Обновлено: {formatDateTime(lastUpdated)}
          </span>
        )}
        <Button variant="secondary" onClick={refresh} className="w-full sm:w-auto">
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Обновить
        </Button>
      </div>
    </header>
  );
}

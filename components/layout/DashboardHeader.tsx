"use client";

import { RefreshCw } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { useFilterState } from "@/context/FilterContext";
import { MOCK_TODAY } from "@/lib/mock/constants";
import { Button } from "@/components/ui/Button";

export function DashboardHeader() {
  const { lastUpdated, refresh } = useFilterState();

  return (
    <header className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-white px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0 flex-1 overflow-hidden">
        <h1 className="truncate text-base font-semibold leading-snug text-[var(--foreground)] sm:text-xl">
          Аналитика хоккейного клуба
        </h1>
        <p className="mt-0.5 hidden truncate text-xs leading-snug text-[var(--muted)] min-[430px]:block sm:text-sm">
          {formatDate(MOCK_TODAY)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {lastUpdated && (
          <span className="hidden text-xs leading-snug text-[var(--muted)] xl:inline">
            Обновлено: {formatDateTime(lastUpdated)}
          </span>
        )}
        <Button
          variant="secondary"
          onClick={refresh}
          className="min-h-11 min-w-11 px-2.5 text-xs sm:px-3 sm:text-sm"
          aria-label="Обновить данные"
        >
          <RefreshCw className="h-4 w-4 md:mr-1.5" />
          <span className="hidden md:inline">Обновить</span>
        </Button>
      </div>
    </header>
  );
}

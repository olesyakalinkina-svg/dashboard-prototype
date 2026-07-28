"use client";

import { RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { useFilters } from "@/context/FilterContext";
import { Button } from "@/components/ui/Button";

export function DashboardHeader() {
  const { lastUpdated, refresh } = useFilters();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Аналитика хоккейного клуба
        </h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Сезон 2025/26 · Домашние матчи и коммерция арены
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--muted)]">
          Обновлено: {formatDateTime(lastUpdated)}
        </span>
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Обновить
        </Button>
      </div>
    </header>
  );
}

"use client";

import { formatDate } from "@/lib/format";
import { MOCK_TODAY } from "@/lib/mock/constants";

export function DashboardHeader() {
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
    </header>
  );
}

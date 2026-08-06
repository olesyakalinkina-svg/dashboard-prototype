"use client";

import clsx from "clsx";
import { useFilterState } from "@/context/FilterContext";
import type { DashboardTab } from "@/types/dashboard";

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "tickets", label: "Билеты" },
  { id: "merch", label: "Мерч" },
  { id: "subscriptions", label: "Абонементы" },
  { id: "matches", label: "Матчи" },
];

export function DashboardTabs() {
  const { activeTab, setActiveTab } = useFilterState();

  return (
    <div className="min-w-0 border-b border-[var(--border)] bg-white">
      <div className="scrollbar-hide flex gap-1 overflow-x-auto px-4 sm:px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "relative shrink-0 whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
              "min-h-11",
              activeTab === tab.id
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

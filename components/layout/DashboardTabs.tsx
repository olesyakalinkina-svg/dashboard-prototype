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
    <div className="flex gap-1 border-b border-[var(--border)] bg-white px-4 sm:px-6">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={clsx(
            "relative min-h-11 flex-1 px-2 py-3 text-center text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm",
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
  );
}

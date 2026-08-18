"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeTab]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    function updateFade() {
      const el = scrollerRef.current;
      if (!el) return;
      setShowFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    }

    updateFade();
    scroller.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);
    return () => {
      scroller.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, []);

  return (
    <div className="relative min-w-0 border-b border-[var(--border)] bg-white">
      <div
        ref={scrollerRef}
        className="scrollbar-hide flex flex-nowrap gap-1 overflow-x-auto px-4 sm:px-6"
        data-testid="dashboard-tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={activeTab === tab.id ? activeRef : undefined}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "relative shrink-0 whitespace-nowrap px-3 py-3 text-sm font-medium leading-snug transition-colors sm:px-4",
              "min-h-11 min-w-11",
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
      {showFade ? <div className="tab-strip-fade" aria-hidden /> : null}
    </div>
  );
}

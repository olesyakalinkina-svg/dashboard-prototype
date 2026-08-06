"use client";

import clsx from "clsx";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  SEASON_MATCH_COMPARISON_LEGEND_LABEL,
  SEASON_MATCH_PLAN_LEGEND_LABEL,
  SEASON_MATCH_QUICK_FILTERS,
} from "@/lib/tickets-season-match-chart";
import type {
  TicketsSeasonMatchQuickFilter,
  TicketsSeasonMatchSeriesView,
} from "@/types/dashboard";

const VISIBLE_CHIP_LINES = 4;

export function MobileMatchSelector({
  views,
  hiddenSeries,
  hoveredSeries,
  quickFilter,
  searchQuery,
  onQuickFilterChange,
  onSearchChange,
  onToggleSeries,
  onHoverSeries,
}: {
  views: TicketsSeasonMatchSeriesView[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  quickFilter: TicketsSeasonMatchQuickFilter;
  searchQuery: string;
  onQuickFilterChange: (value: TicketsSeasonMatchQuickFilter) => void;
  onSearchChange: (value: string) => void;
  onToggleSeries: (matchId: string) => void;
  onHoverSeries: (matchId: string | null) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const comparisonMode = views.some((view) => view.isSelected);
  const visibleCount = views.filter((view) => !hiddenSeries.has(view.matchId)).length;

  const previewViews = useMemo(() => {
    if (expanded) return views;
    return views.slice(0, VISIBLE_CHIP_LINES * 3);
  }, [views, expanded]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  if (views.length === 0) return null;

  return (
    <>
      <div className="mt-3 border-t border-[var(--border)] pt-3 md:hidden">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SEASON_MATCH_QUICK_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onQuickFilterChange(option.value)}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                quickFilter === option.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] bg-white text-[var(--muted)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {previewViews.map((view) => {
            const isHidden = hiddenSeries.has(view.matchId);
            const isActive = hoveredSeries === view.matchId;
            return (
              <button
                key={view.matchId}
                type="button"
                onClick={() => {
                  onToggleSeries(view.matchId);
                  onHoverSeries(isActive ? null : view.matchId);
                }}
                className={clsx(
                  "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors",
                  isHidden
                    ? "border-[var(--border)] bg-white text-[var(--muted)] opacity-50 line-through"
                    : isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] bg-white text-[var(--foreground)]",
                )}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: view.color }}
                />
                <span className="truncate">{view.legendLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-2">
          {views.length > VISIBLE_CHIP_LINES * 3 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-[10px] font-medium text-[var(--accent)]"
            >
              {expanded ? "Свернуть" : `Ещё ${views.length - previewViews.length}`}
            </button>
          )}
          <Button
            variant="secondary"
            onClick={() => setDrawerOpen(true)}
            className="ml-auto min-h-9 px-2.5 text-xs"
          >
            Матчи ({visibleCount}/{views.length})
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор матчей"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Закрыть"
          />
          <div
            className="relative flex max-h-[min(85vh,640px)] flex-col rounded-t-2xl border border-[var(--border)] bg-white shadow-xl"
            style={{ paddingBottom: "var(--safe-area-bottom)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-semibold">Матчи на графике</h3>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)]"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-4 py-3">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Поиск соперника"
                className="w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-2 text-xs"
              />

              <div className="flex flex-wrap gap-1.5">
                {SEASON_MATCH_QUICK_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onQuickFilterChange(option.value)}
                    className={clsx(
                      "rounded-full border px-2.5 py-1 text-[10px] font-medium",
                      quickFilter === option.value
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted)]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {views.map((view) => {
                  const isHidden = hiddenSeries.has(view.matchId);
                  return (
                    <button
                      key={view.matchId}
                      type="button"
                      onClick={() => onToggleSeries(view.matchId)}
                      className={clsx(
                        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1.5 text-[10px]",
                        isHidden
                          ? "border-[var(--border)] text-[var(--muted)] opacity-50 line-through"
                          : "border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--foreground)]",
                      )}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: view.color }}
                      />
                      <span className="truncate">{view.legendLabel}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                <span className="inline-block h-2.5 w-2.5 rounded-full border-[3px] border-[#64748B] bg-white" />
                <span>{SEASON_MATCH_PLAN_LEGEND_LABEL}</span>
              </div>
              {comparisonMode && (
                <p className="text-[10px] text-[var(--muted)]">
                  {SEASON_MATCH_COMPARISON_LEGEND_LABEL}
                </p>
              )}
            </div>

            <div className="border-t border-[var(--border)] px-4 py-3">
              <Button
                variant="primary"
                onClick={() => setDrawerOpen(false)}
                className="min-h-11 w-full"
              >
                Готово
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

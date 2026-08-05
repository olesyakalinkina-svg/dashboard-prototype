"use client";

import clsx from "clsx";
import { SEASON_MATCH_PLAN_LEGEND_LABEL } from "@/lib/tickets-season-match-chart";
import type { TicketsSeasonMatchSeriesView } from "@/types/dashboard";

export function TicketsSeasonMatchLegend({
  views,
  hiddenSeries,
  hoveredSeries,
  onToggleSeries,
  onHoverSeries,
  mobileDropdown = false,
}: {
  views: TicketsSeasonMatchSeriesView[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  onToggleSeries: (matchId: string) => void;
  onHoverSeries: (matchId: string | null) => void;
  mobileDropdown?: boolean;
}) {
  if (views.length === 0) return null;

  if (mobileDropdown) {
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3 md:hidden">
        <label className="mb-1 block text-[11px] text-[var(--muted)]">
          Матчи на графике
        </label>
        <select
          className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-xs"
          value={hoveredSeries ?? ""}
          onChange={(event) =>
            onHoverSeries(event.target.value || null)
          }
        >
          <option value="">Все матчи</option>
          {views.map((view) => (
            <option key={view.matchId} value={view.matchId}>
              {view.legendLabel}
            </option>
          ))}
        </select>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-[3px] border-[#64748B] bg-white" />
          <span>{SEASON_MATCH_PLAN_LEGEND_LABEL}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 hidden border-t border-[var(--border)] pt-3 md:block">
      <div className="max-h-28 overflow-y-auto">
        <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {views.map((view) => {
            const isHidden = hiddenSeries.has(view.matchId);
            const isHovered = hoveredSeries === view.matchId;

            return (
              <button
                key={view.matchId}
                type="button"
                onClick={() => onToggleSeries(view.matchId)}
                onMouseEnter={() => onHoverSeries(view.matchId)}
                onMouseLeave={() => onHoverSeries(null)}
                className={clsx(
                  "inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[10px] transition-opacity",
                  isHidden && "opacity-40",
                  isHovered && "bg-[var(--background)]",
                )}
              >
                <span
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: view.color }}
                />
                <span className={clsx("truncate", isHidden && "line-through")}>
                  {view.legendLabel}
                </span>
              </button>
            );
          })}
          <div className="inline-flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-[var(--muted)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-[3px] border-[#64748B] bg-white" />
            <span>{SEASON_MATCH_PLAN_LEGEND_LABEL}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

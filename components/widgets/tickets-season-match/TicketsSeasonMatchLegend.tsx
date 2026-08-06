"use client";

import clsx from "clsx";
import {
  SEASON_MATCH_COMPARISON_LEGEND_LABEL,
  SEASON_MATCH_PLAN_LEGEND_LABEL,
} from "@/lib/tickets-season-match-chart";
import type { TicketsSeasonMatchSeriesView } from "@/types/dashboard";

export function TicketsSeasonMatchLegend({
  views,
  hiddenSeries,
  hoveredSeries,
  onToggleSeries,
  onHoverSeries,
}: {
  views: TicketsSeasonMatchSeriesView[];
  hiddenSeries: Set<string>;
  hoveredSeries: string | null;
  onToggleSeries: (matchId: string) => void;
  onHoverSeries: (matchId: string | null) => void;
}) {
  if (views.length === 0) return null;

  const comparisonMode = views.some((view) => view.isSelected);
  const comparisonViews = views.filter((view) => view.isComparison);
  const primaryViews = views.filter((view) => !view.isComparison);

  const renderLegendItem = (view: TicketsSeasonMatchSeriesView) => {
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
          "flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-1.5 text-left text-xs transition-opacity",
          isHidden && "opacity-40",
          isHovered && "bg-[var(--background)]",
          view.isSelected && "font-medium",
        )}
      >
        <span
          className={clsx(
            "h-1 w-5 shrink-0 rounded-full lg:h-1.5 lg:w-6",
            view.isComparison && "opacity-70",
          )}
          style={{ backgroundColor: view.color }}
        />
        <span className={clsx("truncate", isHidden && "line-through")}>
          {view.legendLabel}
        </span>
      </button>
    );
  };

  return (
    <div className="mt-4 hidden min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-4 md:flex">
      <div
        className="grid w-full flex-1 auto-rows-min grid-cols-2 content-start gap-x-5 gap-y-3 lg:grid-cols-3 xl:grid-cols-4"
      >
        {comparisonMode ? (
          <>
            {primaryViews.map(renderLegendItem)}
            {comparisonViews.length > 0 && (
              <div className="col-span-full pt-1 text-xs text-[var(--muted)]">
                {SEASON_MATCH_COMPARISON_LEGEND_LABEL}
              </div>
            )}
            {comparisonViews.map(renderLegendItem)}
          </>
        ) : (
          views.map(renderLegendItem)
        )}
        <div className="flex w-full min-w-0 items-center gap-2 px-1.5 py-1.5 text-xs text-[var(--muted)]">
          <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-[3.5px] border-[#64748B] bg-white lg:h-4 lg:w-4 lg:border-4" />
          <span>{SEASON_MATCH_PLAN_LEGEND_LABEL}</span>
        </div>
      </div>
    </div>
  );
}

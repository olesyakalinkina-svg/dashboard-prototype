"use client";

import clsx from "clsx";
import { formatCurrency, formatPercent, formatPercentSigned } from "@/lib/format";
import {
  formatSeasonMatchDateLabel,
  getSeasonMatchStatusLabel,
  seasonMatchFactKey,
  seasonMatchPlanKey,
} from "@/lib/tickets-season-match-chart";
import type { TicketsSeasonMatchSeriesView } from "@/types/dashboard";

type TooltipPayloadEntry = {
  dataKey?: string;
  value?: number | null;
  color?: string;
  payload?: {
    periodLabel?: string;
    dateKey?: number;
  };
};

function formatTooltipDateLabel(
  label: string | number | undefined,
  payload?: TooltipPayloadEntry[],
): string | null {
  const periodLabel = payload?.[0]?.payload?.periodLabel;
  if (periodLabel) return periodLabel;

  if (label == null) return null;
  if (typeof label === "number") {
    return formatSeasonMatchDateLabel(label);
  }
  if (/^\d{10,}$/.test(label)) {
    return formatSeasonMatchDateLabel(Number(label));
  }
  return label;
}

export function TicketsSeasonMatchTooltip({
  active,
  label,
  payload,
  views,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadEntry[];
  views: TicketsSeasonMatchSeriesView[];
}) {
  const dateLabel = formatTooltipDateLabel(label, payload);
  if (!active || !payload?.length || dateLabel == null) return null;

  const entries = views
    .map((view) => {
      const fact =
        payload.find((entry) => entry.dataKey === seasonMatchFactKey(view.matchId))
          ?.value ?? null;
      const plan =
        payload.find((entry) => entry.dataKey === seasonMatchPlanKey(view.matchId))
          ?.value ?? null;
      const revenue = fact ?? plan;

      if (revenue == null) return null;

      const completionPct =
        view.planRevenue > 0 ? (revenue / view.planRevenue) * 100 : 0;
      const deviationPct = completionPct - 100;
      const status =
        plan != null && fact == null
          ? view.status
          : completionPct > 100
            ? "ahead"
            : completionPct >= 95
              ? "on_track"
              : "behind";

      return {
        view,
        revenue,
        completionPct,
        deviationPct,
        status,
        isPlanOnly: plan != null && fact == null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((left, right) => right.revenue - left.revenue);

  if (entries.length === 0) return null;

  return (
    <div className="w-60 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="mb-1.5 font-medium text-[var(--foreground)]">{dateLabel}</p>
      {entries.map((entry) => (
        <div
          key={entry.view.matchId}
          className="mb-1.5 border-b border-[var(--border)] pb-1.5 last:mb-0 last:border-b-0 last:pb-0"
        >
          <p className="font-medium" style={{ color: entry.view.color }}>
            {entry.view.opponent} — {entry.view.matchDate}
            {entry.view.isComparison ? " (сравнение)" : ""}
            {entry.isPlanOnly ? " · план" : ""}
          </p>
          <p>
            {formatCurrency(entry.revenue)} · {formatPercent(entry.completionPct)}{" "}
            плана
          </p>
          <p
            className={clsx(
              entry.status === "behind" && "text-[#DC2626]",
              entry.status === "on_track" && "text-[#CA8A04]",
              entry.status === "ahead" && "text-[#16A34A]",
            )}
          >
            {getSeasonMatchStatusLabel(entry.status)} ·{" "}
            {formatPercentSigned(entry.deviationPct)}
          </p>
        </div>
      ))}
    </div>
  );
}

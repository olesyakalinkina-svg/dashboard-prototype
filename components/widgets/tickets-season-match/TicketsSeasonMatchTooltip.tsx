"use client";

import clsx from "clsx";
import { formatCurrency, formatPercent, formatPercentSigned } from "@/lib/format";
import {
  getSeasonMatchStatusLabel,
  seasonMatchFactKey,
  seasonMatchPlanKey,
} from "@/lib/tickets-season-match-chart";
import type { TicketsSeasonMatchSeriesView } from "@/types/dashboard";

type TooltipPayloadEntry = {
  dataKey?: string;
  value?: number | null;
  color?: string;
};

export function TicketsSeasonMatchTooltip({
  active,
  label,
  payload,
  views,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadEntry[];
  views: TicketsSeasonMatchSeriesView[];
}) {
  if (!active || !payload?.length || label == null) return null;

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
    <div className="max-h-72 w-72 overflow-y-auto rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-2 font-medium text-[var(--foreground)]">{label}</p>
      {entries.map((entry) => (
        <div
          key={entry.view.matchId}
          className="mb-2 border-b border-[var(--border)] pb-2 last:mb-0 last:border-b-0 last:pb-0"
        >
          <p className="font-medium" style={{ color: entry.view.color }}>
            {entry.view.opponent}
          </p>
          <p className="text-[var(--muted)]">Матч: {entry.view.matchDate}</p>
          <p>
            Накопительно: {formatCurrency(entry.revenue)}
            {entry.isPlanOnly ? " (план)" : ""}
          </p>
          <p>План: {formatCurrency(entry.view.planRevenue)}</p>
          <p>Выполнение: {formatPercent(entry.completionPct)}</p>
          <p>Отклонение: {formatPercentSigned(entry.deviationPct)}</p>
          <p
            className={clsx(
              entry.status === "behind" && "text-[#DC2626]",
              entry.status === "on_track" && "text-[#CA8A04]",
              entry.status === "ahead" && "text-[#16A34A]",
            )}
          >
            {getSeasonMatchStatusLabel(entry.status)}
          </p>
        </div>
      ))}
    </div>
  );
}

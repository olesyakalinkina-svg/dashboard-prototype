"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { formatFullCount } from "@/lib/subscription-campaign";
import { formatGapCell } from "@/lib/subscription-campaign/format";
import type { CampaignPacePoint } from "@/lib/subscription-campaign";
import clsx from "clsx";

export function CampaignPaceTable({
  open,
  onToggle,
  points,
  mainSeasonName,
  benchmarkSeasonName,
}: {
  open: boolean;
  onToggle: () => void;
  points: readonly CampaignPacePoint[];
  mainSeasonName: string;
  benchmarkSeasonName: string;
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-[var(--accent)] hover:underline"
      >
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        {open ? "Скрыть таблицу" : "Показать таблицу"}
      </button>

      {open && (
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-[var(--border)]">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[var(--border)] text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-2 py-2">День</th>
                <th className="px-2 py-2">{mainSeasonName}</th>
                <th className="px-2 py-2">{benchmarkSeasonName}</th>
                <th className="px-2 py-2">Разрыв</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => {
                const gap = formatGapCell(
                  point.countAbsoluteGap,
                  point.countPercentageGap,
                );
                return (
                  <tr
                    key={point.campaignDay}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-2 py-1.5 tabular-nums">{point.campaignDay}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatFullCount(point.currentSeasonCount)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatFullCount(point.benchmarkSeasonCount)}
                    </td>
                    <td
                      className={clsx(
                        "px-2 py-1.5 tabular-nums",
                        gap.tone === "positive" && "text-emerald-600",
                        gap.tone === "negative" && "text-red-500",
                        gap.tone === "neutral" && "text-[var(--muted)]",
                      )}
                    >
                      {gap.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

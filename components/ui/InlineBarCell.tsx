"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";

export function ShareBreakdownBar({
  share,
  planShare,
  color,
  className,
}: {
  share: number;
  planShare?: number;
  color: string;
  className?: string;
}) {
  const widthPct = Math.min(100, Math.max(0, share));

  return (
    <div
      className={clsx(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-[#f0f0f2]",
        className,
      )}
      title={
        planShare !== undefined
          ? `Доля: ${share.toFixed(1)}% · План: ${planShare.toFixed(1)}%`
          : `Доля: ${share.toFixed(1)}%`
      }
    >
      {widthPct > 0 && (
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${widthPct}%`,
            backgroundColor: color,
          }}
        />
      )}
      {planShare !== undefined && planShare > 0 && (
        <div
          className="absolute top-0 z-10 h-full w-0.5 -translate-x-1/2 rounded-full bg-[#6b6b70]"
          style={{ left: `${Math.min(100, planShare)}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}

export function InlineBarCell({
  value,
  max,
  formatted,
  trailingFormatted,
  share,
  barClassName = "",
  barStyle,
  planValue,
  planFormatted,
  compactLabels = false,
  showFill = true,
}: {
  value: number;
  max: number;
  formatted: string;
  trailingFormatted?: string;
  share?: number;
  barClassName?: string;
  barStyle?: CSSProperties;
  planValue?: number;
  planFormatted?: string;
  compactLabels?: boolean;
  showFill?: boolean;
}) {
  const widthPct =
    share !== undefined
      ? Math.min(100, Math.max(0, share))
      : max > 0
        ? Math.min(100, (value / max) * 100)
        : 0;
  const planWidthPct =
    planValue !== undefined && max > 0
      ? Math.min(100, (planValue / max) * 100)
      : 0;
  const stackLabels = compactLabels && Boolean(trailingFormatted);

  return (
    <div
      className={clsx(
        "relative w-full min-w-0 max-w-full overflow-hidden rounded-sm bg-[#f0f0f2]",
        stackLabels ? "h-8" : "h-6",
      )}
    >
      {showFill && planValue !== undefined && planWidthPct > 0 && (
        <div
          className="absolute left-0 top-0 h-full max-w-full rounded-sm border border-[#8B8B8E] bg-[#e4e4e7]"
          style={{
            width: `${planWidthPct}%`,
            minWidth: "min(2.75rem, 100%)",
          }}
        />
      )}
      {showFill && widthPct > 0 && (
        <div
          className={clsx("absolute left-0 top-0 h-full max-w-full rounded-sm", barClassName)}
          style={{
            width: `${widthPct}%`,
            minWidth:
              share === undefined && widthPct > 0 ? "min(2.75rem, 100%)" : undefined,
            ...barStyle,
          }}
        />
      )}
      <span
        className={clsx(
          "relative z-10 flex h-full min-w-0 font-medium tabular-nums text-[var(--foreground)]",
          compactLabels
            ? stackLabels
              ? "flex-col items-start justify-center gap-0 px-1 py-0.5 text-[10px] leading-none"
              : "items-center whitespace-nowrap px-1 text-[10px] leading-none"
            : clsx(
                "items-center whitespace-nowrap px-2 text-xs",
                trailingFormatted && "justify-between gap-2",
              ),
        )}
      >
        <span className="min-w-0 max-w-full">{formatted}</span>
        {trailingFormatted && <span className="shrink-0">{trailingFormatted}</span>}
        {planValue !== undefined && planFormatted && !trailingFormatted && (
          <span className="ml-1.5 font-normal text-[var(--muted)]">
            / {planFormatted}
          </span>
        )}
      </span>
    </div>
  );
}

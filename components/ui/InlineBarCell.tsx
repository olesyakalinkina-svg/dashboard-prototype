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

  return (
    <div className="relative h-6 min-w-[80px] flex-1 overflow-hidden rounded-sm bg-[#f0f0f2] sm:min-w-[120px]">
      {planValue !== undefined && planWidthPct > 0 && (
        <div
          className="absolute left-0 top-0 h-full rounded-sm border border-[#8B8B8E] bg-[#e4e4e7]"
          style={{
            width: `${planWidthPct}%`,
            minWidth: "2.75rem",
          }}
        />
      )}
      {widthPct > 0 && (
        <div
          className={clsx("absolute left-0 top-0 h-full rounded-sm", barClassName)}
          style={{
            width: `${widthPct}%`,
            minWidth: share === undefined && widthPct > 0 ? "2.75rem" : undefined,
            ...barStyle,
          }}
        />
      )}
      <span
        className={clsx(
          "relative z-10 flex h-full items-center whitespace-nowrap px-2 text-xs font-medium tabular-nums text-[var(--foreground)]",
          trailingFormatted && "justify-between gap-2",
        )}
      >
        <span>{formatted}</span>
        {trailingFormatted && <span>{trailingFormatted}</span>}
        {planValue !== undefined && planFormatted && !trailingFormatted && (
          <span className="ml-1.5 font-normal text-[var(--muted)]">
            / {planFormatted}
          </span>
        )}
      </span>
    </div>
  );
}

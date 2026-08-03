"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";

export function InlineBarCell({
  value,
  max,
  formatted,
  barClassName = "",
  barStyle,
  planValue,
  planFormatted,
}: {
  value: number;
  max: number;
  formatted: string;
  barClassName?: string;
  barStyle?: CSSProperties;
  planValue?: number;
  planFormatted?: string;
}) {
  const widthPct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const planWidthPct =
    planValue !== undefined && max > 0
      ? Math.min(100, (planValue / max) * 100)
      : 0;

  return (
    <div className="relative h-6 min-w-[120px] flex-1 overflow-hidden rounded-sm bg-[#f0f0f2]">
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
            minWidth: "2.75rem",
            ...barStyle,
          }}
        />
      )}
      <span className="relative z-10 flex h-full items-center whitespace-nowrap px-2 text-xs font-medium tabular-nums text-[var(--foreground)]">
        {formatted}
        {planValue !== undefined && planFormatted && (
          <span className="ml-1.5 font-normal text-[var(--muted)]">
            / {planFormatted}
          </span>
        )}
      </span>
    </div>
  );
}

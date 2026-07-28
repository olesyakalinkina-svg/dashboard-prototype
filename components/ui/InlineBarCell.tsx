"use client";

import clsx from "clsx";

function getBarTextClass(barClassName: string, widthPct: number): string {
  const isLightBar = /gray|slate|zinc|neutral|stone/i.test(barClassName);
  if (isLightBar || widthPct < 18) {
    return "text-[var(--foreground)]";
  }
  return "text-white";
}

export function InlineBarCell({
  value,
  max,
  formatted,
  barClassName,
}: {
  value: number;
  max: number;
  formatted: string;
  barClassName: string;
}) {
  const widthPct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="relative h-6 min-w-[120px] flex-1 overflow-hidden rounded-sm bg-[#f0f0f2]">
      {widthPct > 0 && (
        <div
          className={clsx("absolute left-0 top-0 h-full rounded-sm", barClassName)}
          style={{
            width: `${widthPct}%`,
            minWidth: "2.75rem",
          }}
        />
      )}
      <span
        className={clsx(
          "relative z-10 flex h-full items-center whitespace-nowrap px-2 text-xs font-medium tabular-nums",
          getBarTextClass(barClassName, widthPct),
        )}
      >
        {formatted}
      </span>
    </div>
  );
}

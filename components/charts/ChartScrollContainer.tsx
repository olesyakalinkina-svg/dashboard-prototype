"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

type ChartScrollContainerProps = {
  children: ReactNode;
  className?: string;
  minWidth?: 700 | 800;
};

export function ChartScrollContainer({
  children,
  className,
  minWidth = 700,
}: ChartScrollContainerProps) {
  const minWidthClass =
    minWidth === 800 ? "xl:min-w-[800px]" : "xl:min-w-[700px]";

  return (
    <div
      className={clsx(
        "min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x_pan-y] xl:overflow-x-visible",
        className,
      )}
    >
      <div className={clsx("h-full w-full min-w-0", minWidthClass)}>
        {children}
      </div>
    </div>
  );
}

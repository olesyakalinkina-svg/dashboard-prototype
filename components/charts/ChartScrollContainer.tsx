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
    minWidth === 800 ? "min-w-[800px]" : "min-w-[700px]";

  return (
    <div
      className={clsx(
        "min-w-0 overflow-x-auto overflow-y-hidden md:overflow-x-visible",
        className,
      )}
    >
      <div className={clsx(minWidthClass, "h-full md:min-w-0")}>
        {children}
      </div>
    </div>
  );
}

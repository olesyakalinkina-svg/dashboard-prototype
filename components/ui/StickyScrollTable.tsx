"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function StickyScrollTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx("sticky-scroll-table min-w-0 overflow-x-auto", className)}
      data-testid="sticky-scroll-table"
    >
      {children}
    </div>
  );
}

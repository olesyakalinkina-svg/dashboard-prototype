"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { STICKY_TABLE_ROW_HOVER_CLASS } from "@/components/ui/sales-table-layout";

export function StickyScrollTable({
  children,
  className,
  rowHover = true,
  overflowX = true,
}: {
  children: ReactNode;
  className?: string;
  rowHover?: boolean;
  /** When false, columns must fit the card — no sideways scrollbar. */
  overflowX?: boolean;
}) {
  return (
    <div
      className={clsx(
        "sticky-scroll-table min-w-0",
        overflowX ? "overflow-x-auto" : "overflow-x-hidden",
        rowHover && STICKY_TABLE_ROW_HOVER_CLASS,
        className,
      )}
      data-testid="sticky-scroll-table"
    >
      {children}
    </div>
  );
}

"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { STICKY_TABLE_ROW_HOVER_CLASS } from "@/components/ui/sales-table-layout";

export function StickyScrollTable({
  children,
  className,
  rowHover = true,
}: {
  children: ReactNode;
  className?: string;
  rowHover?: boolean;
}) {
  return (
    <div
      className={clsx(
        "sticky-scroll-table min-w-0 overflow-x-auto",
        rowHover && STICKY_TABLE_ROW_HOVER_CLASS,
        className,
      )}
      data-testid="sticky-scroll-table"
    >
      {children}
    </div>
  );
}

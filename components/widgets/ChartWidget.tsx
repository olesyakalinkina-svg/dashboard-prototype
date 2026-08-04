"use client";

import clsx from "clsx";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type ChartWidgetProps = {
  title: string;
  children: ReactNode;
  className?: string;
  height?: number;
  compact?: boolean;
  fillHeight?: boolean;
};

export function ChartWidget({
  title,
  children,
  className,
  height = 280,
  compact = false,
  fillHeight = false,
}: ChartWidgetProps) {
  return (
    <Card
      className={clsx(
        "min-w-0",
        fillHeight && "flex h-full flex-col",
        className,
      )}
    >
      <CardHeader className={compact ? "px-3 py-2" : undefined}>
        <CardTitle>
          <span className={compact ? "text-xs" : undefined}>{title}</span>
        </CardTitle>
        <button className="rounded p-1 text-[var(--muted)] hover:bg-[var(--background)]">
          <MoreHorizontal className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      </CardHeader>
      <CardContent
        className={clsx(
          fillHeight && "flex flex-1 flex-col",
          compact ? "px-3 pb-3" : undefined,
        )}
      >
        <div
          className={fillHeight ? "min-h-0 flex-1" : undefined}
          style={fillHeight ? { minHeight: height } : { height }}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

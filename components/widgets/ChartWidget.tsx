"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useLayoutMode } from "@/hooks/useLayoutMode";

type ChartWidgetProps = {
  title: string;
  children: ReactNode;
  className?: string;
  height?: number;
  compact?: boolean;
  fillHeight?: false | boolean;
  headerExtra?: ReactNode;
};

export function ChartWidget({
  title,
  children,
  className,
  height = 280,
  compact = false,
  fillHeight = false,
  headerExtra,
}: ChartWidgetProps) {
  const mode = useLayoutMode();
  const resolvedHeight =
    compact || fillHeight
      ? height
      : mode === "mobile"
        ? Math.min(Math.max(height, 220), 280)
        : height;

  return (
    <Card
      className={clsx(
        "min-w-0",
        fillHeight && "flex h-full flex-col",
        className,
      )}
    >
      <CardHeader className={compact ? "px-3 py-2" : undefined}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent
        className={clsx(
          fillHeight && "flex flex-1 flex-col",
          "min-w-0",
          compact ? "px-3 pb-3" : undefined,
        )}
      >
        <div
          className={fillHeight ? "min-h-0 flex-1" : undefined}
          style={fillHeight ? undefined : { height: resolvedHeight }}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

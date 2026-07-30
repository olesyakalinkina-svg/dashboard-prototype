"use client";

import clsx from "clsx";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
  refreshKey,
}: ChartWidgetProps & { refreshKey?: string }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [title, refreshKey]);

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
        {loading ? (
          <div
            className={clsx(
              "animate-pulse rounded-md bg-[var(--background)]",
              fillHeight && "flex-1",
            )}
            style={fillHeight ? { minHeight: height } : { height }}
          />
        ) : (
          <div
            className={fillHeight ? "min-h-0 flex-1" : undefined}
            style={fillHeight ? { minHeight: height } : { height }}
          >
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

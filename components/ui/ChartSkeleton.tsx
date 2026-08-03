import clsx from "clsx";

export function ChartSkeleton({
  className,
  height = 320,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]",
        className,
      )}
      style={{ minHeight: height }}
    />
  );
}

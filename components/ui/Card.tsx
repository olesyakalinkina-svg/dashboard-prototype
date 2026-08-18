import clsx from "clsx";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-[var(--border)] bg-[var(--card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex min-w-0 flex-wrap items-start justify-between gap-2 px-3 py-3 sm:items-center sm:gap-3 sm:px-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="min-w-0 text-sm font-semibold break-words text-[var(--foreground)]">{children}</h3>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("min-w-0 px-3 pb-3 sm:px-4 sm:pb-4", className)}>{children}</div>;
}

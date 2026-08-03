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
    <div className={clsx("flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)]">{children}</h3>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("px-3 pb-3 sm:px-4 sm:pb-4", className)}>{children}</div>;
}

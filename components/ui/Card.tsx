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
    <div className={clsx("flex items-center justify-between px-4 py-3", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-[var(--foreground)]">{children}</h3>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("px-4 pb-4", className)}>{children}</div>;
}

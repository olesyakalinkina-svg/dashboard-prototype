import clsx from "clsx";
import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
      {label && (
        <span className="text-xs text-[var(--muted)]">{label}</span>
      )}
      <select
        className={clsx(
          "h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

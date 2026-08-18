import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
  variant = "secondary",
  className,
  children,
  ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50 xl:h-9",
        variant === "primary" &&
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--background)]",
        variant === "ghost" &&
          "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

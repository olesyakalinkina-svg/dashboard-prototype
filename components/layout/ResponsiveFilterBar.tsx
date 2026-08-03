"use client";

import clsx from "clsx";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useMediaQuery } from "@/lib/useMediaQuery";

type ResponsiveFilterBarProps = {
  children: ReactNode;
  onReset?: () => void;
};

export function ResponsiveFilterBar({
  children,
  onReset,
}: ResponsiveFilterBarProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(false);
  const showInlineFilters = isDesktop !== false;
  const showMobileDrawer = isDesktop === false && open;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (isDesktop) {
      setOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-4 py-3 shadow-sm lg:hidden">
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className="flex-1 sm:flex-none"
          aria-expanded={open}
          aria-controls="mobile-filter-panel"
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Фильтры
        </Button>
        {onReset && (
          <Button variant="ghost" onClick={onReset} className="shrink-0">
            Сбросить
          </Button>
        )}
      </div>

      {showInlineFilters && (
        <div className="hidden border-b border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:space-y-4 sm:px-6 sm:py-4 lg:sticky lg:top-0 lg:z-10 lg:block">
          {children}
        </div>
      )}

      {showMobileDrawer && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filter-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Закрыть фильтры"
          />

          <div
            id="mobile-filter-panel"
            className="relative flex max-h-[min(90vh,720px)] flex-col rounded-t-2xl border border-[var(--border)] bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2
                id="mobile-filter-title"
                className="text-base font-semibold text-[var(--foreground)]"
              >
                Фильтры
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={clsx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md",
                  "text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]",
                )}
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

            <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
              {onReset && (
                <Button variant="ghost" onClick={onReset} className="flex-1">
                  Сбросить
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => setOpen(false)}
                className={clsx(onReset ? "flex-1" : "w-full")}
              >
                Применить
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

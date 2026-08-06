"use client";

import clsx from "clsx";
import { SlidersHorizontal, X } from "lucide-react";
import { useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  MobileFilterDraftContext,
  MobileFilterDraftProvider,
} from "@/context/MobileFilterDraftContext";
import { useFilterState } from "@/context/FilterContext";

type ResponsiveFilterBarProps = {
  children: ReactNode;
  onReset?: () => void;
  activeFilterCount?: number;
};

const stickyFilterBarClassName = clsx(
  "sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)] shadow-sm backdrop-blur-sm",
);

export function ResponsiveFilterBar({
  children,
  onReset,
  activeFilterCount = 0,
}: ResponsiveFilterBarProps) {
  const [open, setOpen] = useState(false);
  const { activeTab } = useFilterState();

  useEffect(() => {
    setOpen(false);
  }, [activeTab]);

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

  const filterLabel =
    activeFilterCount > 0
      ? `Фильтры · ${activeFilterCount}`
      : "Фильтры";

  return (
    <>
      <div
        className={clsx(
          stickyFilterBarClassName,
          "flex items-center justify-between gap-3 px-4 py-3 md:hidden",
        )}
      >
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className="min-h-11 flex-1 sm:flex-none"
          aria-expanded={open}
          aria-controls="mobile-filter-panel"
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          {filterLabel}
        </Button>
      </div>

      <div
        className={clsx(
          stickyFilterBarClassName,
          "hidden px-4 py-3 sm:px-6 sm:py-4 md:block",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">{children}</div>
          {onReset && (
            <Button variant="ghost" onClick={onReset} className="shrink-0">
              Сбросить
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
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

          <MobileFilterDraftProvider onClose={() => setOpen(false)}>
            <MobileFilterDrawerPanel
              filterLabel={filterLabel}
              onClose={() => setOpen(false)}
            >
              {children}
            </MobileFilterDrawerPanel>
          </MobileFilterDraftProvider>
        </div>
      )}
    </>
  );
}

function MobileFilterDrawerPanel({
  children,
  filterLabel,
  onClose,
}: {
  children: ReactNode;
  filterLabel: string;
  onClose: () => void;
}) {
  const draftCtx = useContext(MobileFilterDraftContext);
  const { activeTab } = useFilterState();

  const handleReset = () => {
    if (activeTab === "tickets") {
      draftCtx?.resetTicketFilters();
      return;
    }
    if (activeTab === "merch") {
      draftCtx?.resetMerchFilters();
      return;
    }
    if (activeTab === "matches") {
      draftCtx?.resetMatchSalesFilters();
      return;
    }
    if (activeTab === "subscriptions") {
      draftCtx?.resetSubscriptionFilters();
    }
  };

  return (
    <div
      id="mobile-filter-panel"
      className="relative flex max-h-[min(90vh,720px)] flex-col rounded-t-2xl border border-[var(--border)] bg-white shadow-xl"
      style={{ paddingBottom: "var(--safe-area-bottom)" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <h2
          id="mobile-filter-title"
          className="text-base font-semibold text-[var(--foreground)]"
        >
          {filterLabel}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className={clsx(
            "inline-flex h-10 w-10 items-center justify-center rounded-md",
            "text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]",
          )}
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

      <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
        <Button variant="ghost" onClick={handleReset} className="min-h-11 flex-1">
          Сбросить
        </Button>
        <Button
          variant="primary"
          onClick={() => draftCtx?.applyDraft()}
          className="min-h-11 flex-1"
        >
          Применить
        </Button>
      </div>
    </div>
  );
}

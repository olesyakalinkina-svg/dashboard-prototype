"use client";

import clsx from "clsx";
import { SlidersHorizontal, X } from "lucide-react";
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  MobileFilterDraftContext,
  MobileFilterDraftProvider,
} from "@/context/MobileFilterDraftContext";
import { useFilterState } from "@/context/FilterContext";
import { useFilterOverlayMode } from "@/hooks/useLayoutMode";

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
  const overlayMode = useFilterOverlayMode();
  const { activeTab } = useFilterState();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    setOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (overlayMode === "none") {
      setOpen(false);
    }
  }, [overlayMode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const html = document.documentElement;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
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

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  const filterLabel =
    activeFilterCount > 0
      ? `Фильтры · ${activeFilterCount}`
      : "Фильтры";

  const openFilters = () => setOpen(true);
  const closeFilters = () => setOpen(false);

  if (overlayMode === "none") {
    return (
      <div
        className={clsx(stickyFilterBarClassName, "px-4 py-3 sm:px-6 sm:py-4")}
        data-testid="filter-desktop-bar"
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
    );
  }

  return (
    <>
      <div
        className={clsx(
          stickyFilterBarClassName,
          "flex items-center justify-between gap-3 px-4 py-3",
        )}
        data-testid="filter-trigger-bar"
      >
        <Button
          ref={triggerRef}
          variant="secondary"
          onClick={openFilters}
          className="min-h-11"
          aria-expanded={open}
          aria-controls="adaptive-filter-panel"
          data-testid="filter-trigger"
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          {filterLabel}
        </Button>
      </div>

      {open && (
        <div
          className={clsx(
            "fixed inset-0 z-50",
            overlayMode === "sheet" ? "flex flex-col justify-end" : "flex justify-end",
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid={
            overlayMode === "panel" ? "filter-side-panel" : "filter-bottom-sheet"
          }
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={closeFilters}
            aria-label="Закрыть фильтры"
          />

          <MobileFilterDraftProvider onClose={closeFilters}>
            <FilterDrawerPanel
              titleId={titleId}
              filterLabel={filterLabel}
              onClose={closeFilters}
              variant={overlayMode}
            >
              {children}
            </FilterDrawerPanel>
          </MobileFilterDraftProvider>
        </div>
      )}
    </>
  );
}

function FilterDrawerPanel({
  children,
  filterLabel,
  onClose,
  titleId,
  variant,
}: {
  children: ReactNode;
  filterLabel: string;
  onClose: () => void;
  titleId: string;
  variant: "sheet" | "panel";
}) {
  const draftCtx = useContext(MobileFilterDraftContext);
  const { activeTab } = useFilterState();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeButton = panelRef.current?.querySelector<HTMLElement>(
      "[data-filter-close]",
    );
    closeButton?.focus();
  }, []);

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
      ref={panelRef}
      id="adaptive-filter-panel"
      className={clsx(
        "relative flex flex-col border border-[var(--border)] bg-white shadow-xl",
        variant === "sheet"
          ? "max-h-[min(90vh,720px)] rounded-t-2xl"
          : "h-full w-[min(100%,440px)] max-w-[440px] min-w-[min(100%,400px)]",
      )}
      style={{ paddingBottom: "var(--safe-area-bottom)" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <h2
          id={titleId}
          className="text-base font-semibold leading-snug text-[var(--foreground)]"
        >
          {filterLabel}
        </h2>
        <button
          type="button"
          data-filter-close
          onClick={onClose}
          className={clsx(
            "inline-flex h-11 w-11 items-center justify-center rounded-md",
            "text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]",
          )}
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3 [&_.xl\\:flex]:flex [&_.xl\\:flex]:flex-col">
          {children}
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-[var(--border)] bg-white px-4 py-3">
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

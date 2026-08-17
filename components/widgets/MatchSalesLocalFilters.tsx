"use client";

import clsx from "clsx";
import { Info, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { MatchSalesTreeState } from "@/hooks/useMatchSalesTree";
import type { MatchSalesLocalFilters } from "@/lib/match-sales-tree";
import type { OrderSource, PriceZone, TicketType } from "@/types/dashboard";

const BANNER_TEXT = "Показатели рассчитаны по применённым фильтрам";
const BANNER_TOOLTIP =
  "Выручка, средняя цена, продажи и скидка ПЛ считаются только по транзакциям, прошедшим глобальные и локальные фильтры таблицы. План и вместимость остаются на уровне матча; у типов билета, источников и ценовых зон показывается «—».";

export function MatchSalesFilterBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
      <span className="min-w-0 flex-1">{BANNER_TEXT}</span>
      <span
        className="inline-flex shrink-0 text-[var(--muted)]"
        title={BANNER_TOOLTIP}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{BANNER_TOOLTIP}</span>
      </span>
    </div>
  );
}

function FilterFields({
  state,
}: {
  state: MatchSalesTreeState;
}) {
  const { localFilters, setLocalFilters, options } = state;

  function update<K extends keyof MatchSalesLocalFilters>(
    key: K,
    value: MatchSalesLocalFilters[K],
  ) {
    setLocalFilters({ ...localFilters, [key]: value });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <MultiSelect
        label="Матч"
        options={options.matches}
        value={localFilters.matchId}
        onChange={(matchId) => update("matchId", matchId)}
        selectAllLabel="Все матчи"
        allSelectedLabel="Все матчи"
        emptyLabel="Все матчи"
        searchable
        searchPlaceholder="Поиск матча..."
        className="sm:min-w-[220px]"
      />
      <MultiSelect
        label="Тип билета"
        options={options.ticketTypes}
        value={localFilters.ticketType}
        onChange={(ticketType) =>
          update("ticketType", ticketType as TicketType[])
        }
        selectAllLabel="Все типы"
        allSelectedLabel="Все типы"
        emptyLabel="Все типы"
        className="sm:min-w-[160px]"
      />
      <MultiSelect
        label="Источник заказа"
        options={options.orderSources}
        value={localFilters.orderSource}
        onChange={(orderSource) =>
          update("orderSource", orderSource as OrderSource[])
        }
        selectAllLabel="Все источники"
        allSelectedLabel="Все источники"
        emptyLabel="Все источники"
        className="sm:min-w-[180px]"
      />
      <MultiSelect
        label="Ценовая зона"
        options={options.priceZones}
        value={localFilters.priceZone}
        onChange={(priceZone) => update("priceZone", priceZone as PriceZone[])}
        selectAllLabel="Все зоны"
        allSelectedLabel="Все зоны"
        emptyLabel="Все зоны"
        searchable
        searchPlaceholder="Поиск зоны..."
        className="sm:min-w-[160px]"
      />
    </div>
  );
}

function FilterChips({ state }: { state: MatchSalesTreeState }) {
  if (state.chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {state.chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => state.removeChip(chip.dimension, chip.value)}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-xs text-[var(--foreground)]"
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3 w-3 shrink-0 text-[var(--muted)]" />
        </button>
      ))}
    </div>
  );
}

export function MatchSalesLocalFiltersBar({
  state,
}: {
  state: MatchSalesTreeState;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <FilterFields state={state} />
        <Button
          type="button"
          variant="ghost"
          onClick={state.resetLocalFilters}
          disabled={state.activeFilterCount === 0}
          className="shrink-0"
        >
          Сбросить
          {state.activeFilterCount > 0 ? ` · ${state.activeFilterCount}` : ""}
        </Button>
      </div>
      <FilterChips state={state} />
    </div>
  );
}

export function MatchSalesMobileLocalFilters({
  state,
}: {
  state: MatchSalesTreeState;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const filterLabel =
    state.activeFilterCount > 0
      ? `Фильтры таблицы · ${state.activeFilterCount}`
      : "Фильтры таблицы";

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full"
        aria-expanded={open}
      >
        <SlidersHorizontal className="mr-1.5 h-4 w-4" />
        {filterLabel}
      </Button>
      <FilterChips state={state} />
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-sales-local-filters-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Закрыть фильтры"
          />
          <div
            className="relative flex max-h-[min(90vh,720px)] flex-col rounded-t-2xl border border-[var(--border)] bg-white shadow-xl"
            style={{ paddingBottom: "var(--safe-area-bottom)" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2
                id="match-sales-local-filters-title"
                className="text-base font-semibold"
              >
                {filterLabel}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--muted)]"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <FilterFields state={state} />
            </div>
            <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
              <Button
                variant="ghost"
                onClick={state.resetLocalFilters}
                className="min-h-11 flex-1"
              >
                Сбросить
              </Button>
              <Button
                variant="primary"
                onClick={() => setOpen(false)}
                className="min-h-11 flex-1"
              >
                Готово
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MatchSalesExpandButton({
  expanded,
  hasChildren,
  label,
  onToggle,
  className,
}: {
  expanded: boolean;
  hasChildren: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  if (!hasChildren) {
    return <span className="inline-block w-5 shrink-0" aria-hidden />;
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={clsx(
        "relative z-20 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-white text-xs font-medium leading-none text-[var(--foreground)]",
        className,
      )}
      aria-expanded={expanded}
      aria-label={expanded ? `Свернуть: ${label}` : `Развернуть: ${label}`}
    >
      {expanded ? "−" : "+"}
    </button>
  );
}

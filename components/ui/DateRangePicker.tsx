"use client";

import clsx from "clsx";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MerchOrderDateRange } from "@/types/dashboard";

type DateRangePickerProps = {
  label?: string;
  value: MerchOrderDateRange;
  onChange: (value: MerchOrderDateRange) => void;
  /** ISO dates (yyyy-MM-dd) selectable in the calendar; others are disabled */
  availableDates?: ReadonlySet<string>;
  className?: string;
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseRangeDate(iso: string | null): Date | null {
  if (!iso) return null;
  return parseISO(iso);
}

function formatDisplayDate(iso: string | null): string {
  const date = parseRangeDate(iso);
  if (!date) return "—";
  return format(date, "d MMM yyyy", { locale: ru });
}

export function DateRangePicker({
  label,
  value,
  onChange,
  availableDates,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const anchor = parseRangeDate(value.from) ?? parseRangeDate(value.to) ?? new Date();
    return startOfMonth(anchor);
  });
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setPendingFrom(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fromDate = parseRangeDate(value.from);
  const toDate = parseRangeDate(value.to);
  const hasRange = Boolean(value.from || value.to);

  const displayText = useMemo(() => {
    if (!hasRange) return "Весь период";
    if (value.from && value.to) {
      return `${formatDisplayDate(value.from)} — ${formatDisplayDate(value.to)}`;
    }
    if (value.from) return `С ${formatDisplayDate(value.from)}`;
    return `По ${formatDisplayDate(value.to)}`;
  }, [hasRange, value.from, value.to]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const monthEnd = endOfMonth(viewMonth);
    const days: Date[] = [];
    let day = gridStart;
    while (day <= monthEnd || days.length % 7 !== 0) {
      days.push(day);
      day = addDays(day, 1);
      if (days.length > 42) break;
    }
    return days;
  }, [viewMonth]);

  function isDateAvailable(day: Date): boolean {
    if (!availableDates) return true;
    return availableDates.has(toIsoDate(day));
  }

  function handleDayClick(day: Date) {
    if (!isDateAvailable(day)) return;

    const iso = toIsoDate(day);

    if (pendingFrom) {
      const start = parseISO(pendingFrom);
      if (isBefore(day, start)) {
        onChange({ from: iso, to: pendingFrom });
      } else {
        onChange({ from: pendingFrom, to: iso });
      }
      setPendingFrom(null);
      return;
    }

    if (!value.from && !value.to) {
      setPendingFrom(iso);
      return;
    }

    if (value.from && value.to) {
      setPendingFrom(iso);
      return;
    }

    if (value.from && !value.to) {
      const start = parseISO(value.from);
      if (isBefore(day, start)) {
        onChange({ from: iso, to: value.from });
      } else {
        onChange({ from: value.from, to: iso });
      }
      return;
    }

    if (!value.from && value.to) {
      const end = parseISO(value.to);
      if (isAfter(day, end)) {
        onChange({ from: value.to, to: iso });
      } else {
        onChange({ from: iso, to: value.to });
      }
    }
  }

  function isInRange(day: Date): boolean {
    const rangeStart = pendingFrom
      ? parseISO(pendingFrom)
      : fromDate;
    const rangeEnd = pendingFrom ? null : toDate;

    if (!rangeStart) return false;
    if (!rangeEnd) {
      return isSameDay(day, rangeStart);
    }
    return (
      (isSameDay(day, rangeStart) || isAfter(day, rangeStart)) &&
      (isSameDay(day, rangeEnd) || isBefore(day, rangeEnd))
    );
  }

  function isRangeStart(day: Date): boolean {
    if (pendingFrom && isSameDay(day, parseISO(pendingFrom))) return true;
    return fromDate ? isSameDay(day, fromDate) : false;
  }

  function isRangeEnd(day: Date): boolean {
    return toDate ? isSameDay(day, toDate) : false;
  }

  function handleClear() {
    onChange({ from: null, to: null });
    setPendingFrom(null);
  }

  function handleOpen() {
    const anchor = fromDate ?? toDate ?? new Date();
    setViewMonth(startOfMonth(anchor));
    setPendingFrom(null);
    setOpen((prev) => !prev);
  }

  return (
    <div
      ref={rootRef}
      className={clsx("relative flex w-full min-w-0 flex-col gap-1 sm:w-auto", className)}
    >
      {label && <span className="text-xs text-[var(--muted)]">{label}</span>}
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-left text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] sm:min-w-[220px]"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[280px] rounded-md border border-[var(--border)] bg-white p-3 shadow-lg">
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5">
              <span className="text-[var(--muted)]">С</span>
              <div className="truncate font-medium text-[var(--foreground)]">
                {formatDisplayDate(pendingFrom ?? value.from)}
              </div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5">
              <span className="text-[var(--muted)]">По</span>
              <div className="truncate font-medium text-[var(--foreground)]">
                {formatDisplayDate(value.to)}
              </div>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="rounded p-1 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium capitalize">
              {format(viewMonth, "LLLL yyyy", { locale: ru })}
            </span>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded p-1 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAY_LABELS.map((weekday) => (
              <div
                key={weekday}
                className="py-1 text-center text-[11px] font-medium text-[var(--muted)]"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day) => {
              const inCurrentMonth = isSameMonth(day, viewMonth);
              const available = isDateAvailable(day);
              const selected = available && isInRange(day);
              const rangeStart = available && isRangeStart(day);
              const rangeEnd = available && isRangeEnd(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={!available}
                  onClick={() => handleDayClick(day)}
                  className={clsx(
                    "relative h-8 rounded text-sm transition-colors",
                    !available &&
                      "cursor-not-allowed text-[var(--muted)]/35 line-through decoration-[var(--muted)]/35",
                    available && !inCurrentMonth && "text-[var(--muted)]/60",
                    available &&
                      inCurrentMonth &&
                      !selected &&
                      "hover:bg-[var(--background)]",
                    selected && "bg-[var(--accent)]/15 text-[var(--foreground)]",
                    (rangeStart || rangeEnd) &&
                      "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {pendingFrom && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Выберите дату окончания периода
            </p>
          )}

          <div className="mt-3 flex justify-end border-t border-[var(--border)] pt-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasRange && !pendingFrom}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

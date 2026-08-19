"use client";

import clsx from "clsx";
import { ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectProps = {
  label?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
  selectAllLabel?: string;
  allSelectedLabel?: string;
  emptyLabel?: string;
  emptyMeansAll?: boolean;
  applyOnClose?: boolean;
  /** When emptyMeansAll is true, value used to represent an explicit empty selection */
  noneValue?: string;
  /**
   * Exclusive option rendered first. Empty `value` means it is selected.
   * Picking it clears other options; picking a regular option deselects it.
   */
  leadingExclusiveOption?: MultiSelectOption;
  searchable?: boolean;
  searchPlaceholder?: string;
};

const OPTION_ROW_CLASS =
  "relative flex h-11 shrink-0 cursor-pointer items-center gap-2 bg-white px-3 text-sm hover:bg-[var(--background)] xl:h-9";

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const EMPTY_SELECTED_SET = new Set<string>();

function isNoneSelection(value: string[], noneValue?: string): boolean {
  return Boolean(noneValue && value.length === 1 && value[0] === noneValue);
}

function isEffectivelyAll(
  value: string[],
  optionCount: number,
  emptyMeansAll: boolean,
  noneValue?: string,
): boolean {
  if (isNoneSelection(value, noneValue)) return false;
  if (!emptyMeansAll) return optionCount > 0 && value.length === optionCount;
  return value.length === 0 || value.length === optionCount;
}

function buildSelectedSet(
  value: string[],
  options: MultiSelectOption[],
  emptyMeansAll: boolean,
  noneValue?: string,
): Set<string> {
  if (isNoneSelection(value, noneValue)) {
    return new Set();
  }
  if (emptyMeansAll && value.length === 0) {
    return new Set(options.map((opt) => opt.value));
  }
  return new Set(value);
}

function stripNoneValue(value: string[], noneValue?: string): string[] {
  if (!noneValue) return value;
  return value.filter((item) => item !== noneValue);
}

function getDisplayText(
  value: string[],
  options: MultiSelectOption[],
  {
    emptyMeansAll,
    allSelectedLabel,
    emptyLabel,
    noneValue,
  }: {
    emptyMeansAll: boolean;
    allSelectedLabel: string;
    emptyLabel: string;
    noneValue?: string;
  },
): string {
  if (isNoneSelection(value, noneValue)) return emptyLabel;
  if (isEffectivelyAll(value, options.length, emptyMeansAll, noneValue)) {
    return allSelectedLabel;
  }
  if (value.length === 0) return emptyLabel;
  if (value.length === 1) {
    return (
      options.find((opt) => opt.value === value[0])?.label ?? `${value.length} выбрано`
    );
  }
  return `${value.length} выбрано`;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  className,
  selectAllLabel = "Все каналы",
  allSelectedLabel = "Все",
  emptyLabel = "Не выбрано",
  emptyMeansAll = false,
  applyOnClose = false,
  noneValue,
  leadingExclusiveOption,
  searchable = false,
  searchPlaceholder = "Поиск...",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftValue, setDraftValue] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useAnchoredMenu(open, triggerRef, menuRef);
  const valueRef = useRef(value);
  const draftValueRef = useRef(draftValue);
  const openRef = useRef(open);
  const activeValue = applyOnClose && open ? draftValue : value;

  valueRef.current = value;
  draftValueRef.current = draftValue;
  openRef.current = open;

  const optionValues = useMemo(
    () => options.map((opt) => opt.value),
    [options],
  );

  const selectedSet = useMemo(
    () =>
      open
        ? buildSelectedSet(activeValue, options, emptyMeansAll, noneValue)
        : EMPTY_SELECTED_SET,
    [open, activeValue, options, emptyMeansAll, noneValue],
  );

  const displayText = useMemo(
    () =>
      getDisplayText(activeValue, options, {
        emptyMeansAll,
        allSelectedLabel,
        emptyLabel,
        noneValue,
      }),
    [activeValue, options, emptyMeansAll, allSelectedLabel, emptyLabel, noneValue],
  );

  const exclusiveSelected =
    leadingExclusiveOption != null &&
    !emptyMeansAll &&
    activeValue.length === 0;

  const effectivelyAll = isEffectivelyAll(
    activeValue,
    options.length,
    emptyMeansAll,
    noneValue,
  );

  const visibleOptions = useMemo(() => {
    if (!searchable) return options;
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchable, search]);

  useEffect(() => {
    if (!open) {
      setDraftValue(value);
      setSearch("");
    }
  }, [value, open]);

  const closeDropdown = useCallback(() => {
    if (!openRef.current) return;

    setOpen(false);

    if (applyOnClose && !arraysEqual(draftValueRef.current, valueRef.current)) {
      onChange(draftValueRef.current);
    }
  }, [applyOnClose, onChange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeDropdown();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

  useEffect(() => {
    if (!open) return;

    // Ignore scroll caused by the opening click (scrollIntoView / sticky bar).
    let armed = false;
    const armId = window.requestAnimationFrame(() => {
      armed = true;
    });

    function handleScroll(event: Event) {
      if (!armed) return;
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      closeDropdown();
    }

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.cancelAnimationFrame(armId);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, closeDropdown]);

  function commitValue(nextValue: string[]) {
    if (applyOnClose) {
      setDraftValue(nextValue);
      return;
    }
    onChange(nextValue);
  }

  function openDropdown() {
    setDraftValue(value);
    setOpen(true);
  }

  function toggleExclusive() {
    commitValue([]);
  }

  function toggleOption(optionValue: string) {
    if (exclusiveSelected) {
      commitValue([optionValue]);
      return;
    }

    const isSelected = selectedSet.has(optionValue);

    if (isSelected) {
      if (emptyMeansAll && activeValue.length === 0) {
        commitValue(optionValues.filter((id) => id !== optionValue));
        return;
      }
      const next = stripNoneValue(activeValue, noneValue).filter(
        (v) => v !== optionValue,
      );
      if (emptyMeansAll && next.length === 0) {
        commitValue(noneValue ? [noneValue] : []);
        return;
      }
      commitValue(next);
      return;
    }

    if (emptyMeansAll && activeValue.length === 0) {
      return;
    }

    commitValue([...stripNoneValue(activeValue, noneValue), optionValue]);
  }

  function toggleAll() {
    if (emptyMeansAll) {
      if (effectivelyAll) {
        commitValue(noneValue ? [noneValue] : []);
      } else {
        commitValue([]);
      }
      return;
    }
    if (activeValue.length === options.length) {
      commitValue([]);
      return;
    }
    commitValue(optionValues);
  }

  return (
    <div
      ref={rootRef}
      className={clsx(
        "relative flex w-full min-w-0 flex-col gap-1 xl:w-auto",
        className,
      )}
    >
      {label && <span className="text-xs text-[var(--muted)]">{label}</span>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-left text-sm leading-snug text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] xl:h-9 xl:min-w-[200px]"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          ref={menuRef}
          data-testid="multi-select-menu"
          className="fixed left-0 top-0 z-50 max-h-64 overflow-auto rounded-md border border-[var(--border)] bg-white py-1 shadow-lg"
        >
          {searchable && (
            <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-white px-2 py-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-[var(--border)] bg-white pl-7 pr-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}
          {leadingExclusiveOption && (
            <>
              <label className={OPTION_ROW_CLASS}>
                <input
                  type="checkbox"
                  checked={exclusiveSelected}
                  onChange={toggleExclusive}
                  className="h-4 w-4 shrink-0 rounded border-[var(--border)]"
                />
                <span className="truncate font-medium">{leadingExclusiveOption.label}</span>
              </label>
              <div className="my-1 border-t border-[var(--border)]" />
            </>
          )}
          <label className={OPTION_ROW_CLASS}>
            <input
              type="checkbox"
              checked={effectivelyAll}
              onChange={toggleAll}
              className="h-4 w-4 shrink-0 rounded border-[var(--border)]"
            />
            <span className="truncate font-medium">{selectAllLabel}</span>
          </label>
          <div className="my-1 border-t border-[var(--border)]" />
          {visibleOptions.map((opt) => (
            <label key={opt.value} className={OPTION_ROW_CLASS}>
              <input
                type="checkbox"
                checked={selectedSet.has(opt.value)}
                onChange={() => toggleOption(opt.value)}
                className="h-4 w-4 shrink-0 rounded border-[var(--border)]"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>,
          document.body,
        )}
    </div>
  );
}

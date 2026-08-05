"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

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
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
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
    () => buildSelectedSet(activeValue, options, emptyMeansAll, noneValue),
    [activeValue, options, emptyMeansAll, noneValue],
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

  const effectivelyAll = isEffectivelyAll(
    activeValue,
    options.length,
    emptyMeansAll,
    noneValue,
  );

  useEffect(() => {
    if (!open) {
      setDraftValue(value);
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
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

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

  function toggleOption(optionValue: string) {
    const isSelected = selectedSet.has(optionValue);

    if (isSelected) {
      if (emptyMeansAll && activeValue.length === 0) {
        commitValue(optionValues.filter((id) => id !== optionValue));
        return;
      }
      const next = stripNoneValue(activeValue, noneValue).filter(
        (v) => v !== optionValue,
      );
      commitValue(emptyMeansAll && next.length === 0 ? [] : next);
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
    <div ref={rootRef} className={clsx("relative flex w-full min-w-0 flex-col gap-1 sm:w-auto", className)}>
      {label && <span className="text-xs text-[var(--muted)]">{label}</span>}
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-left text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] sm:min-w-[200px]"
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
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full max-w-[min(100vw-2rem,320px)] overflow-y-auto rounded-md border border-[var(--border)] bg-white py-1 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--background)]">
            <input
              type="checkbox"
              checked={effectivelyAll}
              onChange={toggleAll}
              className="rounded border-[var(--border)]"
            />
            <span className="font-medium">{selectAllLabel}</span>
          </label>
          <div className="my-1 border-t border-[var(--border)]" />
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--background)]"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(opt.value)}
                onChange={() => toggleOption(opt.value)}
                className="rounded border-[var(--border)]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

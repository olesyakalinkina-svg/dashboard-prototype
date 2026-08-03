"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
};

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allSelected = value.length === options.length;
  const displayText = allSelected
    ? "Все"
    : value.length === 0
      ? "Не выбрано"
      : `${value.length} выбрано`;

  function toggleOption(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
      return;
    }
    onChange(options.map((opt) => opt.value));
  }

  return (
    <div ref={rootRef} className={clsx("relative flex w-full min-w-0 flex-col gap-1 sm:w-auto", className)}>
      {label && <span className="text-xs text-[var(--muted)]">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
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
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full min-w-[260px] overflow-y-auto rounded-md border border-[var(--border)] bg-white py-1 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--background)]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-[var(--border)]"
            />
            <span className="font-medium">Все каналы</span>
          </label>
          <div className="my-1 border-t border-[var(--border)]" />
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--background)]"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
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

"use client";

import clsx from "clsx";

export function TreeExpandButton({
  expanded,
  hasChildren,
  label,
  onToggle,
}: {
  expanded: boolean;
  hasChildren: boolean;
  label: string;
  onToggle: () => void;
}) {
  if (!hasChildren) {
    return <span className="inline-block w-11 shrink-0 xl:w-8" aria-hidden />;
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
        "relative z-20 inline-flex shrink-0 items-center justify-center rounded border border-[var(--border)] bg-white text-xs font-medium leading-none text-[var(--foreground)]",
        "h-11 w-11 xl:h-8 xl:w-8",
      )}
      aria-expanded={expanded}
      aria-label={expanded ? `Свернуть: ${label}` : `Развернуть: ${label}`}
    >
      <span aria-hidden>{expanded ? "−" : "+"}</span>
    </button>
  );
}

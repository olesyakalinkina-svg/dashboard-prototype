"use client";

import { ReferenceArea } from "recharts";

export const CHART_ZOOM_SURFACE_CLASS = "cursor-crosshair select-none";

export function ChartZoomHint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p className="mt-0.5 hidden text-[11px] text-[var(--muted)] sm:block">
      Выделите область мышью для приближения · двойной клик — сброс
    </p>
  );
}

export function ChartZoomResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
    >
      Сбросить масштаб
    </button>
  );
}

export function ChartZoomReferenceArea({
  selectionArea,
}: {
  selectionArea: { x1: string | number; x2: string | number } | null;
}) {
  if (!selectionArea) return null;

  return (
    <ReferenceArea
      x1={selectionArea.x1}
      x2={selectionArea.x2}
      stroke="var(--accent)"
      strokeOpacity={0.35}
      fill="var(--accent)"
      fillOpacity={0.12}
      ifOverflow="extendDomain"
    />
  );
}

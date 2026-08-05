import { useCallback, useEffect, useMemo, useState } from "react";

type ZoomChartRow = {
  [key: string]: string | number | null | undefined;
};

type ChartSyncState = {
  activeLabel?: string;
  activeTooltipIndex?: number;
} | null;

export type ChartAreaZoomOptions = {
  xKey?: string;
  yAggregate?: "max" | "sum";
};

function getIndexFromState(
  data: ZoomChartRow[],
  state: ChartSyncState,
  xKey: string,
): number {
  if (!state) return -1;
  if (
    state.activeTooltipIndex != null &&
    state.activeTooltipIndex >= 0 &&
    state.activeTooltipIndex < data.length
  ) {
    return state.activeTooltipIndex;
  }
  if (state.activeLabel) {
    return data.findIndex((row) => row[xKey] === state.activeLabel);
  }
  return -1;
}

export function useChartAreaZoom<T extends ZoomChartRow>(
  data: T[],
  valueKeys: (keyof T & string)[],
  resetDeps: unknown[] = [],
  options: ChartAreaZoomOptions = {},
) {
  const xKey = options.xKey ?? "period";
  const yAggregate = options.yAggregate ?? "max";

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(
    null,
  );

  useEffect(() => {
    setZoomRange(null);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, resetDeps);

  const displayData = useMemo(() => {
    if (!zoomRange) return data;
    return data.slice(zoomRange.start, zoomRange.end + 1);
  }, [data, zoomRange]);

  const isZoomed = zoomRange !== null;

  const resetZoom = useCallback(() => {
    setZoomRange(null);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, []);

  const handleMouseDown = useCallback(
    (state: ChartSyncState) => {
      const index = getIndexFromState(displayData, state, xKey);
      if (index < 0) return;
      setIsSelecting(true);
      setSelectionStart(index);
      setSelectionEnd(index);
    },
    [displayData, xKey],
  );

  const handleMouseMove = useCallback(
    (state: ChartSyncState) => {
      if (!isSelecting) return;
      const index = getIndexFromState(displayData, state, xKey);
      if (index < 0) return;
      setSelectionEnd(index);
    },
    [displayData, isSelecting, xKey],
  );

  const finishSelection = useCallback(() => {
    if (!isSelecting || selectionStart === null || selectionEnd === null) {
      setIsSelecting(false);
      return;
    }

    const relStart = Math.min(selectionStart, selectionEnd);
    const relEnd = Math.max(selectionStart, selectionEnd);

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);

    if (relEnd - relStart < 1) return;

    const offset = zoomRange?.start ?? 0;
    setZoomRange({
      start: offset + relStart,
      end: offset + relEnd,
    });
  }, [isSelecting, selectionEnd, selectionStart, zoomRange]);

  const selectionArea = useMemo(() => {
    if (
      !isSelecting ||
      selectionStart === null ||
      selectionEnd === null ||
      selectionStart === selectionEnd
    ) {
      return null;
    }

    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const x1 = displayData[start]?.[xKey];
    const x2 = displayData[end]?.[xKey];

    if (x1 == null || x2 == null) return null;

    return { x1, x2 };
  }, [displayData, isSelecting, selectionEnd, selectionStart, xKey]);

  const yDomain = useMemo((): [number, number] => {
    let max = 0;
    for (const row of displayData) {
      if (yAggregate === "sum") {
        let sum = 0;
        for (const key of valueKeys) {
          const value = row[key];
          if (typeof value === "number") sum += value;
        }
        max = Math.max(max, sum);
      } else {
        for (const key of valueKeys) {
          const value = row[key];
          if (typeof value === "number") {
            max = Math.max(max, value);
          }
        }
      }
    }
    return [0, max > 0 ? Math.ceil(max * 1.08) : 1];
  }, [displayData, valueKeys, yAggregate]);

  return {
    displayData,
    isZoomed,
    resetZoom,
    selectionArea,
    yDomain,
    chartHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: finishSelection,
      onMouseLeave: finishSelection,
      onDoubleClick: resetZoom,
    },
  };
}

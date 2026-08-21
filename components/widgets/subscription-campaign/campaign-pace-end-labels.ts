export const END_LABEL_FONT_SIZE = 10;
export const END_LABEL_LINE_HEIGHT = 12;
export const END_LABEL_MIN_GAP = 14;
export const END_LABEL_DX = 8;
export const END_LABEL_DEFAULT_NUDGE = 8;
export const END_LABEL_EDGE_PAD = 4;
/** Right plot margin so revenue totals like `42,8 млн ₽` fit to the right of the last dot. */
export const END_LABEL_CHART_RIGHT_MARGIN = 96;

export type EndLabelAnchor = {
  id: string;
  cx: number;
  cy: number;
  text: string;
  fill: string;
};

export type EndLabelBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type PlacedEndLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
  fill: string;
  textAnchor: "start" | "end";
};

export type FormattedGraphicalItem = {
  item?: { props?: { dataKey?: unknown } };
  props?: {
    dataKey?: unknown;
    points?: ReadonlyArray<{ x?: number | null; y?: number | null }>;
  };
};

type SizedLabel = PlacedEndLabel & { width: number };

export function estimateLabelWidth(
  text: string,
  fontSize = END_LABEL_FONT_SIZE,
): number {
  return Math.max(12, Math.ceil(text.length * fontSize * 0.7) + 4);
}

export function lastPointForDataKey(
  items: readonly FormattedGraphicalItem[] | undefined,
  dataKey: string,
): { cx: number; cy: number } | null {
  if (!items) return null;
  const item = items.find((entry) => graphicalDataKey(entry) === dataKey);
  const points = item?.props?.points;
  if (!points) return null;

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (
      point &&
      point.x != null &&
      point.y != null &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y)
    ) {
      return { cx: point.x, cy: point.y };
    }
  }
  return null;
}

function graphicalDataKey(item: FormattedGraphicalItem): unknown {
  return item.item?.props?.dataKey ?? item.props?.dataKey;
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function labelLeft(label: SizedLabel): number {
  return label.textAnchor === "end" ? label.x - label.width : label.x;
}

function labelRight(label: SizedLabel): number {
  return label.textAnchor === "end" ? label.x : label.x + label.width;
}

function horizontallyOverlap(a: SizedLabel, b: SizedLabel, pad = 2): boolean {
  return labelLeft(a) < labelRight(b) + pad && labelLeft(b) < labelRight(a) + pad;
}

function placeHorizontally(
  anchor: EndLabelAnchor,
  bounds: EndLabelBounds,
  dx: number,
  fontSize: number,
): SizedLabel {
  const width = estimateLabelWidth(anchor.text, fontSize);
  const preferRightX = anchor.cx + dx;
  const fitsRight = preferRightX + width <= bounds.right;

  if (fitsRight) {
    return {
      id: anchor.id,
      x: preferRightX,
      y: anchor.cy,
      text: anchor.text,
      fill: anchor.fill,
      textAnchor: "start",
      width,
    };
  }

  const flippedX = clamp(anchor.cx - dx, bounds.left + width, bounds.right);
  return {
    id: anchor.id,
    x: flippedX,
    y: anchor.cy,
    text: anchor.text,
    fill: anchor.fill,
    textAnchor: "end",
    width,
  };
}

function separateVertically(
  labels: SizedLabel[],
  bounds: EndLabelBounds,
  minGap: number,
  defaultNudge: number,
): void {
  const half = END_LABEL_LINE_HEIGHT / 2;
  const minY = bounds.top + half;
  const maxY = bounds.bottom - half;
  const byY = [...labels].sort((a, b) => a.y - b.y);

  if (byY.length >= 2) {
    const higher = byY[0]!;
    const lower = byY[1]!;
    higher.y -= defaultNudge;
    lower.y += defaultNudge;
  } else if (byY[0]) {
    byY[0].y -= defaultNudge;
  }

  for (const label of labels) {
    label.y = clamp(label.y, minY, maxY);
  }

  for (let pass = 0; pass < labels.length; pass += 1) {
    const ordered = [...labels].sort((a, b) => a.y - b.y);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const top = ordered[index]!;
      const bottom = ordered[index + 1]!;
      if (!horizontallyOverlap(top, bottom)) continue;
      const gap = bottom.y - top.y;
      if (gap >= minGap) continue;

      const needed = (minGap - gap) / 2;
      top.y = clamp(top.y - needed, minY, maxY);
      bottom.y = clamp(bottom.y + needed, minY, maxY);

      if (bottom.y - top.y < minGap) {
        bottom.y = clamp(top.y + minGap, minY, maxY);
      }
      if (bottom.y - top.y < minGap) {
        top.y = clamp(bottom.y - minGap, minY, maxY);
      }
    }
  }
}

export function placeEndLabels(
  anchors: readonly EndLabelAnchor[],
  bounds: EndLabelBounds,
  options?: {
    minGap?: number;
    dx?: number;
    fontSize?: number;
    defaultNudge?: number;
  },
): PlacedEndLabel[] {
  const minGap = options?.minGap ?? END_LABEL_MIN_GAP;
  const dx = options?.dx ?? END_LABEL_DX;
  const fontSize = options?.fontSize ?? END_LABEL_FONT_SIZE;
  const defaultNudge = options?.defaultNudge ?? END_LABEL_DEFAULT_NUDGE;

  const sized = anchors
    .filter((anchor) => anchor.text.length > 0 && Number.isFinite(anchor.cx) && Number.isFinite(anchor.cy))
    .map((anchor) => placeHorizontally(anchor, bounds, dx, fontSize));

  separateVertically(sized, bounds, minGap, defaultNudge);

  return sized.map((label) => ({
    id: label.id,
    x: label.x,
    y: label.y,
    text: label.text,
    fill: label.fill,
    textAnchor: label.textAnchor,
  }));
}

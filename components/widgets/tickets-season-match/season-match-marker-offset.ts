import {
  SEASON_MATCH_CHART_MARGIN,
  SEASON_MATCH_AXIS_TICK_HEIGHT,
  seasonMatchFactKey,
} from "@/lib/tickets-season-match-chart";

export const SEASON_MATCH_MARKER_RADIUS = 3.5;
export const SEASON_MATCH_MARKER_STROKE = 1.5;
/**
 * Center-to-center gap so hover dots at nearby revenues stay distinct.
 * ~20px is the default-plot distance between 22.6M and 19.8M on a 0–25M axis.
 */
export const SEASON_MATCH_MARKER_MIN_GAP = 24;
/** Nearby last-points (same day or ~1 compressed day) still collide in X. */
export const SEASON_MATCH_END_MARKER_X_GAP = 24;

export type MarkerAnchor = {
  id: string;
  cy: number;
};

export type SeasonMatchGraphicalItem = {
  item?: { props?: { dataKey?: unknown } };
  props?: {
    dataKey?: unknown;
    points?: ReadonlyArray<{
      x?: number | null;
      y?: number | null;
    }>;
  };
};

export type HoverMarkerSeries = {
  dataKey: string;
  color: string;
};

export type PlacedHoverMarker = {
  id: string;
  cx: number;
  cy: number;
  color: string;
};

function graphicalDataKey(item: SeasonMatchGraphicalItem): string {
  const key = item.item?.props?.dataKey ?? item.props?.dataKey;
  return key == null ? "" : String(key);
}

export function getSeasonMatchPlotHeight(chartHeight: number): number {
  return Math.max(
    1,
    chartHeight -
      SEASON_MATCH_CHART_MARGIN.top -
      SEASON_MATCH_CHART_MARGIN.bottom -
      SEASON_MATCH_AXIS_TICK_HEIGHT,
  );
}

export function valueToMarkerCy(
  value: number,
  yDomain: readonly [number, number],
  plotHeight: number,
): number {
  const [yMin, yMax] = yDomain;
  const range = yMax - yMin || 1;
  return ((yMax - value) / range) * plotHeight;
}

export function collectSeasonMatchMarkerAnchors(
  payload: Record<string, unknown> | undefined,
  matchIds: readonly string[],
  yDomain: readonly [number, number],
  plotHeight: number,
): MarkerAnchor[] {
  if (!payload) return [];

  const anchors: MarkerAnchor[] = [];
  for (const matchId of matchIds) {
    const id = seasonMatchFactKey(matchId);
    const value = payload[id];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    anchors.push({
      id,
      cy: valueToMarkerCy(value, yDomain, plotHeight),
    });
  }
  return anchors;
}

export function markerOffsetDy(
  dataKey: string,
  anchors: readonly MarkerAnchor[],
  options?: { minGap?: number; minY?: number; maxY?: number },
): number {
  const original = anchors.find((anchor) => anchor.id === dataKey);
  if (!original) return 0;

  const placed = offsetCollidingMarkers(anchors, options);
  const next = placed.find((anchor) => anchor.id === dataKey);
  return (next?.cy ?? original.cy) - original.cy;
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

type IndexedAnchor = MarkerAnchor & { index: number };

function packCluster(
  cluster: IndexedAnchor[],
  minGap: number,
  minY: number,
  maxY: number,
): void {
  if (cluster.length === 0) return;
  if (cluster.length === 1) {
    cluster[0]!.cy = clamp(cluster[0]!.cy, minY, maxY);
    return;
  }

  const span = (cluster.length - 1) * minGap;
  const centroid =
    cluster.reduce((sum, marker) => sum + marker.cy, 0) / cluster.length;
  let top = centroid - span / 2;

  if (Number.isFinite(minY) && top < minY) top = minY;
  if (Number.isFinite(maxY) && top + span > maxY) top = maxY - span;
  if (Number.isFinite(minY) && top < minY) top = minY;

  for (let i = 0; i < cluster.length; i += 1) {
    cluster[i]!.cy = clamp(top + i * minGap, minY, maxY);
  }
}

/**
 * Vertically separate markers at the same X when their pixel Y is closer
 * than minGap. Far-apart points stay on the line (no default nudge).
 */
export function offsetCollidingMarkers(
  anchors: readonly MarkerAnchor[],
  options?: { minGap?: number; minY?: number; maxY?: number },
): MarkerAnchor[] {
  const minGap = options?.minGap ?? SEASON_MATCH_MARKER_MIN_GAP;
  const minY = options?.minY ?? Number.NEGATIVE_INFINITY;
  const maxY = options?.maxY ?? Number.POSITIVE_INFINITY;

  const placed: IndexedAnchor[] = anchors
    .filter((anchor) => Number.isFinite(anchor.cy))
    .map((anchor, index) => ({
      id: anchor.id,
      cy: anchor.cy,
      index,
    }));

  if (placed.length <= 1) {
    return placed.map(({ id, cy }) => ({ id, cy }));
  }

  const ordered = [...placed].sort(
    (left, right) => left.cy - right.cy || left.index - right.index,
  );

  const clusters: IndexedAnchor[][] = [];
  for (const marker of ordered) {
    const cluster = clusters[clusters.length - 1];
    const previous = cluster?.[cluster.length - 1];
    if (cluster && previous && marker.cy - previous.cy < minGap) {
      cluster.push(marker);
    } else {
      clusters.push([marker]);
    }
  }

  for (let pass = 0; pass < clusters.length; pass += 1) {
    let merged = false;
    for (const cluster of clusters) {
      packCluster(cluster, minGap, minY, maxY);
    }
    for (let i = 0; i < clusters.length - 1; i += 1) {
      const current = clusters[i]!;
      const next = clusters[i + 1]!;
      const currentBottom = current[current.length - 1]!.cy;
      const nextTop = next[0]!.cy;
      if (nextTop - currentBottom < minGap) {
        current.push(...next);
        clusters.splice(i + 1, 1);
        merged = true;
        break;
      }
    }
    if (!merged) break;
  }

  return placed.map(({ id, cy }) => ({ id, cy }));
}

/**
 * One hover marker per series, at that series' own plotted (cx, cy).
 * Never reuse another series' pixel Y — that nested extra colors on the hovered line.
 */
export function placeSeasonMatchHoverMarkers(
  items: readonly SeasonMatchGraphicalItem[] | undefined,
  index: number,
  series: readonly HoverMarkerSeries[],
  options?: { minGap?: number; minY?: number; maxY?: number },
): PlacedHoverMarker[] {
  if (!items || index < 0 || !Number.isInteger(index)) return [];

  const seriesByKey = new Map(series.map((entry) => [entry.dataKey, entry]));
  const seen = new Set<string>();
  const raw: Array<MarkerAnchor & { cx: number; color: string }> = [];

  for (const item of items) {
    const dataKey = graphicalDataKey(item);
    const spec = seriesByKey.get(dataKey);
    if (!spec || seen.has(dataKey)) continue;

    const point = item.props?.points?.[index];
    if (
      point == null ||
      point.x == null ||
      point.y == null ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    ) {
      continue;
    }

    seen.add(dataKey);
    raw.push({
      id: dataKey,
      cx: point.x,
      cy: point.y,
      color: spec.color,
    });
  }

  const packedCy = new Map(
    offsetCollidingMarkers(
      raw.map(({ id, cy }) => ({ id, cy })),
      options,
    ).map((marker) => [marker.id, marker.cy]),
  );

  return raw.map((marker) => ({
    id: marker.id,
    cx: marker.cx,
    cy: packedCy.get(marker.id) ?? marker.cy,
    color: marker.color,
  }));
}

export function lastFinitePoint(
  items: readonly SeasonMatchGraphicalItem[] | undefined,
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

function clusterEndMarkersByProximity(
  markers: Array<MarkerAnchor & { cx: number; color: string }>,
  xGap: number,
  minGap: number,
): Array<Array<MarkerAnchor & { cx: number; color: string }>> {
  const parent = markers.map((_, index) => index);

  const find = (index: number): number => {
    const current = parent[index]!;
    if (current === index) return index;
    parent[index] = find(current);
    return parent[index]!;
  };

  const union = (left: number, right: number) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
  };

  for (let i = 0; i < markers.length; i += 1) {
    for (let j = i + 1; j < markers.length; j += 1) {
      const a = markers[i]!;
      const b = markers[j]!;
      const nearbyX = Math.abs(a.cx - b.cx) < xGap;
      const nearbyY = Math.abs(a.cy - b.cy) < minGap;
      const nearby = Math.hypot(a.cx - b.cx, a.cy - b.cy) < minGap;
      if ((nearbyX && nearbyY) || nearby) union(i, j);
    }
  }

  const groups = new Map<number, Array<MarkerAnchor & { cx: number; color: string }>>();
  for (let index = 0; index < markers.length; index += 1) {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(markers[index]!);
    groups.set(root, group);
  }
  return [...groups.values()];
}

/**
 * Always-visible last-point (plan) markers. Packs series that end on nearby
 * X with close Y so hollow end circles do not sit on top of each other.
 */
export function placeSeasonMatchEndMarkers(
  items: readonly SeasonMatchGraphicalItem[] | undefined,
  series: readonly HoverMarkerSeries[],
  options?: {
    minGap?: number;
    minY?: number;
    maxY?: number;
    xGap?: number;
  },
): PlacedHoverMarker[] {
  const minGap = options?.minGap ?? SEASON_MATCH_MARKER_MIN_GAP;
  const xGap = options?.xGap ?? SEASON_MATCH_END_MARKER_X_GAP;
  const raw: Array<MarkerAnchor & { cx: number; color: string }> = [];
  const seen = new Set<string>();

  for (const spec of series) {
    if (seen.has(spec.dataKey)) continue;
    const point = lastFinitePoint(items, spec.dataKey);
    if (!point) continue;
    seen.add(spec.dataKey);
    raw.push({
      id: spec.dataKey,
      cx: point.cx,
      cy: point.cy,
      color: spec.color,
    });
  }

  const packed = new Map<string, { cx: number; cy: number; color: string }>();
  for (const cluster of clusterEndMarkersByProximity(raw, xGap, minGap)) {
    const placedY = offsetCollidingMarkers(
      cluster.map(({ id, cy }) => ({ id, cy })),
      options,
    );
    const yById = new Map(placedY.map((marker) => [marker.id, marker.cy]));
    for (const marker of cluster) {
      packed.set(marker.id, {
        cx: marker.cx,
        cy: yById.get(marker.id) ?? marker.cy,
        color: marker.color,
      });
    }
  }

  return raw.map((marker) => {
    const next = packed.get(marker.id);
    return {
      id: marker.id,
      cx: next?.cx ?? marker.cx,
      cy: next?.cy ?? marker.cy,
      color: marker.color,
    };
  });
}

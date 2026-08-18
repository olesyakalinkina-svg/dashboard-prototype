/** Adaptive layout breakpoints. Prefer these over ad-hoc Tailwind `lg` (1024). */
export const MOBILE_MAX_PX = 767;
export const TABLET_MIN_PX = 768;
export const TABLET_MAX_PX = 1279;
export const DESKTOP_MIN_PX = 1280;
/** Compact charts may sit 2-col when each column is ≥360–400px (tablet landscape). */
export const COMPACT_CHART_TWO_COL_MIN_PX = 1024;
/** Side panel vs bottom sheet on tablet: below this, use a bottom sheet. */
export const FILTER_SIDE_PANEL_MIN_PX = 900;

export const LAYOUT_MEDIA = {
  mobile: `(max-width: ${MOBILE_MAX_PX}px)`,
  tablet: `(min-width: ${TABLET_MIN_PX}px) and (max-width: ${TABLET_MAX_PX}px)`,
  desktop: `(min-width: ${DESKTOP_MIN_PX}px)`,
  filterOverlay: `(max-width: ${TABLET_MAX_PX}px)`,
  filterBottomSheet: `(max-width: ${FILTER_SIDE_PANEL_MIN_PX - 1}px)`,
  filterSidePanel: `(min-width: ${FILTER_SIDE_PANEL_MIN_PX}px) and (max-width: ${TABLET_MAX_PX}px)`,
  compactChartTwoCol: `(min-width: ${COMPACT_CHART_TWO_COL_MIN_PX}px)`,
  coarsePointer: "(hover: none), (pointer: coarse)",
} as const;

export type LayoutMode = "mobile" | "tablet" | "desktop";

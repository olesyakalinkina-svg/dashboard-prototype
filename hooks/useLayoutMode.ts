"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  LAYOUT_MEDIA,
  type LayoutMode,
} from "@/lib/breakpoints";

/**
 * SSR-safe layout mode. Defaults to `desktop` until mounted so the first paint
 * matches current desktop markup (no hydration mismatch, no double table DOM).
 */
export function useLayoutMode(): LayoutMode {
  const isMobile = useMediaQuery(LAYOUT_MEDIA.mobile);
  const isTablet = useMediaQuery(LAYOUT_MEDIA.tablet);
  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}

export function useIsMobileLayout(): boolean {
  return useLayoutMode() === "mobile";
}

export function useIsDesktopLayout(): boolean {
  return useLayoutMode() === "desktop";
}

export function useFilterOverlayMode(): "none" | "sheet" | "panel" {
  const bottomSheet = useMediaQuery(LAYOUT_MEDIA.filterBottomSheet);
  const sidePanel = useMediaQuery(LAYOUT_MEDIA.filterSidePanel);
  if (bottomSheet) return "sheet";
  if (sidePanel) return "panel";
  return "none";
}

export function useIsCoarsePointer(): boolean {
  return useMediaQuery(LAYOUT_MEDIA.coarsePointer);
}

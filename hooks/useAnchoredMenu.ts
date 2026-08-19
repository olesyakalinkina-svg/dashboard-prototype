"use client";

import { useLayoutEffect, type RefObject } from "react";

const VIEWPORT_PAD = 8;

/**
 * Position a menu with `position: fixed` against the trigger.
 *
 * Coordinates are converted from viewport space to the menu's fixed containing
 * block. Ancestors with `transform`, `filter`, `backdrop-filter`, `contain`,
 * or `overflow: clip` (e.g. the sticky filter bar's `backdrop-blur-sm`) make
 * `top`/`left` relative to that ancestor instead of the viewport — using
 * `getBoundingClientRect()` alone then leaves a giant gap under the trigger.
 *
 * Callers should portal the menu to `document.body` so overflow/clipping on the
 * filter bar cannot hide it, and so `position: fixed` is viewport-relative.
 */
export function useAnchoredMenu(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  {
    gap = 4,
    matchTriggerWidth = true,
  }: { gap?: number; matchTriggerWidth?: boolean } = {},
) {
  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      menu.style.position = "fixed";
      menu.style.right = "auto";
      menu.style.zIndex = "80";
      menu.style.minWidth = `${rect.width}px`;
      if (matchTriggerWidth) {
        menu.style.width = `${rect.width}px`;
      }
      menu.style.maxWidth = `${vw - 16}px`;

      const currentTop = Number.parseFloat(menu.style.top) || 0;
      const currentLeft = Number.parseFloat(menu.style.left) || 0;
      const menuBox = menu.getBoundingClientRect();
      const originTop = menuBox.top - currentTop;
      const originLeft = menuBox.left - currentLeft;

      const menuH = menu.offsetHeight;
      const menuW = Math.min(menu.offsetWidth || rect.width, vw - 16);

      let viewportTop = rect.bottom + gap;
      if (
        viewportTop + menuH > vh - VIEWPORT_PAD &&
        rect.top - gap - menuH >= VIEWPORT_PAD
      ) {
        viewportTop = rect.top - gap - menuH;
      }
      viewportTop = Math.max(
        VIEWPORT_PAD,
        Math.min(viewportTop, Math.max(VIEWPORT_PAD, vh - menuH - VIEWPORT_PAD)),
      );

      const viewportLeft = Math.max(
        VIEWPORT_PAD,
        Math.min(rect.left, vw - menuW - VIEWPORT_PAD),
      );

      menu.style.top = `${viewportTop - originTop}px`;
      menu.style.left = `${viewportLeft - originLeft}px`;
      if (menuH > vh - 16) {
        menu.style.maxHeight = `${vh - 16}px`;
      }
    }

    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, triggerRef, menuRef, gap, matchTriggerWidth]);
}

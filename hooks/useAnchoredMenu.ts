"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Position a menu with `position: fixed` so it stays inside the viewport. */
export function useAnchoredMenu(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  gap = 4,
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
      const menuH = menu.offsetHeight;
      const menuW = Math.min(menu.offsetWidth || rect.width, vw - 16);

      let top = rect.bottom + gap;
      if (top + menuH > vh - 8 && rect.top - gap - menuH >= 8) {
        top = rect.top - gap - menuH;
      }
      top = Math.max(8, Math.min(top, Math.max(8, vh - menuH - 8)));

      let left = rect.left;
      left = Math.max(8, Math.min(left, vw - menuW - 8));

      menu.style.position = "fixed";
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
      menu.style.right = "auto";
      menu.style.width = `${Math.max(rect.width, Math.min(menuW, vw - 16))}px`;
      menu.style.maxWidth = `${vw - 16}px`;
      menu.style.maxHeight = `${Math.min(menuH || 320, vh - 16)}px`;
      menu.style.zIndex = "80";
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, triggerRef, menuRef, gap]);
}

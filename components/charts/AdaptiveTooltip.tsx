"use client";

import type { ComponentProps } from "react";
import { Tooltip } from "recharts";
import { useIsCoarsePointer } from "@/hooks/useLayoutMode";

/** Hover tooltips on desktop; tap-to-open on touch so charts stay usable. */
export function AdaptiveTooltip(props: ComponentProps<typeof Tooltip>) {
  const coarse = useIsCoarsePointer();
  return <Tooltip trigger={coarse ? "click" : "hover"} {...props} />;
}

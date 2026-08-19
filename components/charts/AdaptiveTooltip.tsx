"use client";

import {
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DefaultTooltipContent, Tooltip } from "recharts";
import { useIsCoarsePointer } from "@/hooks/useLayoutMode";

export const CHART_TOOLTIP_PORTAL_TEST_ID = "chart-tooltip-portal";

type TooltipRenderProps = {
  active?: boolean;
  payload?: unknown[];
  coordinate?: { x?: number; y?: number };
};

function ChartTooltipPortal({
  active,
  coordinate,
  children,
}: {
  active?: boolean;
  coordinate?: { x?: number; y?: number };
  children: ReactNode;
}) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const show = Boolean(active && children);

  useLayoutEffect(() => {
    if (!show || !markerRef.current) {
      setPos(null);
      return;
    }

    const wrapper = markerRef.current.closest(".recharts-wrapper");
    const rect = wrapper?.getBoundingClientRect();
    const x = coordinate?.x ?? 0;
    const y = coordinate?.y ?? 0;
    let left = (rect?.left ?? 0) + x + 12;
    let top = (rect?.top ?? 0) + y + 12;

    const box = boxRef.current;
    if (box) {
      const { width, height } = box.getBoundingClientRect();
      const pad = 8;
      if (rect && left + width > window.innerWidth - pad) {
        left = rect.left + x - width - 12;
      }
      if (rect && top + height > window.innerHeight - pad) {
        top = rect.top + y - height - 12;
      }
      left = Math.min(
        Math.max(pad, left),
        Math.max(pad, window.innerWidth - width - pad),
      );
      top = Math.min(
        Math.max(pad, top),
        Math.max(pad, window.innerHeight - height - pad),
      );
    }

    setPos((prev) =>
      prev && prev.left === left && prev.top === top ? prev : { left, top },
    );
  }, [show, coordinate?.x, coordinate?.y]);

  if (typeof document === "undefined") return null;

  return (
    <>
      <span ref={markerRef} hidden />
      {show
        ? createPortal(
            <div
              ref={boxRef}
              data-testid={CHART_TOOLTIP_PORTAL_TEST_ID}
              className="pointer-events-none fixed z-[80] max-h-[70vh]"
              style={{
                left: pos?.left ?? 0,
                top: pos?.top ?? 0,
                visibility: pos ? "visible" : "hidden",
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function renderTooltipInner(
  content: ComponentProps<typeof Tooltip>["content"],
  props: Record<string, unknown>,
): ReactNode {
  if (content == null) {
    return <DefaultTooltipContent {...props} />;
  }
  if (typeof content === "function") {
    return content(props as never);
  }
  if (isValidElement(content)) {
    return cloneElement(content, props as Partial<typeof content.props>);
  }
  return content;
}

function shouldShowInner(
  content: ComponentProps<typeof Tooltip>["content"],
  inner: ReactNode,
  props: TooltipRenderProps,
): boolean {
  if (!props.active) return false;
  if (content == null) {
    return Array.isArray(props.payload) && props.payload.length > 0;
  }
  return inner != null && inner !== false;
}

/**
 * Hover tooltips on desktop; tap-to-open on touch so charts stay usable.
 * Must keep displayName "Tooltip": Recharts only wires cursor/hover if a child
 * looks like its own Tooltip component.
 */
export function AdaptiveTooltip(props: ComponentProps<typeof Tooltip>) {
  const coarse = useIsCoarsePointer();
  const {
    content,
    wrapperStyle,
    allowEscapeViewBox,
    trigger,
    isAnimationActive = false,
    ...rest
  } = props;

  return (
    <Tooltip
      {...rest}
      trigger={trigger ?? (coarse ? "click" : "hover")}
      allowEscapeViewBox={{ x: true, y: true, ...allowEscapeViewBox }}
      isAnimationActive={isAnimationActive}
      wrapperStyle={{
        ...wrapperStyle,
        pointerEvents: "none",
        visibility: "hidden",
      }}
      content={(contentProps) => {
        const inner = renderTooltipInner(
          content,
          contentProps as Record<string, unknown>,
        );
        return (
          <ChartTooltipPortal
            active={shouldShowInner(content, inner, contentProps)}
            coordinate={contentProps.coordinate}
          >
            {inner}
          </ChartTooltipPortal>
        );
      }}
    />
  );
}

AdaptiveTooltip.displayName = "Tooltip";

import { describe, expect, it } from "vitest";
import {
  END_LABEL_DEFAULT_NUDGE,
  END_LABEL_DX,
  END_LABEL_MIN_GAP,
  estimateLabelWidth,
  lastPointForDataKey,
  placeEndLabels,
} from "@/components/widgets/subscription-campaign/campaign-pace-end-labels";

const BOUNDS = { left: 40, right: 360, top: 12, bottom: 260 };

describe("estimateLabelWidth", () => {
  it("grows with the formatted total", () => {
    expect(estimateLabelWidth("3 598")).toBeLessThan(estimateLabelWidth("42,8 млн ₽"));
    expect(estimateLabelWidth("3 598")).toBeGreaterThan(20);
  });
});

describe("lastPointForDataKey", () => {
  it("returns the last finite plotted point for a series", () => {
    const point = lastPointForDataKey(
      [
        {
          item: { props: { dataKey: "currentSeasonCount" } },
          props: {
            points: [
              { x: 10, y: 80 },
              { x: 20, y: null },
              { x: 30, y: 40 },
            ],
          },
        },
      ],
      "currentSeasonCount",
    );

    expect(point).toEqual({ cx: 30, cy: 40 });
  });

  it("skips trailing null coordinates", () => {
    const point = lastPointForDataKey(
      [
        {
          props: {
            dataKey: "benchmarkSeasonCount",
            points: [
              { x: 10, y: 90 },
              { x: 20, y: 70 },
              { x: 30, y: null },
            ],
          },
        },
      ],
      "benchmarkSeasonCount",
    );

    expect(point).toEqual({ cx: 20, cy: 70 });
  });
});

describe("placeEndLabels", () => {
  it("keeps far-apart labels next to their own points", () => {
    const [higher, lower] = placeEndLabels(
      [
        { id: "current", cx: 300, cy: 40, text: "3 598", fill: "#5282FF" },
        { id: "benchmark", cx: 300, cy: 180, text: "2 100", fill: "#6B7280" },
      ],
      BOUNDS,
    );

    expect(higher.id).toBe("current");
    expect(lower.id).toBe("benchmark");
    expect(higher.y).toBeCloseTo(40 - END_LABEL_DEFAULT_NUDGE);
    expect(lower.y).toBeCloseTo(180 + END_LABEL_DEFAULT_NUDGE);
    expect(higher.x).toBe(300 + END_LABEL_DX);
    expect(higher.textAnchor).toBe("start");
    expect(Math.abs(lower.y - higher.y)).toBeGreaterThan(END_LABEL_MIN_GAP);
  });

  it("splits close last-day totals above and below so they do not collide", () => {
    const placed = placeEndLabels(
      [
        { id: "current", cx: 300, cy: 42, text: "3 598", fill: "#5282FF" },
        { id: "benchmark", cx: 300, cy: 48, text: "3 410", fill: "#6B7280" },
      ],
      BOUNDS,
    );

    const current = placed.find((label) => label.id === "current")!;
    const benchmark = placed.find((label) => label.id === "benchmark")!;

    expect(current.y).toBeLessThan(benchmark.y);
    expect(benchmark.y - current.y).toBeGreaterThanOrEqual(END_LABEL_MIN_GAP);
    expect(current.text).toBe("3 598");
    expect(benchmark.text).toBe("3 410");
  });

  it("pushes the lower label down when the higher one is already at the top edge", () => {
    const placed = placeEndLabels(
      [
        { id: "current", cx: 300, cy: 14, text: "3 598", fill: "#5282FF" },
        { id: "benchmark", cx: 300, cy: 18, text: "3 410", fill: "#6B7280" },
      ],
      BOUNDS,
    );

    const current = placed.find((label) => label.id === "current")!;
    const benchmark = placed.find((label) => label.id === "benchmark")!;

    expect(current.y).toBeGreaterThanOrEqual(BOUNDS.top);
    expect(benchmark.y).toBeGreaterThan(current.y);
    expect(benchmark.y - current.y).toBeGreaterThanOrEqual(END_LABEL_MIN_GAP);
    expect(benchmark.y).toBeLessThanOrEqual(BOUNDS.bottom);
  });

  it("flips a long label left of the last point when it would overflow the right edge", () => {
    const [label] = placeEndLabels(
      [{ id: "revenue", cx: 340, cy: 80, text: "42,8 млн ₽", fill: "#5282FF" }],
      { left: 40, right: 360, top: 12, bottom: 260 },
    );

    expect(label.textAnchor).toBe("end");
    expect(label.x).toBeLessThanOrEqual(360);
    expect(label.x - estimateLabelWidth("42,8 млн ₽")).toBeGreaterThanOrEqual(40);
  });

  it("keeps a short label to the right of the last point when it fits", () => {
    const [label] = placeEndLabels(
      [{ id: "count", cx: 280, cy: 80, text: "3 598", fill: "#5282FF" }],
      BOUNDS,
    );

    expect(label.textAnchor).toBe("start");
    expect(label.x).toBe(280 + END_LABEL_DX);
  });

  it("splits equal last-point values with the first series above", () => {
    const [current, benchmark] = placeEndLabels(
      [
        { id: "currentSeasonRevenue", cx: 300, cy: 50, text: "42,8 млн ₽", fill: "#5282FF" },
        { id: "benchmarkSeasonRevenue", cx: 300, cy: 50, text: "41,2 млн ₽", fill: "#6B7280" },
      ],
      BOUNDS,
    );

    expect(current.y).toBeLessThan(benchmark.y);
    expect(benchmark.y - current.y).toBeGreaterThanOrEqual(END_LABEL_MIN_GAP);
  });
});

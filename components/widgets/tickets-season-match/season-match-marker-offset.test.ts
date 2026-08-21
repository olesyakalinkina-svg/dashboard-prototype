import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seasonMatchFactKey, seasonMatchPlanKey } from "@/lib/tickets-season-match-chart";
import {
  collectSeasonMatchMarkerAnchors,
  getSeasonMatchPlotHeight,
  lastFinitePoint,
  markerOffsetDy,
  offsetCollidingMarkers,
  placeSeasonMatchEndMarkers,
  placeSeasonMatchHoverMarkers,
  SEASON_MATCH_MARKER_MIN_GAP,
  SEASON_MATCH_MARKER_RADIUS,
  valueToMarkerCy,
} from "@/components/widgets/tickets-season-match/season-match-marker-offset";

describe("offsetCollidingMarkers", () => {
  it("leaves far-apart markers on their original y", () => {
    const placed = offsetCollidingMarkers([
      { id: "fact_avangard", cy: 20 },
      { id: "fact_spartak", cy: 80 },
      { id: "fact_ska", cy: 140 },
    ]);

    expect(placed).toEqual([
      { id: "fact_avangard", cy: 20 },
      { id: "fact_spartak", cy: 80 },
      { id: "fact_ska", cy: 140 },
    ]);
  });

  it("does not jitter when the gap already equals minGap", () => {
    const placed = offsetCollidingMarkers(
      [
        { id: "a", cy: 40 },
        { id: "b", cy: 40 + SEASON_MATCH_MARKER_MIN_GAP },
      ],
      { minGap: SEASON_MATCH_MARKER_MIN_GAP },
    );

    expect(placed[0]?.cy).toBe(40);
    expect(placed[1]?.cy).toBe(40 + SEASON_MATCH_MARKER_MIN_GAP);
  });

  it("splits close markers above and below so they do not overlap", () => {
    const placed = offsetCollidingMarkers([
      { id: "fact_avangard", cy: 42 },
      { id: "fact_spartak", cy: 48 },
    ]);

    const avangard = placed.find((marker) => marker.id === "fact_avangard")!;
    const spartak = placed.find((marker) => marker.id === "fact_spartak")!;

    expect(avangard.cy).toBeLessThan(spartak.cy);
    expect(spartak.cy - avangard.cy).toBeGreaterThanOrEqual(
      SEASON_MATCH_MARKER_MIN_GAP,
    );
    expect(spartak.cy - avangard.cy).toBeGreaterThan(2 * SEASON_MATCH_MARKER_RADIUS);
  });

  it("keeps the first series above when values are equal", () => {
    const [first, second] = offsetCollidingMarkers([
      { id: "fact_spartak", cy: 50 },
      { id: "fact_avangard", cy: 50 },
    ]);

    expect(first.id).toBe("fact_spartak");
    expect(second.id).toBe("fact_avangard");
    expect(first.cy).toBeLessThan(second.cy);
    expect(second.cy - first.cy).toBeGreaterThanOrEqual(SEASON_MATCH_MARKER_MIN_GAP);
  });

  it("spreads three stacked markers so every pair clears minGap", () => {
    const placed = offsetCollidingMarkers([
      { id: "a", cy: 60 },
      { id: "b", cy: 61 },
      { id: "c", cy: 62 },
    ]);

    const ordered = [...placed].sort((left, right) => left.cy - right.cy);
    expect(ordered[1]!.cy - ordered[0]!.cy).toBeGreaterThanOrEqual(
      SEASON_MATCH_MARKER_MIN_GAP,
    );
    expect(ordered[2]!.cy - ordered[1]!.cy).toBeGreaterThanOrEqual(
      SEASON_MATCH_MARKER_MIN_GAP,
    );
  });

  it("pushes the lower marker down when the higher one is already at the top edge", () => {
    const placed = offsetCollidingMarkers(
      [
        { id: "high", cy: 4 },
        { id: "low", cy: 6 },
      ],
      { minY: 4, maxY: 200 },
    );

    const high = placed.find((marker) => marker.id === "high")!;
    const low = placed.find((marker) => marker.id === "low")!;

    expect(high.cy).toBeGreaterThanOrEqual(4);
    expect(low.cy).toBeGreaterThan(high.cy);
    expect(low.cy - high.cy).toBeGreaterThanOrEqual(SEASON_MATCH_MARKER_MIN_GAP);
    expect(low.cy).toBeLessThanOrEqual(200);
  });
});

describe("collectSeasonMatchMarkerAnchors / screenshot 15 сен", () => {
  const yDomain = [0, 25_000_000] as const;
  const plotHeight = getSeasonMatchPlotHeight(260);
  const payload = {
    [seasonMatchFactKey("avangard")]: 22_595_628,
    [seasonMatchFactKey("spartak")]: 19_809_337,
    [seasonMatchFactKey("ska")]: 16_973_070,
  };

  it("maps the three match values to plot y without dropping a series", () => {
    const anchors = collectSeasonMatchMarkerAnchors(
      payload,
      ["spartak", "avangard", "ska"],
      yDomain,
      plotHeight,
    );

    expect(anchors.map((anchor) => anchor.id)).toEqual([
      seasonMatchFactKey("spartak"),
      seasonMatchFactKey("avangard"),
      seasonMatchFactKey("ska"),
    ]);
    expect(anchors).toHaveLength(3);
  });

  it("separates Avangard and Spartak hover dots when 22.6M and 19.8M sit close", () => {
    const anchors = collectSeasonMatchMarkerAnchors(
      payload,
      ["spartak", "avangard", "ska"],
      yDomain,
      plotHeight,
    );
    const placed = offsetCollidingMarkers(anchors, {
      minY: SEASON_MATCH_MARKER_RADIUS,
      maxY: plotHeight - SEASON_MATCH_MARKER_RADIUS,
    });

    const avangard = placed.find(
      (marker) => marker.id === seasonMatchFactKey("avangard"),
    )!;
    const spartak = placed.find(
      (marker) => marker.id === seasonMatchFactKey("spartak"),
    )!;
    const ska = placed.find(
      (marker) => marker.id === seasonMatchFactKey("ska"),
    )!;

    expect(avangard.cy).toBeLessThan(spartak.cy);
    expect(spartak.cy - avangard.cy).toBeGreaterThanOrEqual(
      SEASON_MATCH_MARKER_MIN_GAP,
    );
    expect(ska.cy - spartak.cy).toBeGreaterThanOrEqual(SEASON_MATCH_MARKER_MIN_GAP);
  });

  it("nudges the higher series up so Avangard and Spartak no longer share a pixel y", () => {
    const anchors = collectSeasonMatchMarkerAnchors(
      payload,
      ["spartak", "avangard", "ska"],
      yDomain,
      plotHeight,
    );
    const avangardKey = seasonMatchFactKey("avangard");
    const spartakKey = seasonMatchFactKey("spartak");

    expect(markerOffsetDy(avangardKey, anchors)).toBeLessThan(0);
    expect(
      markerOffsetDy(spartakKey, anchors) - markerOffsetDy(avangardKey, anchors),
    ).toBeGreaterThan(0);
  });

  it("skips null series so hidden or not-yet-on-sale matches are not placed", () => {
    const anchors = collectSeasonMatchMarkerAnchors(
      {
        ...payload,
        [seasonMatchFactKey("ska")]: null,
      },
      ["spartak", "avangard", "ska"],
      yDomain,
      plotHeight,
    );

    expect(anchors.map((anchor) => anchor.id)).toEqual([
      seasonMatchFactKey("spartak"),
      seasonMatchFactKey("avangard"),
    ]);
  });
});

describe("valueToMarkerCy", () => {
  it("puts the domain max at the top of the plot", () => {
    expect(valueToMarkerCy(25_000_000, [0, 25_000_000], 180)).toBe(0);
    expect(valueToMarkerCy(0, [0, 25_000_000], 180)).toBe(180);
  });
});

describe("placeSeasonMatchHoverMarkers", () => {
  const avangard = seasonMatchFactKey("avangard");
  const spartak = seasonMatchFactKey("spartak");
  const ska = seasonMatchFactKey("ska");
  const series = [
    { dataKey: avangard, color: "#22c55e" },
    { dataKey: spartak, color: "#3b82f6" },
    { dataKey: ska, color: "#a855f7" },
  ];

  it("places each series at its own plotted y, not the hovered series' y", () => {
    const placed = placeSeasonMatchHoverMarkers(
      [
        {
          props: {
            dataKey: avangard,
            points: [
              { x: 120, y: 36 },
              { x: 180, y: 30 },
            ],
          },
        },
        {
          props: {
            dataKey: spartak,
            points: [
              { x: 120, y: 88 },
              { x: 180, y: 80 },
            ],
          },
        },
        {
          props: {
            dataKey: ska,
            points: [
              { x: 120, y: 140 },
              { x: 180, y: 132 },
            ],
          },
        },
      ],
      1,
      series,
    );

    expect(placed).toHaveLength(3);
    expect(placed.find((marker) => marker.id === avangard)).toEqual({
      id: avangard,
      cx: 180,
      cy: 30,
      color: "#22c55e",
    });
    expect(placed.find((marker) => marker.id === spartak)).toEqual({
      id: spartak,
      cx: 180,
      cy: 80,
      color: "#3b82f6",
    });
    expect(placed.find((marker) => marker.id === ska)).toEqual({
      id: ska,
      cx: 180,
      cy: 132,
      color: "#a855f7",
    });
    expect(new Set(placed.map((marker) => marker.color)).size).toBe(3);
    expect(placed.filter((marker) => marker.cy === 30)).toHaveLength(1);
  });

  it("never draws another series' color at the hovered line's y", () => {
    const hoveredGreenY = 28;
    const placed = placeSeasonMatchHoverMarkers(
      [
        {
          item: { props: { dataKey: avangard } },
          props: { points: [{ x: 200, y: hoveredGreenY }] },
        },
        {
          item: { props: { dataKey: spartak } },
          props: { points: [{ x: 200, y: 72 }] },
        },
        {
          item: { props: { dataKey: ska } },
          props: { points: [{ x: 200, y: 118 }] },
        },
      ],
      0,
      series,
    );

    const onGreenLine = placed.filter((marker) => marker.cy === hoveredGreenY);
    expect(onGreenLine).toEqual([
      { id: avangard, cx: 200, cy: hoveredGreenY, color: "#22c55e" },
    ]);
    expect(placed.find((marker) => marker.color === "#3b82f6")?.cy).toBe(72);
  });

  it("packs close per-series y values without collapsing them onto one cy", () => {
    const placed = placeSeasonMatchHoverMarkers(
      [
        { props: { dataKey: avangard, points: [{ x: 90, y: 40 }] } },
        { props: { dataKey: spartak, points: [{ x: 90, y: 46 }] } },
        { props: { dataKey: ska, points: [{ x: 90, y: 140 }] } },
      ],
      0,
      series,
    );

    const avangardCy = placed.find((marker) => marker.id === avangard)!.cy;
    const spartakCy = placed.find((marker) => marker.id === spartak)!.cy;
    const skaCy = placed.find((marker) => marker.id === ska)!.cy;

    expect(spartakCy - avangardCy).toBeGreaterThanOrEqual(SEASON_MATCH_MARKER_MIN_GAP);
    expect(skaCy).toBe(140);
    expect(placed).toHaveLength(3);
  });

  it("skips null y so a series without a point at that x is not drawn on another line", () => {
    const placed = placeSeasonMatchHoverMarkers(
      [
        { props: { dataKey: avangard, points: [{ x: 90, y: 40 }] } },
        { props: { dataKey: spartak, points: [{ x: 90, y: null }] } },
        { props: { dataKey: ska, points: [{ x: 90, y: 140 }] } },
      ],
      0,
      series,
    );

    expect(placed.map((marker) => marker.id)).toEqual([avangard, ska]);
  });

  it("keeps a single marker per dataKey even if Recharts lists the item twice", () => {
    const placed = placeSeasonMatchHoverMarkers(
      [
        { props: { dataKey: avangard, points: [{ x: 90, y: 40 }] } },
        { props: { dataKey: avangard, points: [{ x: 90, y: 40 }] } },
        { props: { dataKey: spartak, points: [{ x: 90, y: 40 }] } },
      ],
      0,
      series,
    );

    expect(placed.filter((marker) => marker.id === avangard)).toHaveLength(1);
    expect(placed).toHaveLength(2);
  });
});

describe("placeSeasonMatchEndMarkers", () => {
  const avangard = seasonMatchPlanKey("avangard");
  const spartak = seasonMatchPlanKey("spartak");
  const ska = seasonMatchPlanKey("ska");
  const series = [
    { dataKey: avangard, color: "#22c55e" },
    { dataKey: spartak, color: "#3b82f6" },
    { dataKey: ska, color: "#a855f7" },
  ];

  it("reads the last finite point per series, skipping trailing nulls", () => {
    expect(
      lastFinitePoint(
        [
          {
            props: {
              dataKey: avangard,
              points: [
                { x: 10, y: 80 },
                { x: 20, y: 40 },
                { x: 30, y: null },
              ],
            },
          },
        ],
        avangard,
      ),
    ).toEqual({ cx: 20, cy: 40 });
  });

  it("splits green and blue last-points that share an x near 20.09 so hollow circles do not overlap", () => {
    const placed = placeSeasonMatchEndMarkers(
      [
        {
          props: {
            dataKey: avangard,
            points: [
              { x: 100, y: null },
              { x: 180, y: 42 },
            ],
          },
        },
        {
          props: {
            dataKey: spartak,
            points: [
              { x: 100, y: null },
              { x: 180, y: 50 },
            ],
          },
        },
        {
          props: {
            dataKey: ska,
            points: [
              { x: 100, y: null },
              { x: 260, y: 70 },
            ],
          },
        },
      ],
      series,
    );

    const green = placed.find((marker) => marker.id === avangard)!;
    const blue = placed.find((marker) => marker.id === spartak)!;
    const purple = placed.find((marker) => marker.id === ska)!;

    expect(green.cx).toBe(180);
    expect(blue.cx).toBe(180);
    expect(Math.abs(blue.cy - green.cy)).toBeGreaterThanOrEqual(
      SEASON_MATCH_MARKER_MIN_GAP,
    );
    expect(purple.cx).toBe(260);
    expect(purple.cy).toBe(70);
  });

  it("also packs last-points on nearby x when y is close", () => {
    const placed = placeSeasonMatchEndMarkers(
      [
        { props: { dataKey: avangard, points: [{ x: 180, y: 44 }] } },
        { props: { dataKey: spartak, points: [{ x: 188, y: 50 }] } },
      ],
      series,
    );

    const green = placed.find((marker) => marker.id === avangard)!;
    const blue = placed.find((marker) => marker.id === spartak)!;
    expect(Math.abs(blue.cy - green.cy)).toBeGreaterThanOrEqual(
      SEASON_MATCH_MARKER_MIN_GAP,
    );
    expect(green.cx).toBe(180);
    expect(blue.cx).toBe(188);
  });

  it("leaves a far last-point on its own y", () => {
    const placed = placeSeasonMatchEndMarkers(
      [
        { props: { dataKey: avangard, points: [{ x: 180, y: 40 }] } },
        { props: { dataKey: ska, points: [{ x: 320, y: 42 }] } },
      ],
      series,
    );

    expect(placed.find((marker) => marker.id === avangard)?.cy).toBe(40);
    expect(placed.find((marker) => marker.id === ska)?.cy).toBe(42);
  });
});

describe("TicketsSeasonMatchChart hover dots", () => {
  const chart = readFileSync(
    join(
      process.cwd(),
      "components/widgets/tickets-season-match/TicketsSeasonMatchChart.tsx",
    ),
    "utf8",
  );

  it("does not use Recharts activeDot, which stacked a default hollow ring plus extra series colors on the hovered y", () => {
    expect(chart).toContain("activeDot={false}");
    expect(chart).toContain("placeSeasonMatchHoverMarkers");
    expect(chart).toContain("Customized");
    expect(chart).not.toContain("SeasonMatchActiveDot");
    expect(chart).not.toContain("activeDot={renderFactDot}");
  });

  it("draws packed idle end dots in Customized instead of overlapping Line plan dots", () => {
    expect(chart).toContain("placeSeasonMatchEndMarkers");
    expect(chart).toContain("dot={false}");
    expect(chart).toContain("SeasonMatchPlanDot");
    expect(chart).not.toContain("<TicketsSeasonMatchPlanMarker");
  });
});

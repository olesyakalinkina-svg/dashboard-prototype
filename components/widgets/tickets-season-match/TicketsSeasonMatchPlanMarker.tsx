"use client";

import { seasonMatchPlanKey } from "@/lib/tickets-season-match-chart";

type PlanMarkerProps = {
  cx?: number;
  cy?: number;
  payload?: Record<string, number | null | undefined>;
  color: string;
  matchId: string;
  visible?: boolean;
};

export function SeasonMatchPlanDot({
  cx,
  cy,
  color,
  markerId,
}: {
  cx: number;
  cy: number;
  color: string;
  markerId?: string;
}) {
  return (
    <g
      className="season-match-end-dot"
      data-testid="season-match-end-dot"
      data-marker-id={markerId}
      data-cx={cx}
      data-cy={cy}
    >
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill={color}
        fillOpacity={0.14}
        stroke="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={5.5}
        fill="#fff"
        stroke={color}
        strokeWidth={1.5}
      />
    </g>
  );
}

export function TicketsSeasonMatchPlanMarker({
  cx,
  cy,
  payload,
  color,
  matchId,
  visible = true,
}: PlanMarkerProps) {
  if (!visible || cx == null || cy == null) return null;

  const value = payload?.[seasonMatchPlanKey(matchId)];
  if (value == null) return null;

  return <SeasonMatchPlanDot cx={cx} cy={cy} color={color} markerId={matchId} />;
}

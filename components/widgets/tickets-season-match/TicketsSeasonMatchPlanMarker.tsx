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

  return (
    <g>
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

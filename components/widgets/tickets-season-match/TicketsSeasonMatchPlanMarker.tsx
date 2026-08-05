"use client";

import {
  formatRevenueThousandsLabel,
  seasonMatchPlanKey,
} from "@/lib/tickets-season-match-chart";

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

  const label = `План ${formatRevenueThousandsLabel(value)}`;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={14}
        fill={color}
        fillOpacity={0.14}
        stroke="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={11}
        fill="#fff"
        stroke={color}
        strokeWidth={3}
      />
      <text
        x={cx}
        y={cy - 18}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}

"use client";

import clsx from "clsx";
import type { CampaignPacePoint } from "@/lib/subscription-campaign";
import {
  formatCampaignDate,
  formatCampaignDayTitle,
  formatFullCount,
  formatFullRevenue,
  formatPercentageGap,
  formatSignedNumber,
  ZERO_BASE_LABEL,
} from "@/lib/subscription-campaign";

export const CAMPAIGN_PACE_MAIN_COLOR = "#5282FF";
export const CAMPAIGN_PACE_BENCHMARK_COLOR = "#6B7280";

export type CampaignPaceHighlight = "count" | "revenue";

type TooltipPayloadEntry = {
  payload?: CampaignPacePoint;
};

export function CampaignPaceTooltip({
  active,
  payload,
  mainSeasonName,
  benchmarkSeasonName,
  highlight,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  mainSeasonName: string;
  benchmarkSeasonName: string;
  highlight: CampaignPaceHighlight;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const countGapText =
    point.countAbsoluteGap == null
      ? "—"
      : point.countAbsoluteGap === 0
        ? "0 абонементов"
        : `${formatSignedNumber(point.countAbsoluteGap)} абонементов`;
  const revenueGapText =
    point.revenueAbsoluteGap == null
      ? "—"
      : point.revenueAbsoluteGap === 0
        ? "0 ₽"
        : `${formatSignedNumber(point.revenueAbsoluteGap)} ₽`;

  const countDynamics =
    formatPercentageGap(point.countPercentageGap) ?? ZERO_BASE_LABEL;
  const revenueDynamics =
    formatPercentageGap(point.revenuePercentageGap) ?? ZERO_BASE_LABEL;

  return (
    <div className="max-w-[240px] rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-2 font-medium text-[var(--foreground)]">
        {formatCampaignDayTitle(point.campaignDay)}
      </p>
      <SeasonBlock
        name={mainSeasonName}
        date={point.currentSeasonDate}
        count={point.currentSeasonCount}
        revenue={point.currentSeasonRevenue}
        color={CAMPAIGN_PACE_MAIN_COLOR}
        highlight={highlight}
      />
      <SeasonBlock
        name={benchmarkSeasonName}
        date={point.benchmarkSeasonDate}
        count={point.benchmarkSeasonCount}
        revenue={point.benchmarkSeasonRevenue}
        color={CAMPAIGN_PACE_BENCHMARK_COLOR}
        highlight={highlight}
      />
      <div className="border-t border-[var(--border)] pt-1.5">
        <p>
          Разрыв:{" "}
          {highlight === "count" ? countGapText : revenueGapText}
        </p>
        <p>
          Динамика: {highlight === "count" ? countDynamics : revenueDynamics}
        </p>
      </div>
    </div>
  );
}

function SeasonBlock({
  name,
  date,
  count,
  revenue,
  color,
  highlight,
}: {
  name: string;
  date: string | null;
  count: number | null;
  revenue: number | null;
  color: string;
  highlight: CampaignPaceHighlight;
}) {
  return (
    <div className="mb-2 border-b border-[var(--border)] pb-2 last:mb-0">
      <p className="font-medium" style={{ color }}>
        {name}
      </p>
      <p>Дата: {formatCampaignDate(date)}</p>
      <p className={clsx(highlight === "count" && "font-semibold")}>
        Абонементы: {formatFullCount(count)}
      </p>
      <p className={clsx(highlight === "revenue" && "font-semibold")}>
        Выручка: {formatFullRevenue(revenue)}
      </p>
    </div>
  );
}

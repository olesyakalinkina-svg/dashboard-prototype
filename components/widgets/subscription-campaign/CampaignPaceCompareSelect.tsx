"use client";

import { Select } from "@/components/ui/Select";
import type { SeasonTicketCampaignConfig } from "@/lib/subscription-campaign";

export function CampaignPaceCompareSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly SeasonTicketCampaignConfig[];
  value: string;
  onChange: (seasonId: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      label="Сравнить с:"
      value={value}
      disabled={disabled || options.length === 0}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 sm:min-h-9 sm:min-w-[140px]"
    >
      {options.map((campaign) => (
        <option key={campaign.seasonId} value={campaign.seasonId}>
          {campaign.seasonName}
        </option>
      ))}
    </Select>
  );
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AdaptiveTooltip,
  CHART_TOOLTIP_PORTAL_TEST_ID,
} from "@/components/charts/AdaptiveTooltip";

function Tip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return <div>Revenue {payload[0].value}</div>;
}

describe("AdaptiveTooltip", () => {
  it("uses Recharts Tooltip displayName so hover events are wired", () => {
    expect(AdaptiveTooltip.displayName).toBe("Tooltip");
  });

  it("portals tooltip content to document.body so chart overflow cannot clip it", () => {
    render(
      <div className="recharts-wrapper">
        <AdaptiveTooltip
          active
          payload={[{ value: 10, name: "Выручка" }]}
          coordinate={{ x: 24, y: 16 }}
          content={<Tip />}
        />
      </div>,
    );

    const portal = screen.getByTestId(CHART_TOOLTIP_PORTAL_TEST_ID);
    expect(portal.textContent).toContain("Revenue 10");
    expect(portal.parentElement).toBe(document.body);
  });

  it("is the only Tooltip used by dashboard charts", () => {
    const files = [
      "components/widgets/Charts.tsx",
      "components/widgets/TicketsPlanFactWidget.tsx",
      "components/widgets/tickets-season-match/TicketsSeasonMatchChart.tsx",
      "components/widgets/TicketsSalesChannelsTrendWidget.tsx",
      "components/widgets/MerchSalesWidget.tsx",
      "components/widgets/MerchProductCategoriesTrendWidget.tsx",
      "components/widgets/MerchSalesChannelsTrendWidget.tsx",
      "components/widgets/SubscriptionsSalesWidget.tsx",
      "components/widgets/subscription-campaign/CampaignPaceChart.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/^\s*Tooltip,$/m);
      expect(source, file).not.toContain("<Tooltip ");
      expect(source, file).toContain("AdaptiveTooltip");
    }
  });
});

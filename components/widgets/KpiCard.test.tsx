import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TabKpiCards } from "@/components/widgets/KpiCard";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { computeSubscriptionsKpis } from "@/lib/filters";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import type { TicketsKpiData } from "@/types/dashboard";

const EMPTY_TICKETS_KPIS: TicketsKpiData = {
  revenue: 0,
  revenueChange: 0,
  ticketsSold: 0,
  ticketsChange: 0,
  avgPrice: 0,
  avgPriceChange: 0,
  loyaltyDiscount: 0,
  loyaltyDiscountPct: 0,
  loyaltyDiscountChange: 0,
  fillRate: 0,
  planCompletionPct: 0,
  planTicketsSold: 0,
  planFactTicketsSold: 0,
  revenueToday: 0,
  ticketsToday: 0,
  revenueSparkline: [],
  ticketsSparkline: [],
};

afterEach(() => {
  cleanup();
});

describe("TabKpiCards subscriptions", () => {
  it("renders «Выполнение плана» with a non-zero percent and YoY", () => {
    const subscriptionsKpis = computeSubscriptionsKpis(
      DEFAULT_DASHBOARD_FILTERS,
      DEFAULT_SUBSCRIPTION_FILTERS,
    );

    render(
      <TabKpiCards
        tab="subscriptions"
        ticketsKpis={EMPTY_TICKETS_KPIS}
        subscriptionsKpis={subscriptionsKpis}
      />,
    );

    expect(screen.getByText("Выполнение плана")).toBeTruthy();
    expect(screen.getByText(/94\s*%/)).toBeTruthy();
    expect(subscriptionsKpis.planCompletionPct).toBeGreaterThan(0);
    expect(screen.getAllByText(/к сезону 2024\/25/).length).toBe(5);
  });

  it("keeps the plan KPI on the subscriptions row in source", () => {
    const source = readFileSync(
      join(process.cwd(), "components/widgets/KpiCard.tsx"),
      "utf8",
    );
    const subscriptionsStart = source.indexOf('if (tab === "subscriptions")');
    const ticketsStart = source.indexOf('if (tab === "tickets")');
    expect(subscriptionsStart).toBeGreaterThan(-1);
    expect(ticketsStart).toBeGreaterThan(subscriptionsStart);
    const block = source.slice(subscriptionsStart, ticketsStart);
    expect(block).toContain('title="Выполнение плана"');
    expect(block).toContain("subscriptionsKpis.planCompletionPct");
    expect(block).toContain("xl:grid-cols-5");
  });
});

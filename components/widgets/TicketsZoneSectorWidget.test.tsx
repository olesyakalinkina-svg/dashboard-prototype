/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketsZoneSectorWidget } from "@/components/widgets/TicketsZoneSectorWidget";

vi.mock("@/context/FilterContext", () => ({
  useFilterData: () => ({
    appliedFilters: { dateRange: 30, stream: "all", matchId: "all", promotionId: "all" },
    appliedTicketFilters: {
      season: "2025/26",
      league: "KHL",
      tournamentStage: "all",
      matchClass: "all",
      arena: "all",
      eventCompleted: "all",
      matchId: [],
      ticketType: "all",
      priceZone: "all",
      orderSource: "all",
      transactionDateRange: { from: null, to: null },
      timeGrouping: "day",
    },
  }),
}));

vi.mock("@/lib/filters", () => ({
  filterMatchesByTicketFilters: () => [
    {
      id: "m1",
      date: new Date(2026, 4, 10),
      opponent: "СКА",
      attendance: 1000,
      capacity: 12000,
      season: "2025/26",
      league: "KHL",
      tournamentStage: "regular",
      matchClass: "class_1",
      arena: "main",
      eventCompleted: true,
      ticketSalesWindowDays: 14,
    },
  ],
  filterTicketTransactions: () => [
    {
      id: "t1",
      date: new Date(2026, 4, 5),
      stream: "tickets",
      description: "A",
      matchId: "m1",
      channel: "online",
      amount: 3000,
      quantity: 2,
      ticketType: "arena",
      sector: "A",
      priceZone: "from_1500_to_2500",
      orderSource: "official_site",
    },
  ],
}));

afterEach(() => {
  cleanup();
});

describe("TicketsZoneSectorWidget integration", () => {
  it("renders matrix title and allows opening details", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    expect(screen.getByText("Продажи по ценовым зонам и секторам")).toBeTruthy();
    expect(screen.getByText("Сравнение заполняемости, продаж и выручки по матчам")).toBeTruthy();
    await user.click(screen.getByText("Подробнее"));
    expect(screen.getByText("По ценовым зонам")).toBeTruthy();
    await user.click(screen.getByText("По секторам"));
    expect(screen.getByText("По секторам")).toBeTruthy();
  });
});

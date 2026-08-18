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
  filterMatchesByTicketFilters: () =>
    Array.from({ length: 10 }).map((_, idx) => ({
      id: `m${idx + 1}`,
      date: new Date(2026, 4, idx + 1),
      opponent: `Оппонент ${idx + 1}`,
      attendance: 1000,
      capacity: 12000,
      season: "2025/26",
      league: "KHL",
      tournamentStage: "regular",
      matchClass: "class_1",
      arena: "main",
      eventCompleted: true,
      ticketSalesWindowDays: 14,
    })),
  filterTicketTransactions: () =>
    Array.from({ length: 10 }).flatMap((_, idx) => ([
      {
        id: `t-paid-${idx + 1}`,
        date: new Date(2026, 4, idx + 1),
        stream: "tickets",
        description: "A",
        matchId: `m${idx + 1}`,
        channel: "online",
        amount: 3000 + idx * 50,
        quantity: 2 + idx,
        ticketType: "arena",
        sector: "A",
        priceZone: "from_1500_to_2500",
        orderSource: "official_site",
      },
      {
        id: `t-free-${idx + 1}`,
        date: new Date(2026, 4, idx + 1),
        stream: "tickets",
        description: "B",
        matchId: `m${idx + 1}`,
        channel: "online",
        amount: 0,
        quantity: 1,
        freeQuantity: 1,
        ticketType: "arena",
        sector: "B1",
        priceZone: "from_2500_to_4000",
        orderSource: "official_site",
      },
    ])),
}));

afterEach(() => {
  cleanup();
});

describe("TicketsZoneSectorWidget integration", () => {
  it("renders compact title, paginates matrix and keeps right detail panel", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    expect(screen.getByText("Продажи по ценовым зонам и секторам")).toBeTruthy();
    expect(screen.getByText("Сравнение заполняемости, продаж и выручки по матчам")).toBeTruthy();
    expect(screen.getByText("Выберите матч или ячейку")).toBeTruthy();
    expect(screen.getByText("Показано матчей: 8 из 10")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Вперёд" })[0]!);
    expect(screen.getByText("Показано матчей: 2 из 10")).toBeTruthy();
  });

  it("shows metric-only cell text and keeps drilldown modes", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    expect(screen.queryByText(/\/ ₽/)).toBeNull();
    await user.click(screen.getAllByRole("button", { name: /vs Оппонент/ })[0]!);
    expect(screen.getByText("По ценовым зонам")).toBeTruthy();
    await user.click(screen.getByText("По секторам"));
    expect(screen.getByText("По секторам")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Очистить/ })).toBeTruthy();
  });

  it("shows only allowed metric options in selector", () => {
    render(<TicketsZoneSectorWidget />);
    const metricSelect = screen.getByLabelText("Показатель") as HTMLSelectElement;
    const optionLabels = Array.from(metricSelect.options).map((option) => option.textContent);

    expect(optionLabels).toEqual(["Заполняемость", "Выручка"]);
    expect(screen.queryByRole("option", { name: "Продано" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Средняя цена" })).toBeNull();
  });
});

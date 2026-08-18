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
        id: `t-a-low-${idx + 1}`,
        date: new Date(2026, 4, idx + 1),
        stream: "tickets",
        description: "A low",
        matchId: `m${idx + 1}`,
        channel: "online",
        amount: 900,
        quantity: 1,
        ticketType: "arena",
        sector: "A",
        priceZone: "up_to_1500",
        orderSource: "official_site",
      },
      {
        id: `t-a-high-${idx + 1}`,
        date: new Date(2026, 4, idx + 1),
        stream: "tickets",
        description: "A high",
        matchId: `m${idx + 1}`,
        channel: "online",
        amount: 3200,
        quantity: 1,
        ticketType: "arena",
        sector: "A",
        priceZone: "from_2500_to_4000",
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
      {
        id: `t-vip-${idx + 1}`,
        date: new Date(2026, 4, idx + 1),
        stream: "tickets",
        description: "VIP",
        matchId: `m${idx + 1}`,
        channel: "online",
        amount: 5000,
        quantity: 1,
        ticketType: "arena",
        sector: "VIP",
        priceZone: "from_4000_to_6000",
        orderSource: "official_site",
      },
    ])),
}));

afterEach(() => {
  cleanup();
});

async function expandMatch(user: ReturnType<typeof userEvent.setup>, opponent = "Оппонент 10") {
  await user.click(screen.getByRole("button", { name: `Развернуть: vs ${opponent}` }));
}

describe("TicketsZoneSectorWidget integration", () => {
  it("renders hierarchical table with Продажи-like columns and pagination", () => {
    render(<TicketsZoneSectorWidget />);
    expect(screen.getByText("Продажи по ценовым зонам и секторам")).toBeTruthy();
    expect(screen.getByText("Сравнение заполняемости, продаж и выручки по матчам")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Мероприятие" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Дата" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Выручка" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "% заполняемости" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Продано" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Бесплатно" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Оформлено" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Средняя цена" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Доля" })).toBeNull();
    expect(screen.queryByText("Легенда шкалы")).toBeNull();
    expect(screen.queryByText("Выберите матч или ячейку")).toBeNull();
    expect(screen.getByText("10 мероприятий")).toBeTruthy();
  });

  it("does not render extra settings, slice switcher, or Показатель", () => {
    render(<TicketsZoneSectorWidget />);
    expect(screen.queryByText("Дополнительные настройки")).toBeNull();
    expect(screen.queryByLabelText("Срез сравнения")).toBeNull();
    expect(screen.queryByLabelText("Показатель")).toBeNull();
    expect(screen.queryByText("Текущее состояние")).toBeNull();
    expect(screen.queryByText("Итоговые продажи")).toBeNull();
    expect(screen.getByText("Матчи")).toBeTruthy();
    expect(screen.getByText("Ценовые зоны")).toBeTruthy();
    expect(screen.getByText("Секторы")).toBeTruthy();
  });

  it("keeps collapsed children out of the DOM until expanded", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    expect(document.querySelector("[data-parent-zone]")).toBeNull();
    expect(document.querySelector("[data-child-sector]")).toBeNull();
    await expandMatch(user);
    expect(document.querySelectorAll("[data-parent-zone]").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-child-sector]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Развернуть: от 1500 до 2500" }));
    expect(document.querySelector("[data-child-sector]")).toBeTruthy();
  });

  it("ordinary sector expands to the three lower zones only", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    await user.click(screen.getByText("По секторам"));
    await expandMatch(user);
    expect(document.querySelector("[data-child-zone]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Развернуть: A" }));
    const childZones = [...document.querySelectorAll("[data-child-zone]")].map(
      (node) => node.getAttribute("data-child-zone"),
    );
    expect(childZones).toEqual([
      "up_to_1500",
      "from_1500_to_2500",
      "from_2500_to_4000",
    ]);
    expect(childZones).not.toContain("from_4000_to_6000");
  });

  it("VIP expands only to 4000–6000 and 4000–6000 expands only to VIP", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    await user.click(screen.getByText("По секторам"));
    await expandMatch(user);
    await user.click(screen.getByRole("button", { name: "Развернуть: VIP" }));
    const vipZones = [...document.querySelectorAll("[data-child-zone]")].map(
      (node) => node.getAttribute("data-child-zone"),
    );
    expect(vipZones).toEqual(["from_4000_to_6000"]);

    await user.click(screen.getByText("По ценовым зонам"));
    await expandMatch(user);
    await user.click(screen.getByRole("button", { name: "Развернуть: от 4000 до 6000" }));
    const childSectors = [...document.querySelectorAll("[data-child-sector]")].map(
      (node) => node.getAttribute("data-child-sector"),
    );
    expect(childSectors).toEqual(["VIP"]);
  });

  it("VIP filter keeps only the 4000–6000 zone", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    await user.click(screen.getByRole("button", { name: "Все секторы" }));
    for (const sector of ["A", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"]) {
      await user.click(screen.getByText(sector, { selector: "span" }));
    }
    await expandMatch(user);
    expect(document.querySelector("[data-parent-zone='from_4000_to_6000']")).toBeTruthy();
    expect(document.querySelector("[data-parent-zone='up_to_1500']")).toBeNull();
    expect(document.querySelector("[data-parent-zone='from_1500_to_2500']")).toBeNull();
    expect(document.querySelector("[data-parent-zone='from_2500_to_4000']")).toBeNull();
    await user.click(screen.getByText("По секторам"));
    await expandMatch(user);
    expect(document.querySelector("[data-parent-sector='VIP']")).toBeTruthy();
    expect(document.querySelector("[data-parent-sector='A']")).toBeNull();
  });

  it("shows empty state for an illegal VIP + lower-zone filter combo", async () => {
    const user = userEvent.setup();
    render(<TicketsZoneSectorWidget />);
    await user.click(screen.getByRole("button", { name: "Все зоны" }));
    await user.click(screen.getByText("до 1500"));
    await user.click(screen.getByText("от 2500 до 4000"));
    await user.click(screen.getByText("от 4000 до 6000"));
    await user.click(screen.getByRole("button", { name: /от 1500 до 2500/ }));
    await user.click(screen.getByRole("button", { name: "Все секторы" }));
    for (const sector of ["A", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"]) {
      await user.click(screen.getByText(sector, { selector: "span" }));
    }
    expect(screen.getByTestId("zone-sector-empty-filter").textContent).toBe(
      "Нет данных для выбранного сочетания фильтров",
    );
    expect(screen.getByRole("button", { name: "VIP" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "от 1500 до 2500" })).toBeTruthy();
    expect(screen.queryByText("vs Оппонент 1")).toBeNull();
  });
});

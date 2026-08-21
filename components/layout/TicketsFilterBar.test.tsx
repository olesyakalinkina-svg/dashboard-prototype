/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TicketsFilterBar } from "@/components/layout/TicketsFilterBar";
import { applyTicketFilterPatch } from "@/lib/ticket-filter-options";
import type { TicketFilters } from "@/types/dashboard";

const layoutState = vi.hoisted(() => ({
  overlayMode: "none" as "none" | "sheet" | "panel",
}));

const harness = vi.hoisted(() => {
  const defaultFilters: TicketFilters = {
    season: "2025/26",
    league: "KHL",
    tournamentStage: "all",
    matchClass: "all",
    series: "all",
    arena: "all",
    eventCompleted: "all",
    matchId: [],
    ticketType: "all",
    priceZone: "all",
    sector: [],
    orderSource: "all",
    transactionDateRange: { from: null, to: null },
    timeGrouping: "week",
  };
  const state: { filters: TicketFilters } = {
    filters: { ...defaultFilters, matchId: [], sector: [] },
  };
  return {
    state,
    defaultFilters,
    setTicketFilters: (_patch: Partial<TicketFilters>) => {},
    resetTicketFilters: () => {},
  };
});

harness.setTicketFilters = (patch) => {
  harness.state.filters = applyTicketFilterPatch(harness.state.filters, patch);
};
harness.resetTicketFilters = () => {
  harness.state.filters = {
    ...harness.defaultFilters,
    matchId: [...harness.defaultFilters.matchId],
    sector: [...harness.defaultFilters.sector],
  };
};

vi.mock("@/hooks/useLayoutMode", () => ({
  useFilterOverlayMode: () => layoutState.overlayMode,
}));

vi.mock("@/context/FilterContext", () => ({
  useFilterState: () => ({ activeTab: "tickets" }),
}));

vi.mock("@/context/MobileFilterDraftContext", () => ({
  useFilterBarState: () => ({
    ticketFilters: harness.state.filters,
    ticketMatchOptions: [],
    ticketSeriesOptions: [
      { value: "all", label: "Все серии" },
      { value: "Сентябрь", label: "Сентябрь" },
      { value: "ПО. Ак Барс", label: "ПО. Ак Барс" },
    ],
    setTicketFilters: harness.setTicketFilters,
    resetTicketFilters: harness.resetTicketFilters,
  }),
}));

function ticketFilterLabels(container: HTMLElement): string[] {
  const group = Array.from(container.querySelectorAll("p")).find(
    (node) => node.textContent === "Фильтры билетов",
  )?.parentElement;
  if (!group) return [];
  return Array.from(group.querySelectorAll(":scope > div span.text-xs")).map(
    (node) => node.textContent ?? "",
  );
}

function matchFilterLabels(container: HTMLElement): string[] {
  const group = Array.from(container.querySelectorAll("p")).find(
    (node) => node.textContent === "Фильтры матчей",
  )?.parentElement;
  if (!group) return [];
  return Array.from(group.querySelectorAll(":scope > div span.text-xs")).map(
    (node) => node.textContent ?? "",
  );
}

describe("TicketsFilterBar", () => {
  beforeEach(() => {
    layoutState.overlayMode = "none";
    harness.resetTicketFilters();
  });

  afterEach(() => {
    cleanup();
  });

  it("places Серия immediately after Класс матча on the desktop bar", () => {
    const { container } = render(<TicketsFilterBar />);

    expect(matchFilterLabels(container)).toEqual([
      "Сезон",
      "Лига",
      "Этап турнира",
      "Класс матча",
      "Серия",
      "Арена",
      "Событие завершилось?",
      "Матч",
    ]);
  });

  it("places Сектор immediately after Ценовая зона on the desktop bar", async () => {
    const user = userEvent.setup();
    const { container } = render(<TicketsFilterBar />);

    expect(ticketFilterLabels(container)).toEqual([
      "Тип билета",
      "Ценовая зона",
      "Сектор",
      "Источник заказа",
      "Дата покупки",
      "Группировка",
    ]);

    await user.click(screen.getByRole("button", { name: "Все секторы" }));
    const menu = screen.getByTestId("multi-select-menu");
    const optionLabels = [...menu.querySelectorAll("label span")].map(
      (node) => node.textContent,
    );
    expect(optionLabels).toEqual([
      "Все секторы",
      "A",
      "B1",
      "B2",
      "B3",
      "B4",
      "C1",
      "C2",
      "C3",
      "C4",
      "D1",
      "D2",
      "D3",
      "D4",
      "VIP",
    ]);
    expect(optionLabels.some((label) => label?.toLowerCase().includes("парк"))).toBe(
      false,
    );
  });

  it("hides VIP when a lower price zone is selected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TicketsFilterBar />);

    fireEvent.change(screen.getByLabelText("Ценовая зона"), {
      target: { value: "up_to_500" },
    });
    rerender(<TicketsFilterBar />);

    await user.click(screen.getByRole("button", { name: "Все секторы" }));
    const optionLabels = [
      ...screen.getByTestId("multi-select-menu").querySelectorAll("label span"),
    ].map((node) => node.textContent);
    expect(optionLabels).not.toContain("VIP");
    expect(optionLabels).toContain("A");
  });

  it("disables price zone and sector when ticket type is parking", () => {
    const { rerender } = render(<TicketsFilterBar />);

    fireEvent.change(screen.getByLabelText("Тип билета"), {
      target: { value: "parking" },
    });
    rerender(<TicketsFilterBar />);

    expect(screen.getByLabelText("Ценовая зона").hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen.getByRole("button", { name: "Все секторы" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(harness.state.filters.sector).toEqual([]);
  });

  it("locks Arena to Второстепенная when VHL is selected", () => {
    const { rerender } = render(<TicketsFilterBar />);

    expect(screen.getByLabelText("Лига")).toHaveProperty("value", "KHL");
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "all");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("Лига"), { target: { value: "VHL" } });
    rerender(<TicketsFilterBar />);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "secondary");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(true);
    expect(harness.state.filters.arena).toBe("secondary");

    fireEvent.change(screen.getByLabelText("Лига"), { target: { value: "MHL" } });
    rerender(<TicketsFilterBar />);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "main");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Лига"), { target: { value: "KHL" } });
    rerender(<TicketsFilterBar />);
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(false);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "all");
    expect(harness.state.filters.arena).toBe("all");

    fireEvent.change(screen.getByLabelText("Арена"), {
      target: { value: "secondary" },
    });
    rerender(<TicketsFilterBar />);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "secondary");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(false);
  });
});

/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchSalesFilterBar } from "@/components/layout/MatchSalesFilterBar";
import { applyMatchSalesFilterPatch } from "@/lib/match-sales-filter-options";
import type { MatchSalesFilters } from "@/types/dashboard";

const harness = vi.hoisted(() => {
  const defaultFilters: MatchSalesFilters = {
    season: "2025/26",
    league: "KHL",
    tournamentStage: "all",
    matchClass: "all",
    series: "all",
    arena: "all",
    eventCompleted: "all",
    matchId: [],
    purchaseDateRange: { from: null, to: null },
  };
  const state: { filters: MatchSalesFilters } = {
    filters: { ...defaultFilters, matchId: [] },
  };
  return {
    state,
    defaultFilters,
    setMatchSalesFilters: (_patch: Partial<MatchSalesFilters>) => {},
    resetMatchSalesFilters: () => {},
  };
});

harness.setMatchSalesFilters = (patch) => {
  harness.state.filters = applyMatchSalesFilterPatch(
    harness.state.filters,
    patch,
  );
};
harness.resetMatchSalesFilters = () => {
  harness.state.filters = {
    ...harness.defaultFilters,
    matchId: [...harness.defaultFilters.matchId],
  };
};

vi.mock("@/hooks/useLayoutMode", () => ({
  useFilterOverlayMode: () => "none",
}));

vi.mock("@/context/FilterContext", () => ({
  useFilterState: () => ({ activeTab: "matches" }),
}));

vi.mock("@/context/MobileFilterDraftContext", () => ({
  useFilterBarState: () => ({
    matchSalesFilters: harness.state.filters,
    matchSalesMatchOptions: [],
    matchSalesSeriesOptions: [
      { value: "all", label: "Все серии" },
      { value: "Сентябрь", label: "Сентябрь" },
    ],
    setMatchSalesFilters: harness.setMatchSalesFilters,
    resetMatchSalesFilters: harness.resetMatchSalesFilters,
  }),
}));

function filterLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("span.text-xs")).map(
    (node) => node.textContent ?? "",
  );
}

describe("MatchSalesFilterBar", () => {
  beforeEach(() => {
    harness.resetMatchSalesFilters();
  });

  afterEach(() => {
    cleanup();
  });

  it("places Серия immediately after Класс матча", () => {
    const { container } = render(<MatchSalesFilterBar />);
    const labels = filterLabels(container);
    const classIndex = labels.indexOf("Класс матча");
    expect(classIndex).toBeGreaterThanOrEqual(0);
    expect(labels[classIndex + 1]).toBe("Серия");
  });

  it("locks Arena to Второстепенная when VHL is selected", () => {
    const { rerender } = render(<MatchSalesFilterBar />);

    expect(screen.getByLabelText("Лига")).toHaveProperty("value", "KHL");
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "all");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("Лига"), { target: { value: "VHL" } });
    rerender(<MatchSalesFilterBar />);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "secondary");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(true);
    expect(harness.state.filters.arena).toBe("secondary");

    fireEvent.change(screen.getByLabelText("Лига"), { target: { value: "MHL" } });
    rerender(<MatchSalesFilterBar />);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "main");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Лига"), { target: { value: "KHL" } });
    rerender(<MatchSalesFilterBar />);
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(false);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "all");
    expect(harness.state.filters.arena).toBe("all");

    fireEvent.change(screen.getByLabelText("Арена"), {
      target: { value: "main" },
    });
    rerender(<MatchSalesFilterBar />);
    expect(screen.getByLabelText("Арена")).toHaveProperty("value", "main");
    expect(screen.getByLabelText("Арена").hasAttribute("disabled")).toBe(false);
  });
});

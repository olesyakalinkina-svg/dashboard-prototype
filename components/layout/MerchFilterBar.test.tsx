/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MerchFilterBar } from "@/components/layout/MerchFilterBar";
import type { MerchFilters } from "@/types/dashboard";

const harness = vi.hoisted(() => {
  const defaultFilters: MerchFilters = {
    season: "2025/26",
    league: "KHL",
    tournamentStage: "all",
    matchClass: "all",
    series: "all",
    matchId: [],
    salesChannels: [
      "flagship",
      "arena_north",
      "arena_south",
      "mall_raduga",
      "mall_continent",
      "online_store",
    ],
    productCategories: [
      "jerseys",
      "souvenirs",
      "drinkware",
      "apparel",
      "accessories",
    ],
    orderDateRange: { from: null, to: null },
    timeGrouping: "week",
  };
  const state: { filters: MerchFilters } = {
    filters: {
      ...defaultFilters,
      matchId: [],
      salesChannels: [...defaultFilters.salesChannels],
      productCategories: [...defaultFilters.productCategories],
    },
  };
  return {
    state,
    defaultFilters,
    setMerchFilters: (_patch: Partial<MerchFilters>) => {},
    resetMerchFilters: () => {},
  };
});

harness.setMerchFilters = (patch) => {
  harness.state.filters = { ...harness.state.filters, ...patch };
};
harness.resetMerchFilters = () => {
  harness.state.filters = {
    ...harness.defaultFilters,
    matchId: [...harness.defaultFilters.matchId],
    salesChannels: [...harness.defaultFilters.salesChannels],
    productCategories: [...harness.defaultFilters.productCategories],
  };
};

vi.mock("@/hooks/useLayoutMode", () => ({
  useFilterOverlayMode: () => "none",
}));

vi.mock("@/context/FilterContext", () => ({
  useFilterState: () => ({ activeTab: "merch" }),
}));

vi.mock("@/context/MobileFilterDraftContext", () => ({
  useFilterBarState: () => ({
    merchFilters: harness.state.filters,
    merchMatchOptions: [],
    merchSeriesOptions: [
      { value: "all", label: "Все серии" },
      { value: "Сентябрь", label: "Сентябрь" },
    ],
    setMerchFilters: harness.setMerchFilters,
    resetMerchFilters: harness.resetMerchFilters,
  }),
}));

function filterLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("span.text-xs")).map(
    (node) => node.textContent ?? "",
  );
}

describe("MerchFilterBar", () => {
  beforeEach(() => {
    harness.resetMerchFilters();
  });

  afterEach(() => {
    cleanup();
  });

  it("places Серия immediately after Класс матча", () => {
    const { container } = render(<MerchFilterBar />);
    const labels = filterLabels(container);
    const classIndex = labels.indexOf("Класс матча");
    expect(classIndex).toBeGreaterThanOrEqual(0);
    expect(labels[classIndex + 1]).toBe("Серия");
  });
});

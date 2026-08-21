/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsFilterBar } from "@/components/layout/SubscriptionsFilterBar";
import {
  applySubscriptionFilterPatch,
  DEFAULT_SUBSCRIPTION_FILTERS,
} from "@/lib/subscription-filter-options";
import type { SubscriptionFilters } from "@/types/dashboard";

const harness = vi.hoisted(() => {
  const state: { filters: SubscriptionFilters } = {
    filters: {
      season: "2025/26",
      league: "KHL",
      tournamentStage: "all",
      arena: "all",
      priceCategory: "all",
      timeGrouping: "week",
    },
  };
  return {
    state,
    setSubscriptionFilters: (_patch: Partial<SubscriptionFilters>) => {},
    resetSubscriptionFilters: () => {},
  };
});

harness.setSubscriptionFilters = (patch) => {
  harness.state.filters = applySubscriptionFilterPatch(
    harness.state.filters,
    patch,
  );
};
harness.resetSubscriptionFilters = () => {
  harness.state.filters = { ...DEFAULT_SUBSCRIPTION_FILTERS };
};

vi.mock("@/hooks/useLayoutMode", () => ({
  useFilterOverlayMode: () => "none",
}));

vi.mock("@/context/FilterContext", () => ({
  useFilterState: () => ({ activeTab: "subscriptions" }),
}));

vi.mock("@/context/MobileFilterDraftContext", () => ({
  useFilterBarState: () => ({
    subscriptionFilters: harness.state.filters,
    setSubscriptionFilters: harness.setSubscriptionFilters,
    resetSubscriptionFilters: harness.resetSubscriptionFilters,
  }),
}));

function getSelectByLabel(label: string): HTMLSelectElement {
  return screen.getByLabelText(label) as HTMLSelectElement;
}

function expectSelectDisabled(label: string, disabled: boolean) {
  expect(getSelectByLabel(label).hasAttribute("disabled")).toBe(disabled);
}

describe("SubscriptionsFilterBar", () => {
  beforeEach(() => {
    harness.resetSubscriptionFilters();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render tournament stage and replaces ticket type with product type", () => {
    render(<SubscriptionsFilterBar />);

    expect(screen.queryByLabelText("Этап турнира")).toBeNull();
    expect(screen.queryByLabelText("Тип билета")).toBeNull();
    expect(getSelectByLabel("Тип продукта")).toBeTruthy();
    expect(
      Array.from(getSelectByLabel("Тип продукта").options).map((opt) => opt.text),
    ).toEqual(["Все", "Все включено", "Выходного дня", "Сезонный"]);
  });

  it("defaults KHL to Все арены unlocked and still locks VHL/MHL", () => {
    const { rerender } = render(<SubscriptionsFilterBar />);
    const arena = getSelectByLabel("Арена");

    expect(getSelectByLabel("Лига").value).toBe("KHL");
    expect(arena.value).toBe("all");
    expectSelectDisabled("Арена", false);

    fireEvent.change(getSelectByLabel("Лига"), { target: { value: "VHL" } });
    rerender(<SubscriptionsFilterBar />);
    expect(getSelectByLabel("Арена").value).toBe("secondary");
    expectSelectDisabled("Арена", true);

    fireEvent.change(getSelectByLabel("Лига"), { target: { value: "MHL" } });
    rerender(<SubscriptionsFilterBar />);
    expect(getSelectByLabel("Арена").value).toBe("main");
    expectSelectDisabled("Арена", true);

    fireEvent.change(getSelectByLabel("Лига"), { target: { value: "all" } });
    rerender(<SubscriptionsFilterBar />);
    expectSelectDisabled("Арена", false);

    fireEvent.change(getSelectByLabel("Арена"), {
      target: { value: "secondary" },
    });
    rerender(<SubscriptionsFilterBar />);
    expect(getSelectByLabel("Арена").value).toBe("secondary");

    fireEvent.change(getSelectByLabel("Лига"), { target: { value: "KHL" } });
    rerender(<SubscriptionsFilterBar />);
    expect(getSelectByLabel("Арена").value).toBe("all");
    expectSelectDisabled("Арена", false);
    expect(harness.state.filters.arena).toBe("all");

    fireEvent.change(getSelectByLabel("Арена"), {
      target: { value: "main" },
    });
    rerender(<SubscriptionsFilterBar />);
    expect(getSelectByLabel("Арена").value).toBe("main");
    expectSelectDisabled("Арена", false);
  });

  it("restores KHL + Все арены on reset", () => {
    const { rerender } = render(<SubscriptionsFilterBar />);

    fireEvent.change(getSelectByLabel("Лига"), { target: { value: "all" } });
    rerender(<SubscriptionsFilterBar />);
    fireEvent.change(getSelectByLabel("Арена"), { target: { value: "secondary" } });
    rerender(<SubscriptionsFilterBar />);

    fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
    rerender(<SubscriptionsFilterBar />);

    expect(getSelectByLabel("Лига").value).toBe("KHL");
    expect(getSelectByLabel("Арена").value).toBe("all");
    expectSelectDisabled("Арена", false);
  });
});

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchComparisonWidget } from "@/components/widgets/MatchComparisonWidget";
import {
  MATCH_COMPARISON_METRIC_LABELS,
  MATCH_COMPARISON_METRICS,
  computeMatchComparison,
  formatMatchComparisonValue,
  listMatchComparisonMatches,
  listMatchComparisonOptions,
  pickDefaultMatchComparisonIds,
} from "@/lib/match-comparison";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";

vi.mock("@/context/FilterContext", () => ({
  useFilterState: () => ({
    subscriptionFilters: DEFAULT_SUBSCRIPTION_FILTERS,
  }),
}));

afterEach(() => {
  cleanup();
});

describe("MatchComparisonWidget", () => {
  it("lists matches in both selectors and shows A/B values", () => {
    render(<MatchComparisonWidget />);

    const options = listMatchComparisonOptions(DEFAULT_SUBSCRIPTION_FILTERS);
    const matches = listMatchComparisonMatches(DEFAULT_SUBSCRIPTION_FILTERS);
    const [idA, idB] = pickDefaultMatchComparisonIds(matches);
    expect(idA && idB).toBeTruthy();

    const selectA = screen.getByLabelText("Матч A") as HTMLSelectElement;
    const selectB = screen.getByLabelText("Матч B") as HTMLSelectElement;
    expect(selectA.options.length).toBe(options.length);
    expect(selectB.options.length).toBe(options.length);
    expect(selectA.value).toBe(idA);
    expect(selectB.value).toBe(idB);
    expect(options.every((option) => option.label.length > 0)).toBe(true);

    const comparison = computeMatchComparison(
      DEFAULT_SUBSCRIPTION_FILTERS,
      idA!,
      idB!,
    );
    const table = screen.getByTestId("match-comparison-table");

    for (const metric of MATCH_COMPARISON_METRICS) {
      const row = screen.getByTestId(`match-comparison-row-${metric}`);
      const cells = within(row).getAllByRole("cell");
      expect(cells[0]?.textContent).toBe(MATCH_COMPARISON_METRIC_LABELS[metric]);
      expect(cells[1]?.textContent).toBe(
        formatMatchComparisonValue(metric, comparison.a[metric]),
      );
      expect(cells[2]?.textContent).toBe(
        formatMatchComparisonValue(metric, comparison.b[metric]),
      );
    }

    expect(within(table).getByText("Δ")).toBeTruthy();
    expect(screen.getByText("Сравнение матчей")).toBeTruthy();
  });

  it("hides a metric row when its chip is toggled off", async () => {
    const user = userEvent.setup();
    render(<MatchComparisonWidget />);

    expect(screen.getByTestId("match-comparison-row-conversion")).toBeTruthy();

    await user.click(screen.getByTestId("match-comparison-metric-conversion"));

    expect(screen.queryByTestId("match-comparison-row-conversion")).toBeNull();
    expect(screen.getByTestId("match-comparison-row-revenue")).toBeTruthy();
    expect(
      screen.getByTestId("match-comparison-metric-conversion").getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");
  });
});

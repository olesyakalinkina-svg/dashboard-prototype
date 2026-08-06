import { describe, expect, it } from "vitest";
import {
  buildCriticalComboCases,
  buildMatchSalesFilterCases,
  buildMerchFilterCases,
  buildSubscriptionsFilterCases,
  buildTicketsFilterCases,
  buildTimeGroupingCases,
  type CriticalComboCase,
  type FilterCoverageCase,
  type TimeGroupingCase,
} from "@/lib/filter-coverage";

function activeCases(cases: FilterCoverageCase[]): FilterCoverageCase[] {
  return cases.filter((testCase) => !testCase.excluded);
}

function excludedCases(cases: FilterCoverageCase[]): FilterCoverageCase[] {
  return cases.filter((testCase) => Boolean(testCase.excluded));
}

function formatCase(testCase: FilterCoverageCase): string {
  return `${testCase.filter} / ${testCase.option}`;
}

describe("filter coverage — tickets tab", () => {
  const cases = buildTicketsFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns transactions, KPIs, and widget data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents intentional exclusions", () => {
    expect(excludedCases(cases)).toHaveLength(0);
  });
});

describe("filter coverage — merch tab", () => {
  const cases = buildMerchFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns KPIs and widget data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents empty sales channel selection as intentional exclusion", () => {
    const excluded = excludedCases(cases);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.option).toBe("(empty selection)");
    expect(excluded[0]?.excluded).toContain("intentional");
  });
});

describe("filter coverage — subscriptions tab", () => {
  const cases = buildSubscriptionsFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns subscriptions, KPIs, and trend data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents intentional exclusions", () => {
    expect(excludedCases(cases)).toHaveLength(0);
  });
});

describe("filter coverage — match sales tab", () => {
  const cases = buildMatchSalesFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns KPIs, table rows, and chart data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents intentional exclusions", () => {
    expect(excludedCases(cases)).toHaveLength(0);
  });
});

describe("filter coverage — time grouping", () => {
  const cases = buildTimeGroupingCases();

  it.each(
    cases.map((testCase) => [
      `${testCase.tab} / ${testCase.label}`,
      testCase,
    ]),
  )("%s trend has data points", (_label, testCase: TimeGroupingCase) => {
    expect(testCase.hasData()).toBe(true);
  });
});

describe("filter coverage — critical combinations", () => {
  const cases = buildCriticalComboCases();
  const active = cases.filter((testCase) => !testCase.excluded);
  const excluded = cases.filter((testCase) => Boolean(testCase.excluded));

  it.each(active.map((testCase) => [testCase.name, testCase]))(
    "%s",
    (_name, testCase: CriticalComboCase) => {
      expect(testCase.check()).toBe(true);
    },
  );

  it("documents excluded critical combos", () => {
    expect(excluded.length).toBeGreaterThan(0);
    for (const testCase of excluded) {
      expect(testCase.excluded).toBeTruthy();
    }
  });
});

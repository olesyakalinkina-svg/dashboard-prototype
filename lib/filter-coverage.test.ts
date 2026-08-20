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

const COVERAGE_TIMEOUT = 30_000;

function activeCases(cases: FilterCoverageCase[]): FilterCoverageCase[] {
  return cases.filter((testCase) => !testCase.excluded);
}

function excludedCases(cases: FilterCoverageCase[]): FilterCoverageCase[] {
  return cases.filter((testCase) => Boolean(testCase.excluded));
}

function formatCase(testCase: FilterCoverageCase): string {
  return `${testCase.filter} / ${testCase.option}`;
}

describe("filter coverage", { timeout: COVERAGE_TIMEOUT }, () => {
describe("tickets tab", () => {
  const cases = buildTicketsFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns transactions, KPIs, and widget data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents intentional exclusions", () => {
    const excluded = excludedCases(cases);
    expect(excluded).toHaveLength(1);
    expect(excluded.map((testCase) => testCase.filter).sort()).toEqual([
      "arena",
    ]);
  });
});

describe("merch tab", () => {
  const cases = buildMerchFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns KPIs and widget data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents empty multi-select selections as intentional exclusions", () => {
    const excluded = excludedCases(cases);
    expect(excluded.map((testCase) => `${testCase.filter}:${testCase.option}`).sort()).toEqual(
      [
        "matchClass:Плей-офф",
        "productCategory:(empty selection)",
        "salesChannels:(empty selection)",
        "series:ПО. Ак Барс",
        "tournamentStage:Плей-офф",
      ].sort(),
    );
    expect(
      excluded
        .filter(
          (testCase) =>
            testCase.filter === "productCategory" ||
            testCase.filter === "salesChannels",
        )
        .every((testCase) => testCase.excluded?.includes("intentional")),
    ).toBe(true);
  });
});

describe("subscriptions tab", () => {
  const cases = buildSubscriptionsFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns subscriptions, KPIs, and trend data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents intentional exclusions", () => {
    const excluded = excludedCases(cases);
    expect(excluded).toHaveLength(0);
  });
});

describe("match sales tab", () => {
  const cases = buildMatchSalesFilterCases();

  it.each(activeCases(cases).map((testCase) => [formatCase(testCase), testCase]))(
    "%s returns KPIs, table rows, and chart data",
    (_label, testCase) => {
      expect(testCase.hasData()).toBe(true);
    },
  );

  it("documents intentional exclusions", () => {
    const excluded = excludedCases(cases);
    expect(excluded).toHaveLength(1);
    expect(excluded.map((testCase) => testCase.filter).sort()).toEqual([
      "arena",
    ]);
  });
});

describe("time grouping", () => {
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

describe("critical combinations", () => {
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
});

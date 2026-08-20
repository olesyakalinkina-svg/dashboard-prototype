/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MerchMobileSalesCards } from "@/components/widgets/MerchMobileSalesCards";
import {
  buildDefaultMerchFixtureTree,
  FIXTURE_DASHBOARD_FILTERS,
  FIXTURE_MERCH_FILTERS,
  MERCH_FIXTURE_ARENA_MATCH_ID,
  MERCH_FIXTURE_ARENA_TOP_PRODUCTS,
} from "@/lib/merch-sales-tree.fixture";
import {
  getMerchSalesBarMaxima,
  merchSalesPlanFulfillmentPct,
  MERCH_SALES_SECTION_LABELS,
  toggleExpandedKey,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import {
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
} from "@/lib/merch-filter-options";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { MerchMatchSalesRow } from "@/types/dashboard";
import type { MerchSalesTreeState } from "@/hooks/useMerchSalesTree";

afterEach(() => {
  cleanup();
});

function Harness({
  tree,
  matchRows,
}: {
  tree: MerchSalesTreeNode[];
  matchRows: MerchMatchSalesRow[];
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const treeState = useMemo<MerchSalesTreeState>(
    () => ({
      tree,
      matchRows,
      filters: FIXTURE_DASHBOARD_FILTERS,
      merchFilters: FIXTURE_MERCH_FILTERS,
      expandedSet: new Set(expanded),
      toggleExpanded: (id: string) => {
        setExpanded((current) => toggleExpandedKey(current, id));
      },
      barMax: getMerchSalesBarMaxima(tree),
    }),
    [tree, matchRows, expanded],
  );
  return <MerchMobileSalesCards treeState={treeState} />;
}

describe("MerchMobileSalesCards parallel structure", () => {
  it("renders match cards collapsed, then three sibling sections", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);

    expect(screen.getByText("Продажи")).toBeTruthy();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.salesChannel)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.topProducts)).toBeNull();
    const expand = screen.getByRole("button", {
      name: `Развернуть: ${match.label}`,
    });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    await user.click(expand);
    expect(screen.getByText(MERCH_SALES_SECTION_LABELS.salesChannel)).toBeTruthy();
    expect(screen.getByText(MERCH_SALES_SECTION_LABELS.productCategory)).toBeTruthy();
    expect(screen.getByText(MERCH_SALES_SECTION_LABELS.topProducts)).toBeTruthy();
    expect(screen.queryByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])).toBeNull();
  });

  it("expands «Топ-5 товаров» independently on mobile", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);
    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.topProducts}`,
      }),
    );
    expect(screen.getByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])).toBeTruthy();
    expect(screen.getByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[4])).toBeTruthy();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: `Развернуть: ${MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0]}`,
      }),
    ).toBeNull();
  });

  it("shows % выполнения плана next to revenue on match cards", () => {
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);

    const card = screen.getByText(match.label).closest("article");
    expect(card).toBeTruthy();
    const pct = formatPercent(
      merchSalesPlanFulfillmentPct(match.revenue, match.planRevenue)!,
    );
    expect(card!.textContent).toContain("% выполнения плана");
    expect(card!.textContent).toContain(pct);

    const revenueDt = [...card!.querySelectorAll("dt")].find(
      (el) => el.textContent === "Выручка",
    );
    expect(revenueDt?.nextElementSibling?.textContent).toBe(
      formatCurrency(match.revenue),
    );
    expect(revenueDt?.nextElementSibling?.textContent).not.toContain(pct);

    const planDt = [...card!.querySelectorAll("dt")].find(
      (el) => el.textContent === "% выполнения плана",
    );
    expect(planDt?.nextElementSibling?.textContent).toContain(pct);
  });

  it("shows — for % выполнения плана on section and child cards", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);
    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );

    const matchPct = formatPercent(
      merchSalesPlanFulfillmentPct(match.revenue, match.planRevenue)!,
    );
    const card = screen.getByText(match.label).closest("article");
    expect(card?.textContent).toContain(matchPct);

    const section = screen
      .getByText(MERCH_SALES_SECTION_LABELS.salesChannel)
      .closest("div");
    expect(section).toBeTruthy();
    const sectionPlanDt = [...section!.querySelectorAll("dt")].find(
      (el) => el.textContent === "% выполнения плана",
    );
    expect(sectionPlanDt?.nextElementSibling?.textContent).toBe("—");
    expect(section?.textContent).not.toContain(matchPct);

    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.salesChannel}`,
      }),
    );
    const child = screen
      .getByText(MERCH_SALES_POINT_LABELS.flagship)
      .closest("div");
    const childPlanDt = [...child!.querySelectorAll("dt")].find(
      (el) => el.textContent === "% выполнения плана",
    );
    expect(childPlanDt?.nextElementSibling?.textContent).toBe("—");
  });
});

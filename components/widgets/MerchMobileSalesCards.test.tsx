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
  MERCH_SALES_SECTION_LABELS,
  toggleExpandedKey,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import { MERCH_PRODUCT_CATEGORY_LABELS } from "@/lib/merch-filter-options";
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
});

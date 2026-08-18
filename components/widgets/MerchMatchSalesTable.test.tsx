/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MerchSalesTableView } from "@/components/widgets/MerchMatchSalesTable";
import {
  buildDefaultMerchFixtureTree,
  FIXTURE_DASHBOARD_FILTERS,
  FIXTURE_MERCH_FILTERS,
  MERCH_FIXTURE_ARENA_MATCH_ID,
  MERCH_FIXTURE_NORTH_MATCH_ID,
} from "@/lib/merch-sales-tree.fixture";
import {
  getMerchSalesBarMaxima,
  MERCH_SALES_SECTION_LABELS,
  toggleExpandedKey,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import {
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
} from "@/lib/merch-filter-options";
import type { MerchMatchSalesRow } from "@/types/dashboard";
import type { MerchSalesTreeState } from "@/hooks/useMerchSalesTree";

afterEach(() => {
  cleanup();
});

const ORIGINAL_COLUMNS = [
  "Мероприятие",
  "Дата",
  "Выручка",
  "Средний чек",
  "Чеки",
  "Товары",
  "UPT",
  "Конверсия в покупку",
];

function Harness({
  tree,
  matchRows,
  initialExpanded = [],
}: {
  tree: MerchSalesTreeNode[];
  matchRows: MerchMatchSalesRow[];
  initialExpanded?: string[];
}) {
  const [expanded, setExpanded] = useState<string[]>(initialExpanded);
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
  return <MerchSalesTableView treeState={treeState} />;
}

function renderMerch(
  pipeline: ReturnType<typeof buildDefaultMerchFixtureTree> = buildDefaultMerchFixtureTree(),
  initialExpanded: string[] = [],
) {
  return render(
    <Harness
      tree={pipeline.tree}
      matchRows={pipeline.rows}
      initialExpanded={initialExpanded}
    />,
  );
}

describe("MerchMatchSalesTable drill-down", () => {
  it("collapsed table keeps original columns and match rows only", () => {
    const pipeline = buildDefaultMerchFixtureTree();
    renderMerch(pipeline);

    const headers = screen.getAllByRole("columnheader").map((el) => el.textContent);
    expect(headers).toEqual(ORIGINAL_COLUMNS);
    expect(screen.getByText("Продажи")).toBeTruthy();
    expect(screen.getByText("vs СКА")).toBeTruthy();
    expect(screen.getByText("vs ЦСКА")).toBeTruthy();
    expect(screen.getByText("Итого")).toBeTruthy();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.salesChannel)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.productCategory)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBeNull();
  });

  it("expanding a match shows two parallel sections", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    renderMerch(pipeline);

    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );
    expect(screen.getByText(MERCH_SALES_SECTION_LABELS.salesChannel)).toBeTruthy();
    expect(screen.getByText(MERCH_SALES_SECTION_LABELS.productCategory)).toBeTruthy();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBeNull();
    expect(screen.getAllByRole("columnheader").map((el) => el.textContent)).toEqual(
      ORIGINAL_COLUMNS,
    );
  });

  it("expanding one section does not open the other", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    renderMerch(pipeline, [match.id]);

    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.salesChannel}`,
      }),
    );
    expect(screen.getByText(MERCH_SALES_POINT_LABELS.flagship)).toBeTruthy();
    expect(screen.getByText(MERCH_SALES_POINT_LABELS.arena_north)).toBeTruthy();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBeNull();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.souvenirs)).toBeNull();
    expect(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.productCategory}`,
      }),
    ).toBeTruthy();
  });

  it("closing collapse returns to the original match-only table", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    const channels = match.children.find(
      (child) => child.label === MERCH_SALES_SECTION_LABELS.salesChannel,
    )!;
    renderMerch(pipeline, [match.id, channels.id]);

    expect(screen.getByText(MERCH_SALES_POINT_LABELS.flagship)).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: `Свернуть: ${match.label}` }),
    );
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.salesChannel)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.productCategory)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
    expect(screen.getByText("vs СКА")).toBeTruthy();
    expect(screen.getByText("vs ЦСКА")).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map((el) => el.textContent)).toEqual(
      ORIGINAL_COLUMNS,
    );
  });

  it("shows different channel mixes for different matches", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const arena = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    const north = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_NORTH_MATCH_ID,
    )!;
    renderMerch(pipeline);

    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${arena.label}` }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.salesChannel}`,
      }),
    );

    const arenaFlagship = arena.children
      .find((child) => child.label === MERCH_SALES_SECTION_LABELS.salesChannel)!
      .children.find((child) => child.label === MERCH_SALES_POINT_LABELS.flagship)!;
    const northFlagship = north.children
      .find((child) => child.label === MERCH_SALES_SECTION_LABELS.salesChannel)!
      .children.find((child) => child.label === MERCH_SALES_POINT_LABELS.flagship)!;
    expect(arenaFlagship.sharePct).not.toBe(northFlagship.sharePct);
    expect(arenaFlagship.sharePct).toBeGreaterThan(northFlagship.sharePct!);
  });

  it("does not duplicate match rows on rapid toggle", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    const { container } = renderMerch(pipeline);
    const nameOpen = `Развернуть: ${match.label}`;
    const nameClose = `Свернуть: ${match.label}`;
    for (let i = 0; i < 5; i += 1) {
      const open = screen.queryByRole("button", { name: nameOpen });
      const close = screen.queryByRole("button", { name: nameClose });
      await user.click((open ?? close)!);
    }
    const labels = within(container).getAllByText(match.label);
    expect(labels).toHaveLength(1);
  });
});

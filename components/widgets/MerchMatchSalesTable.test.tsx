/** @vitest-environment jsdom */
import { readFileSync } from "fs";
import { join } from "path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MerchSalesTableView } from "@/components/widgets/MerchMatchSalesTable";
import {
  buildDefaultMerchFixtureTree,
  FIXTURE_DASHBOARD_FILTERS,
  FIXTURE_MERCH_FILTERS,
  MERCH_FIXTURE_ARENA_EXCLUDED_SKU,
  MERCH_FIXTURE_ARENA_MATCH_ID,
  MERCH_FIXTURE_ARENA_TOP_PRODUCTS,
  MERCH_FIXTURE_NORTH_MATCH_ID,
  MERCH_FIXTURE_OFF_MATCH_RECEIPTS,
  MERCH_FIXTURE_OFF_MATCH_REVENUE,
  MERCH_FIXTURE_OFF_MATCH_UNITS,
} from "@/lib/merch-sales-tree.fixture";
import {
  getMerchSalesBarMaxima,
  MERCH_SALES_SECTION_LABELS,
  merchSalesPlanFulfillmentPct,
  toggleExpandedKey,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import {
  MERCH_OFF_MATCH_LABEL,
  MERCH_PRODUCT_CATEGORY_LABELS,
  MERCH_SALES_POINT_LABELS,
} from "@/lib/merch-filter-options";
import type { MerchMatchSalesRow } from "@/types/dashboard";
import type { MerchSalesTreeState } from "@/hooks/useMerchSalesTree";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

afterEach(() => {
  cleanup();
});

const ORIGINAL_COLUMNS = [
  "Мероприятие",
  "Дата",
  "Выручка",
  "Выполнение плана",
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

function cellsForLabel(label: string) {
  const row = screen.getByText(label).closest("tr");
  expect(row).toBeTruthy();
  return within(row!).getAllByRole("cell");
}

function revenueCellForLabel(label: string) {
  return cellsForLabel(label)[2]!;
}

function planCellForLabel(label: string) {
  return cellsForLabel(label)[3]!;
}

function cellText(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\s/g, " ");
}

function revenueBarHasPlanColor(label: string): boolean {
  return Boolean(revenueCellForLabel(label).querySelector("[class*='bg-rose']"));
}

function shareBarWidth(share: number): string {
  return `${Math.min(100, Math.max(0, share))}%`;
}

describe("MerchMatchSalesTable drill-down", () => {
  it("collapsed table keeps original columns and match rows only", () => {
    const pipeline = buildDefaultMerchFixtureTree();
    renderMerch(pipeline);

    const headers = screen.getAllByRole("columnheader").map((el) => el.textContent);
    expect(headers).toEqual(ORIGINAL_COLUMNS);
    expect(screen.getByText("Продажи")).toBeTruthy();
    expect(screen.getByText("СКА")).toBeTruthy();
    expect(screen.getByText("ЦСКА")).toBeTruthy();
    expect(screen.getByText(MERCH_OFF_MATCH_LABEL)).toBeTruthy();
    expect(screen.getByText("Итого")).toBeTruthy();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.salesChannel)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.productCategory)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.topProducts)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBeNull();
    expect(screen.queryByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])).toBeNull();
  });

  it("gives «Выполнение плана» the same locked width as tickets plan-%", () => {
    renderMerch();
    const header = screen.getByRole("columnheader", {
      name: "Выполнение плана",
    });
    expect(header.className).toContain("w-[10.5rem]");
    expect(header.className).toContain("max-w-[10.5rem]");
  });

  it("gives «Конверсия в покупку» enough width for the full header", () => {
    renderMerch();
    const header = screen.getByRole("columnheader", {
      name: "Конверсия в покупку",
    });
    expect(header.className).toContain("w-[10.5rem]");
    expect(header.className).not.toContain("max-w-[6.5rem]");
    expect(header.className).toContain("overflow-hidden");
  });

  it("keeps a wide table inside a horizontal scroller as a mid-width fallback", () => {
    renderMerch();
    const card = screen.getByTestId("merch-sales-table");
    const scroller = within(card).getByTestId("sticky-scroll-table");
    const table = scroller.querySelector("table");
    expect(table?.className).toContain("min-w-[84rem]");
    expect(table?.className).toContain("table-fixed");
    expect(scroller.className).toContain("overflow-x-auto");
    expect(scroller.className).toContain("sticky-scroll-table-row-hover");
    const matchRow = screen.getByText("СКА").closest("tr");
    expect(matchRow?.className).not.toMatch(/hover:bg-/);
  });

  it("shows off-match sales as a root row and includes them in Итого", () => {
    renderMerch();
    expect(screen.getByText(MERCH_OFF_MATCH_LABEL)).toBeTruthy();
    const offMatchRow = screen.getByText(MERCH_OFF_MATCH_LABEL).closest("tr");
    expect(offMatchRow).toBeTruthy();
    const offCells = within(offMatchRow!).getAllByRole("cell");
    expect(cellText(offCells[2]!)).toContain(
      formatCurrency(MERCH_FIXTURE_OFF_MATCH_REVENUE).replace(/\s/g, " ").trim(),
    );
    expect(offCells[offCells.length - 1]!.textContent).toBe("—");
    expect(within(offCells[3]!).getByText("—")).toBeTruthy();

    const totalRow = screen.getByText("Итого").closest("tr");
    expect(totalRow).toBeTruthy();
    const totalCells = within(totalRow!).getAllByRole("cell");
    const totalRevenue = 500_000 + 400_000 + MERCH_FIXTURE_OFF_MATCH_REVENUE;
    const totalPlan = 450_000 + 500_000;
    expect(cellText(totalCells[2]!)).toContain(
      formatCurrency(totalRevenue)
        .replace(/\s/g, " ")
        .trim(),
    );
    expect(cellText(totalCells[3]!)).toContain(
      formatPercent((totalRevenue / totalPlan) * 100).replace(/\s/g, " "),
    );
    expect(cellText(totalCells[5]!)).toContain(
      formatNumber(2 + 2 + MERCH_FIXTURE_OFF_MATCH_RECEIPTS),
    );
    expect(cellText(totalCells[6]!)).toContain(
      formatNumber(60 + 40 + MERCH_FIXTURE_OFF_MATCH_UNITS),
    );
  });

  it("keeps off-match as the last data row before Итого, including after sort", async () => {
    const user = userEvent.setup();
    renderMerch();

    const lastDataBeforeTotal = () => {
      const rows = [...screen.getByRole("table").querySelectorAll("tbody > tr")];
      return rows.at(-1) as HTMLElement;
    };

    expect(lastDataBeforeTotal().textContent).toContain(MERCH_OFF_MATCH_LABEL);
    const totalRow = screen.getByText("Итого").closest("tr");
    expect(totalRow?.closest("tfoot")).toBeTruthy();

    await user.click(screen.getByRole("columnheader", { name: "Дата" }));
    expect(lastDataBeforeTotal().textContent).toContain(MERCH_OFF_MATCH_LABEL);

    await user.click(screen.getByRole("columnheader", { name: "Выручка" }));
    expect(lastDataBeforeTotal().textContent).toContain(MERCH_OFF_MATCH_LABEL);
  });

  it("expands the off-match row to the three retail/online channels", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const offMatch = pipeline.tree.find(
      (node) => node.label === MERCH_OFF_MATCH_LABEL,
    )!;
    renderMerch(pipeline, [offMatch.id]);

    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.salesChannel}`,
      }),
    );
    expect(screen.getByText(MERCH_SALES_POINT_LABELS.mall_raduga)).toBeTruthy();
    expect(screen.getByText(MERCH_SALES_POINT_LABELS.mall_continent)).toBeTruthy();
    expect(screen.getByText(MERCH_SALES_POINT_LABELS.online_store)).toBeTruthy();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
  });

  it("expanding a match shows three parallel sections", async () => {
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
    expect(screen.getByText(MERCH_SALES_SECTION_LABELS.topProducts)).toBeTruthy();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBeNull();
    expect(screen.queryByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])).toBeNull();
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
    expect(screen.queryByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])).toBeNull();
    expect(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.productCategory}`,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.topProducts}`,
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
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.topProducts)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
    expect(screen.queryByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])).toBeNull();
    expect(screen.getByText("СКА")).toBeTruthy();
    expect(screen.getByText("ЦСКА")).toBeTruthy();
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

  it("puts Выполнение плана in its own column after Выручка, not on the revenue bar", () => {
    const pipeline = buildDefaultMerchFixtureTree();
    const ska = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    const cska = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_NORTH_MATCH_ID,
    )!;
    renderMerch(pipeline);

    const headers = screen.getAllByRole("columnheader").map((el) => el.textContent);
    expect(headers).toEqual(ORIGINAL_COLUMNS);

    const skaPct = formatPercent((ska.revenue / ska.planRevenue!) * 100);
    const cskaPct = formatPercent((cska.revenue / cska.planRevenue!) * 100);
    expect(skaPct).not.toBe(cskaPct);
    expect(cellText(revenueCellForLabel(ska.label))).not.toContain(
      skaPct.replace(/\s/g, " "),
    );
    expect(cellText(planCellForLabel(ska.label))).toContain(
      skaPct.replace(/\s/g, " "),
    );
    expect(cellText(planCellForLabel(cska.label))).toContain(
      cskaPct.replace(/\s/g, " "),
    );
  });

  it("shows em dash in Выполнение плана when merch plan is missing, not 0%", () => {
    const incomplete: MerchSalesTreeNode = {
      id: "mm:incomplete",
      level: "match",
      matchId: "incomplete",
      date: new Date(2025, 7, 1),
      label: "Incomplete Plan",
      revenue: 120_000,
      planRevenue: 0,
      avgCheck: 1_200,
      receipts: 100,
      units: 100,
      upt: 1,
      attendance: 0,
      purchaseConversionPct: 0,
      sharePct: null,
      hasChildren: false,
      children: [],
    };
    const row: MerchMatchSalesRow = {
      matchId: incomplete.matchId,
      eventLabel: incomplete.label,
      date: incomplete.date!,
      revenue: incomplete.revenue,
      planRevenue: 0,
      avgCheck: incomplete.avgCheck,
      receipts: incomplete.receipts,
      units: incomplete.units,
      upt: incomplete.upt,
      attendance: incomplete.attendance,
      purchaseConversionPct: incomplete.purchaseConversionPct,
    };
    render(<Harness tree={[incomplete]} matchRows={[row]} />);

    const cell = planCellForLabel("Incomplete Plan");
    expect(within(cell).getByText("—")).toBeTruthy();
    expect(within(cell).queryByText(formatPercent(0))).toBeNull();
  });

  it("shows em dash in Выполнение плана on section headers and children", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    renderMerch(pipeline);

    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.salesChannel}`,
      }),
    );

    const matchPct = formatPercent((match.revenue / match.planRevenue!) * 100);
    expect(cellText(planCellForLabel(match.label))).toContain(
      matchPct.replace(/\s/g, " "),
    );
    expect(
      cellText(planCellForLabel(MERCH_SALES_SECTION_LABELS.salesChannel)),
    ).toContain("—");
    expect(
      cellText(planCellForLabel(MERCH_SALES_SECTION_LABELS.salesChannel)),
    ).not.toContain(matchPct.replace(/\s/g, " "));
    expect(cellText(planCellForLabel(MERCH_SALES_POINT_LABELS.flagship))).toContain(
      "—",
    );
    expect(
      cellText(planCellForLabel(MERCH_SALES_POINT_LABELS.flagship)),
    ).not.toContain(formatPercent(0).replace(/\s/g, " "));
  });

  it("keeps a colored revenue bar only on match rows that have a plan", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    renderMerch(pipeline, [match.id]);

    expect(revenueBarHasPlanColor(match.label)).toBe(true);
    expect(cellText(revenueCellForLabel(match.label))).toContain(
      formatCurrency(match.revenue).replace(/\s/g, " ").trim(),
    );
    expect(revenueBarHasPlanColor(MERCH_OFF_MATCH_LABEL)).toBe(false);

    for (const label of [
      MERCH_SALES_SECTION_LABELS.salesChannel,
      MERCH_SALES_SECTION_LABELS.productCategory,
      MERCH_SALES_SECTION_LABELS.topProducts,
    ]) {
      expect(revenueBarHasPlanColor(label)).toBe(false);
      expect(cellText(revenueCellForLabel(label))).toContain(
        formatCurrency(match.revenue).replace(/\s/g, " ").trim(),
      );
      expect(cellText(planCellForLabel(label))).toContain("—");
    }

    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.salesChannel}`,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.productCategory}`,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.topProducts}`,
      }),
    );

    expect(revenueBarHasPlanColor(MERCH_SALES_POINT_LABELS.flagship)).toBe(false);
    expect(revenueBarHasPlanColor(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBe(
      false,
    );
    expect(revenueBarHasPlanColor(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])).toBe(
      false,
    );
    expect(cellText(revenueCellForLabel(MERCH_SALES_POINT_LABELS.flagship))).toMatch(
      /₽/,
    );
    expect(revenueBarHasPlanColor(match.label)).toBe(true);
  });

  it("scales match revenue bar to plan fulfillment, not max revenue in the table", () => {
    const akBars: MerchSalesTreeNode = {
      id: "mm:ak-bars",
      level: "match",
      matchId: "ak-bars",
      date: new Date(2026, 2, 29),
      label: "Ак Барс",
      revenue: 12_406_805,
      planRevenue: 12_406_805 / 0.455,
      avgCheck: 1_200,
      receipts: 100,
      units: 100,
      upt: 1,
      attendance: 10_000,
      purchaseConversionPct: 10,
      sharePct: null,
      hasChildren: false,
      children: [],
    };
    const avangard: MerchSalesTreeNode = {
      ...akBars,
      id: "mm:avangard",
      matchId: "avangard",
      date: new Date(2026, 2, 13),
      label: "Авангард",
      revenue: 22_476_290,
      planRevenue: 22_476_290 / 0.997,
    };
    const toRow = (node: MerchSalesTreeNode): MerchMatchSalesRow => ({
      matchId: node.matchId,
      eventLabel: node.label,
      date: node.date!,
      revenue: node.revenue,
      planRevenue: node.planRevenue ?? 0,
      avgCheck: node.avgCheck,
      receipts: node.receipts,
      units: node.units,
      upt: node.upt,
      attendance: node.attendance,
      purchaseConversionPct: node.purchaseConversionPct,
    });

    render(
      <Harness
        tree={[akBars, avangard]}
        matchRows={[toRow(akBars), toRow(avangard)]}
      />,
    );

    const akBarsPct = merchSalesPlanFulfillmentPct(
      akBars.revenue,
      akBars.planRevenue,
    )!;
    expect(akBarsPct).toBeCloseTo(45.5, 5);
    const vsMax = (akBars.revenue / avangard.revenue) * 100;
    expect(vsMax).toBeCloseTo(55.2, 0);

    const akBarsCell = revenueCellForLabel(akBars.label);
    const akBarsBar = akBarsCell.querySelector(".bg-rose-400") as HTMLElement | null;
    expect(akBarsBar).toBeTruthy();
    expect(akBarsBar!.style.width).toBe(shareBarWidth(akBarsPct));
    expect(akBarsBar!.style.width).not.toBe(shareBarWidth(vsMax));
    expect(cellText(akBarsCell)).toContain(
      formatCurrency(akBars.revenue).replace(/\s/g, " ").trim(),
    );
  });

  it("expanding «Топ-5 товаров» lists ranked SKUs as siblings, not under category", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;
    renderMerch(pipeline, [match.id]);

    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.topProducts}`,
      }),
    );

    for (const label of MERCH_FIXTURE_ARENA_TOP_PRODUCTS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText(MERCH_FIXTURE_ARENA_EXCLUDED_SKU)).toBeNull();
    expect(screen.queryByText(MERCH_PRODUCT_CATEGORY_LABELS.jerseys)).toBeNull();
    expect(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.productCategory}`,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: `Развернуть: ${MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0]}`,
      }),
    ).toBeNull();

    const conversionCell = screen
      .getByText(MERCH_FIXTURE_ARENA_TOP_PRODUCTS[0])
      .closest("tr");
    expect(conversionCell).toBeTruthy();
    const cells = within(conversionCell!).getAllByRole("cell");
    expect(cells[cells.length - 1]!.textContent).toBe("—");
  });

  it("returns to the initial collapsed view when remounted after merch filter reset", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultMerchFixtureTree();
    const match = pipeline.tree.find(
      (node) => node.matchId === MERCH_FIXTURE_ARENA_MATCH_ID,
    )!;

    function ResetHarness({ epoch }: { epoch: number }) {
      return (
        <Harness
          key={epoch}
          tree={pipeline.tree}
          matchRows={pipeline.rows}
        />
      );
    }

    const { rerender } = render(<ResetHarness epoch={0} />);

    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MERCH_SALES_SECTION_LABELS.salesChannel}`,
      }),
    );
    expect(screen.getByText(MERCH_SALES_POINT_LABELS.flagship)).toBeTruthy();

    await user.type(
      screen.getByLabelText("Поиск по мероприятию..."),
      "СКА",
    );
    expect(
      (screen.getByLabelText("Поиск по мероприятию...") as HTMLInputElement)
        .value,
    ).toBe("СКА");

    rerender(<ResetHarness epoch={1} />);

    expect(
      screen
        .getByRole("button", { name: `Развернуть: ${match.label}` })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByText(MERCH_SALES_SECTION_LABELS.salesChannel)).toBeNull();
    expect(screen.queryByText(MERCH_SALES_POINT_LABELS.flagship)).toBeNull();
    expect(
      (screen.getByLabelText("Поиск по мероприятию...") as HTMLInputElement)
        .value,
    ).toBe("");
  });
});

describe("merch sales reset wiring", () => {
  it("bumps merchViewResetEpoch from resetMerchFilters and remounts Продажи", () => {
    const filterContext = readFileSync(
      join(process.cwd(), "context/FilterContext.tsx"),
      "utf8",
    );
    expect(filterContext).toMatch(
      /const resetMerchFilters = useCallback\(\(\) => \{[\s\S]*?setMerchViewResetEpoch\(\(epoch\) => epoch \+ 1\);/,
    );
    expect(filterContext).toMatch(
      /export function useMerchViewResetEpoch\(\): number/,
    );

    const mobileDraft = readFileSync(
      join(process.cwd(), "context/MobileFilterDraftContext.tsx"),
      "utf8",
    );
    expect(mobileDraft).toMatch(
      /const resetMerchFilters = useCallback\(\(\) => \{[\s\S]*?live\.resetMerchFilters\(\);/,
    );

    const table = readFileSync(
      join(process.cwd(), "components/widgets/MerchMatchSalesTable.tsx"),
      "utf8",
    );
    expect(table).toMatch(/useMerchViewResetEpoch/);
    expect(table).toMatch(
      /<MerchMatchSalesTableBody key=\{merchViewResetEpoch\} data=\{data\} \/>/,
    );
  });
});

describe("merch sales page layout", () => {
  it("places merch Продажи full-bleed, then SKU left and channels/categories right", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "app/dashboard-app.tsx"),
      "utf8",
    );
    const merchStart = dashboard.indexOf('{activeTab === "merch" && (');
    const matchesStart = dashboard.indexOf('{activeTab === "matches" && (');
    expect(merchStart).toBeGreaterThan(-1);
    expect(matchesStart).toBeGreaterThan(merchStart);
    const merchBlock = dashboard.slice(merchStart, matchesStart);

    expect(merchBlock).toMatch(
      /MerchKpiCards[\s\S]*MerchSalesWidget[\s\S]*TopProductsChart[\s\S]*MerchMatchSalesTable[\s\S]*MerchSkuSalesTable[\s\S]*MerchSalesChannelsChart[\s\S]*MerchProductCategoriesChart/,
    );
    expect(merchBlock).toMatch(
      /<MerchMatchSalesTable data=\{merchMatchSales\} \/>\s*<div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">[\s\S]*<MerchSkuSalesTable/,
    );
    expect(merchBlock).not.toMatch(/xl:absolute xl:inset-0/);
    expect(merchBlock).not.toMatch(
      /<div className="flex min-w-0 flex-col gap-4">\s*<MerchMatchSalesTable/,
    );
  });
});

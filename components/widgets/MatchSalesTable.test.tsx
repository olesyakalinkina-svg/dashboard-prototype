/** @vitest-environment jsdom */
import { readFileSync } from "fs";
import { join } from "path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MatchSalesTable } from "@/components/widgets/MatchSalesTable";
import { STICKY_TABLE_ROW_HOVER_CLASS } from "@/components/ui/sales-table-layout";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import {
  CONFIRM_SCENARIO,
  FIXTURE_CURRENT_MATCH_ID,
  FIXTURE_PREV_MATCH_ID,
  FIXTURE_DASHBOARD_FILTERS,
  FIXTURE_TICKET_FILTERS,
  buildDefaultFixtureTree,
  computeFixtureMatchSalesTable,
} from "@/lib/match-sales-tree.fixture";
import {
  getMatchSalesBarMaxima,
  MATCH_SALES_SECTION_LABELS,
  matchSalesIssuedOccupancyPercent,
  matchSalesPlanFulfillmentPct,
  sortMatchSalesNodes,
  toggleExpandedKey,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import { occupancyMassCapacity } from "@/lib/ticket-plan";
import { PRICE_ZONE_LABELS } from "@/lib/ticket-filter-options";
import type { DashboardFilters, MatchSalesRow, TicketFilters } from "@/types/dashboard";
import type { MatchSalesTreeState } from "@/hooks/useMatchSalesTree";

afterEach(() => {
  cleanup();
});

const SALES_COLUMNS = [
  "Мероприятие",
  "Дата",
  "Выручка",
  "Выполнение плана",
  "Средняя цена",
  "Продано",
  "Бесплатно",
  "Заполняемость",
  "Скидка ПЛ",
];

function Harness({
  tree,
  matchRows,
  filters = FIXTURE_DASHBOARD_FILTERS,
  ticketFilters = FIXTURE_TICKET_FILTERS,
  initialExpanded = [],
}: {
  tree: MatchSalesTreeNode[];
  matchRows: MatchSalesRow[];
  filters?: DashboardFilters;
  ticketFilters?: TicketFilters;
  initialExpanded?: string[];
}) {
  const [expanded, setExpanded] = useState<string[]>(initialExpanded);
  const treeState = useMemo<MatchSalesTreeState>(
    () => ({
      tree,
      matchRows,
      filters,
      ticketFilters,
      expandedSet: new Set(expanded),
      toggleExpanded: (id: string) => {
        setExpanded((current) => toggleExpandedKey(current, id));
      },
      barMax: getMatchSalesBarMaxima(tree),
    }),
    [tree, matchRows, filters, ticketFilters, expanded],
  );
  return <MatchSalesTable treeState={treeState} />;
}

function renderSales(
  pipeline: ReturnType<typeof buildDefaultFixtureTree> = buildDefaultFixtureTree(),
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

function cellText(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\s/g, " ");
}

function revenueCellForLabel(label: string) {
  return cellsForLabel(label)[2]!;
}

function shareBarWidth(share: number): string {
  return `${Math.min(100, Math.max(0, share))}%`;
}

function stubMatch(
  overrides: Partial<MatchSalesTreeNode> &
    Pick<
      MatchSalesTreeNode,
      "id" | "matchId" | "label" | "revenue" | "planRevenue"
    >,
): MatchSalesTreeNode {
  return {
    level: "match",
    date: new Date(2026, 2, 29),
    avgPrice: 1000,
    ticketsSold: 1,
    freeTickets: 0,
    issuedTickets: 1,
    occupancyIssuedTickets: 1,
    capacity: 12_000,
    loyaltyDiscountPct: 0,
    hasChildren: false,
    children: [],
    ...overrides,
  };
}

function stubMatchRow(node: MatchSalesTreeNode): MatchSalesRow {
  return {
    matchId: node.matchId,
    eventLabel: node.label,
    date: node.date!,
    revenue: node.revenue,
    planRevenue: node.planRevenue ?? 0,
    avgPrice: node.avgPrice,
    ticketsSold: node.ticketsSold,
    freeTickets: node.freeTickets,
    issuedTickets: node.issuedTickets,
    occupancyIssuedTickets: node.occupancyIssuedTickets,
    capacity: node.capacity ?? 0,
    loyaltyDiscountPct: node.loyaltyDiscountPct,
  };
}

describe("MatchSalesTable integration (E2E stand-in)", () => {
  it("scenario 1: collapsed table shows matches only, then three parallel sections", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    renderSales(pipeline);
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;

    expect(screen.getByText("Продажи")).toBeTruthy();
    expect(screen.queryByText(MATCH_SALES_SECTION_LABELS.ticketType)).toBeNull();
    expect(screen.queryByText(MATCH_SALES_SECTION_LABELS.orderSource)).toBeNull();
    expect(screen.queryByText(MATCH_SALES_SECTION_LABELS.priceZone)).toBeNull();

    const expand = screen.getByRole("button", {
      name: `Развернуть: ${match.label}`,
    });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    await user.click(expand);
    expect(
      screen.getByRole("button", { name: `Свернуть: ${match.label}` }).getAttribute(
        "aria-expanded",
      ),
    ).toBe("true");
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.ticketType)).toBeTruthy();
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.orderSource)).toBeTruthy();
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.priceZone)).toBeTruthy();
    expect(screen.queryByText(PRICE_ZONE_LABELS[CONFIRM_SCENARIO.priceZone])).toBeNull();
  });

  it("scenario 2: expanding one section does not open the others", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const priceZone = match.children.find(
      (child) => child.label === MATCH_SALES_SECTION_LABELS.priceZone,
    )!;
    renderSales(pipeline, [match.id]);

    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MATCH_SALES_SECTION_LABELS.priceZone}`,
      }),
    );
    expect(screen.getByText(PRICE_ZONE_LABELS[CONFIRM_SCENARIO.priceZone])).toBeTruthy();
    expect(screen.queryByText("Арена")).toBeNull();
    expect(screen.queryByText("Кассы")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: `Свернуть: ${MATCH_SALES_SECTION_LABELS.priceZone}`,
      }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(priceZone.children.length).toBeGreaterThan(0);
  });

  it("expands a price zone into sector rows with the same columns", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const priceZone = match.children.find(
      (child) => child.label === MATCH_SALES_SECTION_LABELS.priceZone,
    )!;
    const vipZone = priceZone.children.find(
      (child) => child.label === PRICE_ZONE_LABELS.from_2500_to_3000,
    )!;
    renderSales(pipeline, [match.id, priceZone.id]);

    expect(screen.queryByText("VIP")).toBeNull();
    const expandZone = screen.getByRole("button", {
      name: `Развернуть: ${PRICE_ZONE_LABELS.from_2500_to_3000}`,
    });
    expect(expandZone.getAttribute("aria-expanded")).toBe("false");
    await user.click(expandZone);
    expect(
      screen.getByRole("button", {
        name: `Свернуть: ${PRICE_ZONE_LABELS.from_2500_to_3000}`,
      }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByText("VIP")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Развернуть: VIP" })).toBeNull();

    const cells = cellsForLabel("VIP");
    expect(cellText(cells[1]!)).toBe("");
    expect(within(cells[3]!).getByText("—")).toBeTruthy();
    const vipLeaf = vipZone.children.find((child) => child.label === "VIP");
    expect(vipLeaf?.revenue).toBe(10_000);
    expect(vipZone.revenue).toBe(25_000);
  });

  it("scenario 3: confirm match + price zone via global filter pipeline", () => {
    const pipeline = computeFixtureMatchSalesTable(FIXTURE_DASHBOARD_FILTERS, {
      ...FIXTURE_TICKET_FILTERS,
      matchId: [CONFIRM_SCENARIO.matchId],
      priceZone: CONFIRM_SCENARIO.priceZone,
    });
    renderSales(pipeline);
    expect(screen.getByText(pipeline.tree[0]!.label)).toBeTruthy();
    expect(screen.queryByText("ЦСКА")).toBeNull();
    expect(pipeline.tree[0]?.revenue).toBe(16_000);
    expect(pipeline.tree[0]?.ticketsSold).toBe(8);
  });

  it("scenario 4: empty result shows 0 matches and no inner filter bar", () => {
    const pipeline = computeFixtureMatchSalesTable(FIXTURE_DASHBOARD_FILTERS, {
      ...FIXTURE_TICKET_FILTERS,
      league: "VHL",
    });
    const { container } = renderSales(pipeline);
    expect(screen.getByText("0 мероприятий")).toBeTruthy();
    expect(container.querySelector("#match-sales-local-filters-title")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByLabelText("Тип билета")).toBeNull();
    expect(screen.queryByText("Группировка")).toBeNull();
  });

  it("scenario 5: two matches expand independently; collapse match hides children", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const current = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const prev = pipeline.tree.find((n) => n.matchId === "fx-khl-cska-prev")!;
    renderSales(pipeline);

    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${current.label}` }),
    );
    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${prev.label}` }),
    );
    expect(screen.getAllByText(MATCH_SALES_SECTION_LABELS.ticketType).length).toBe(2);

    await user.click(
      screen.getByRole("button", { name: `Свернуть: ${current.label}` }),
    );
    expect(screen.getAllByText(MATCH_SALES_SECTION_LABELS.ticketType).length).toBe(1);
  });

  it("filters match rows by opponent name and preserves expanded state", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();

    const current = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const prev = pipeline.tree.find((n) => n.matchId === FIXTURE_PREV_MATCH_ID)!;

    renderSales(pipeline, [current.id]);

    // Expanded match's section label is visible before filtering.
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.ticketType)).toBeTruthy();

    const input = screen.getByPlaceholderText("Поиск по мероприятию...");

    await user.clear(input);
    await user.type(input, "ЦСКА");

    // Filter hides the expanded match (and its children), but doesn't mutate expanded ids.
    expect(screen.queryByText(current.label)).toBeNull();
    expect(screen.getByText(prev.label)).toBeTruthy();
    expect(screen.queryByText(MATCH_SALES_SECTION_LABELS.ticketType)).toBeNull();

    await user.clear(input);

    // Expanding state is preserved when the match becomes visible again.
    expect(screen.getByText(current.label)).toBeTruthy();
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.ticketType)).toBeTruthy();
  });

  it("has no inner filter bar on a populated table", () => {
    const { container } = renderSales();
    expect(container.querySelector("#match-sales-local-filters-title")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Сбросить фильтры")).toBeNull();
    expect(screen.queryByText("Группировка")).toBeNull();
  });

  it("supports keyboard expand and accessible names", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    renderSales(pipeline);
    const button = screen.getByRole("button", {
      name: `Развернуть: ${match.label}`,
    });
    button.focus();
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    const collapse = screen.getByRole("button", {
      name: `Свернуть: ${match.label}`,
    });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    collapse.focus();
    await user.keyboard(" ");
    expect(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }).getAttribute(
        "aria-expanded",
      ),
    ).toBe("false");
  });

  it("does not duplicate rows on rapid toggle", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const { container } = renderSales(pipeline);
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

  it("paginates match rows only and keeps expand on the same page", async () => {
    const user = userEvent.setup();
    const extra: MatchSalesTreeNode[] = Array.from({ length: 16 }, (_, index) => ({
      id: `m:page-${index}`,
      level: "match" as const,
      matchId: `page-${index}`,
      date: new Date(2025, 8, 16 - index),
      label: `PageMatch ${index}`,
      revenue: 100 + index,
      planRevenue: 200,
      avgPrice: 100,
      ticketsSold: 1,
      freeTickets: 0,
      issuedTickets: 1,
      occupancyIssuedTickets: 1,
      capacity: 100,
      loyaltyDiscountPct: 0,
      hasChildren: false,
      children: [],
    }));
    const tree = sortMatchSalesNodes([...extra], { id: "date", desc: true });
    const rows: MatchSalesRow[] = tree.map((node) => ({
      matchId: node.matchId,
      eventLabel: node.label,
      date: node.date ?? new Date(),
      revenue: node.revenue,
      planRevenue: node.planRevenue ?? 0,
      avgPrice: node.avgPrice,
      ticketsSold: node.ticketsSold,
      freeTickets: node.freeTickets,
      issuedTickets: node.issuedTickets,
      occupancyIssuedTickets: node.occupancyIssuedTickets,
      capacity: node.capacity ?? 0,
      loyaltyDiscountPct: node.loyaltyDiscountPct,
    }));
    render(
      <Harness tree={tree} matchRows={rows} />,
    );
    expect(screen.getByText("16 мероприятий")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.queryByText("PageMatch 15")).toBeNull();
    const first = tree[0]!;
    expect(screen.getByText(first.label)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Вперёд" }));
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByText("PageMatch 15")).toBeTruthy();
    expect(screen.queryByText(first.label)).toBeNull();
  });

  it("shows em dash for missing occupancy / plan base", () => {
    const pipeline = buildDefaultFixtureTree();
    const incomplete = pipeline.tree.find((n) => n.matchId === "fx-mhl-incomplete")!;
    renderSales(pipeline);
    expect(screen.getByText(incomplete.label)).toBeTruthy();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("shows opponent name without the match date in the event title", () => {
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    expect(match.label).toBe("СКА");
    expect(match.label).not.toMatch(/\d{2}-\d{2}-\d{2}/);
    renderSales(pipeline);
    expect(screen.getByText("СКА")).toBeTruthy();
    expect(screen.getByText(formatDate(match.date!))).toBeTruthy();
    expect(screen.queryByText(/СКА \d{2}-\d{2}-\d{2}/)).toBeNull();
  });

  it("puts Выполнение плана in its own column after Выручка, not on the revenue bar", () => {
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const incomplete = pipeline.tree.find((n) => n.matchId === "fx-mhl-incomplete")!;
    renderSales(pipeline);

    const headers = screen.getAllByRole("columnheader").map((el) => el.textContent);
    expect(headers).toEqual(SALES_COLUMNS);

    const pct = formatPercent((match.revenue / match.planRevenue!) * 100);
    const cells = cellsForLabel(match.label);
    expect(cellText(cells[2]!)).not.toContain(pct.replace(/\s/g, " "));
    expect(cellText(cells[3]!)).toContain(pct.replace(/\s/g, " "));

    const incompleteCells = cellsForLabel(incomplete.label);
    expect(within(incompleteCells[3]!).getByText("—")).toBeTruthy();
    expect(within(incompleteCells[3]!).queryByText(formatPercent(0))).toBeNull();
  });

  it("keeps metric bars inside a fixed-layout grid table", () => {
    const { container } = renderSales();
    const table = container.querySelector('[data-testid="desktop-sales-table"]');
    expect(table?.className).toContain("table-fixed");
    const bar = container.querySelector(
      '[data-testid="desktop-sales-table"] tbody td .relative.h-6',
    );
    expect(bar?.className).toContain("w-full");
    expect(bar?.className).toContain("min-w-0");
    expect(bar?.className).not.toContain("min-w-[120px]");
  });

  it("uses the same column-width rhythm as Продажи по матчам", () => {
    renderSales();
    const widthClass = (name: string) =>
      [...screen.getByRole("columnheader", { name }).classList]
        .filter(
          (cls) =>
            cls.startsWith("w-[") ||
            cls.startsWith("min-w-") ||
            cls.startsWith("max-w-") ||
            cls === "w-auto",
        )
        .sort()
        .join(" ");

    expect(widthClass("Мероприятие")).toBe(
      "max-w-[14rem] min-w-[14rem] w-[14rem]",
    );
    expect(widthClass("Дата")).toBe("max-w-[7rem] w-[7rem]");
    expect(widthClass("Выручка")).toBe("max-w-[10.5rem] w-[10.5rem]");
    expect(widthClass("Выполнение плана")).toBe("max-w-[10.5rem] w-[10.5rem]");
    expect(widthClass("Средняя цена")).toBe("max-w-[9rem] w-[9rem]");
    expect(widthClass("Продано")).toBe("max-w-[9rem] w-[9rem]");
    expect(widthClass("Бесплатно")).toBe("max-w-[6.5rem] w-[6.5rem]");
    expect(widthClass("Заполняемость")).toBe("max-w-[10.5rem] w-[10.5rem]");
    expect(widthClass("Скидка ПЛ")).toBe("max-w-[7rem] w-[7rem]");

    const table = screen.getByTestId("desktop-sales-table");
    expect(table.className).toContain("min-w-[85rem]");
    expect(table.className).toContain("xl:min-w-[80rem]");
    expect(table.className).toContain("table-fixed");
    const eventHeader = screen.getByRole("columnheader", { name: "Мероприятие" });
    expect(eventHeader.className).toContain("xl:w-auto");
    expect(eventHeader.className).toContain("xl:min-w-0");
    expect(eventHeader.className).not.toContain("overflow-hidden");
    const scroller = screen.getByTestId("sticky-scroll-table");
    expect(scroller.className).toContain(STICKY_TABLE_ROW_HOVER_CLASS);
    const row = screen.getAllByRole("row")[1];
    expect(row?.className).not.toMatch(/hover:bg-/);

    const nameCell = table.querySelector("tbody td");
    expect(nameCell?.className).not.toContain("relative");
    expect(nameCell?.className).not.toContain("z-[2]");
  });

  it("covers scrolling metric cells with an opaque sticky first column", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(
      /\.sticky-scroll-table tbody td:first-child,[\s\S]*z-index:\s*12;[\s\S]*background-color:\s*var\(--card\)/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table tbody td:first-child,[\s\S]*left:\s*0;/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table tbody td:first-child,[\s\S]*overflow:\s*clip;/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table tbody td:first-child,[\s\S]*isolation:\s*isolate;/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table tbody td:first-child,[\s\S]*-1rem 0 0 0 var\(--card\)[\s\S]*1px 0 0 0 var\(--border\)/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table thead th:first-child,[\s\S]*z-index:\s*21;/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table tbody td:not\(:first-child\) \{[\s\S]*isolation:\s*isolate;/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table-row-hover tbody tr:hover > td:first-child \{[\s\S]*background-color:\s*var\(--background\)/,
    );
  });

  it("does not truncate tablet match names and seals the sticky left edge", () => {
    const pipeline = buildDefaultFixtureTree();
    renderSales(pipeline);
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    const name = screen.getByText(match.label);
    expect(name.className).toContain("break-words");
    expect(name.className).toContain("xl:whitespace-nowrap");
    expect(name.className).not.toContain("md:whitespace-nowrap");
    expect(name.className).not.toContain("truncate");

    const scroller = screen.getByTestId("sticky-scroll-table");
    expect(scroller.className).toContain("relative");
    expect(scroller.className).toContain("overflow-x-auto");

    const planHeader = screen.getByRole("columnheader", {
      name: "Выполнение плана",
    });
    expect(planHeader.className).toContain("overflow-hidden");
    const planLabel = planHeader.querySelector("span");
    expect(planLabel?.className).toContain("whitespace-normal");
    expect(planLabel?.className).toContain("xl:whitespace-nowrap");
  });

  it("fills the sector issued bar from sector occupancy, not qty/matchTotal", () => {
    const matchId = "occ-match";
    const sector: MatchSalesTreeNode = {
      id: `m:${matchId}|z:up_to_500|sec:A`,
      level: "sector",
      matchId,
      date: null,
      label: "A",
      revenue: 240_000,
      planRevenue: null,
      avgPrice: 1000,
      ticketsSold: 240,
      freeTickets: 0,
      issuedTickets: 240,
      occupancyIssuedTickets: 240,
      capacity: 800,
      loyaltyDiscountPct: 1.8,
      hasChildren: false,
      children: [],
    };
    const zone: MatchSalesTreeNode = {
      id: `m:${matchId}|z:up_to_500`,
      level: "priceZone",
      matchId,
      date: null,
      label: PRICE_ZONE_LABELS.up_to_500,
      revenue: 240_000,
      planRevenue: null,
      avgPrice: 1000,
      ticketsSold: 240,
      freeTickets: 0,
      issuedTickets: 240,
      occupancyIssuedTickets: 0,
      capacity: null,
      loyaltyDiscountPct: 1.8,
      hasChildren: true,
      children: [sector],
    };
    const section: MatchSalesTreeNode = {
      id: `m:${matchId}|sec:priceZone`,
      level: "section",
      matchId,
      date: null,
      label: MATCH_SALES_SECTION_LABELS.priceZone,
      revenue: 11_952_000,
      planRevenue: 13_000_000,
      avgPrice: 1000,
      ticketsSold: 11_000,
      freeTickets: 0,
      issuedTickets: 11_952,
      occupancyIssuedTickets: 11_952,
      capacity: 12_000,
      loyaltyDiscountPct: 2.9,
      hasChildren: true,
      children: [zone],
    };
    const match: MatchSalesTreeNode = {
      id: `m:${matchId}`,
      level: "match",
      matchId,
      date: new Date(2025, 9, 15),
      label: "OccupancyMatch",
      revenue: 11_952_000,
      planRevenue: 13_000_000,
      avgPrice: 1000,
      ticketsSold: 11_000,
      freeTickets: 0,
      issuedTickets: 11_952,
      occupancyIssuedTickets: 11_952,
      capacity: 12_000,
      loyaltyDiscountPct: 2.9,
      hasChildren: true,
      children: [section],
    };

    const sectorOccupancy = matchSalesIssuedOccupancyPercent(sector);
    const matchShare = (sector.issuedTickets / match.issuedTickets) * 100;
    expect(sectorOccupancy).toBeCloseTo(30);
    expect(sectorOccupancy).not.toBeCloseTo(matchShare);

    render(
      <Harness
        tree={[match]}
        matchRows={[
          {
            matchId,
            eventLabel: match.label,
            date: match.date!,
            revenue: match.revenue,
            planRevenue: match.planRevenue ?? 0,
            avgPrice: match.avgPrice,
            ticketsSold: match.ticketsSold,
            freeTickets: match.freeTickets,
            issuedTickets: match.issuedTickets,
            occupancyIssuedTickets: match.occupancyIssuedTickets,
            capacity: match.capacity ?? 0,
            loyaltyDiscountPct: match.loyaltyDiscountPct,
          },
        ]}
        initialExpanded={[match.id, section.id, zone.id]}
      />,
    );

    const sectorCells = cellsForLabel("A");
    const issuedCell = sectorCells[7]!;
    expect(cellText(issuedCell)).toContain("240 шт");
    expect(cellText(issuedCell)).toContain(formatPercent(30).replace(/\s/g, " "));
    const sectorBar = issuedCell.querySelector(".bg-emerald-200") as HTMLElement | null;
    expect(sectorBar).toBeTruthy();
    expect(sectorBar!.style.width).toBe("30%");
    expect(sectorBar!.style.width).not.toBe(`${matchShare}%`);

    const matchCells = cellsForLabel(match.label);
    const matchBar = matchCells[7]!.querySelector(".bg-emerald-500") as HTMLElement | null;
    const matchOcc =
      (match.occupancyIssuedTickets / occupancyMassCapacity(match.capacity!)) * 100;
    expect(matchBar).toBeTruthy();
    expect(matchBar!.style.width).toBe(`${matchOcc}%`);
  });

  it("scales match revenue bar to plan fulfillment, not max revenue in the table", () => {
    const akBars = stubMatch({
      id: "m:ak-bars",
      matchId: "ak-bars",
      label: "Ак Барс",
      date: new Date(2026, 2, 29),
      revenue: 12_406_805,
      planRevenue: 12_406_805 / 0.455,
    });
    const avangard = stubMatch({
      id: "m:avangard",
      matchId: "avangard",
      label: "Авангард",
      date: new Date(2026, 2, 13),
      revenue: 22_476_290,
      planRevenue: 22_476_290 / 0.997,
    });
    const noPlan = stubMatch({
      id: "m:no-plan",
      matchId: "no-plan",
      label: "No Plan",
      date: new Date(2026, 1, 1),
      revenue: 8_000_000,
      planRevenue: null,
    });

    render(
      <Harness
        tree={[akBars, avangard, noPlan]}
        matchRows={[akBars, avangard, noPlan].map(stubMatchRow)}
      />,
    );

    const akBarsPct = matchSalesPlanFulfillmentPct(
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
    expect(cellText(akBarsCell)).not.toContain(
      formatPercent(akBarsPct).replace(/\s/g, " "),
    );

    const avangardPct = matchSalesPlanFulfillmentPct(
      avangard.revenue,
      avangard.planRevenue,
    )!;
    const avangardBar = revenueCellForLabel(avangard.label).querySelector(
      ".bg-rose-400",
    ) as HTMLElement | null;
    expect(avangardBar).toBeTruthy();
    expect(avangardBar!.style.width).toBe(shareBarWidth(avangardPct));

    expect(
      revenueCellForLabel(noPlan.label).querySelector("[class*='bg-rose']"),
    ).toBeNull();
    expect(cellText(revenueCellForLabel(noPlan.label))).toContain(
      formatCurrency(noPlan.revenue).replace(/\s/g, " ").trim(),
    );
  });
});

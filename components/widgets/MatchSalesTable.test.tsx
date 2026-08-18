/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MatchSalesTable } from "@/components/widgets/MatchSalesTable";
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
  sortMatchSalesNodes,
  toggleExpandedKey,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import { PRICE_ZONE_LABELS } from "@/lib/ticket-filter-options";
import type { DashboardFilters, MatchSalesRow, TicketFilters } from "@/types/dashboard";
import type { MatchSalesTreeState } from "@/hooks/useMatchSalesTree";

afterEach(() => {
  cleanup();
});

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
});

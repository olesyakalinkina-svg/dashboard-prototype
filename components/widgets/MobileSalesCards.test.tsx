/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MobileSalesCards } from "@/components/widgets/MobileSalesCards";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import {
  FIXTURE_CURRENT_MATCH_ID,
  FIXTURE_DASHBOARD_FILTERS,
  FIXTURE_TICKET_FILTERS,
  buildDefaultFixtureTree,
  computeFixtureMatchSalesTable,
} from "@/lib/match-sales-tree.fixture";
import {
  getMatchSalesBarMaxima,
  MATCH_SALES_SECTION_LABELS,
  toggleExpandedKey,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import type { MatchSalesTreeState } from "@/hooks/useMatchSalesTree";
import type { DashboardFilters, MatchSalesRow, TicketFilters } from "@/types/dashboard";

afterEach(() => {
  cleanup();
});

function Harness({
  tree,
  matchRows,
  filters = FIXTURE_DASHBOARD_FILTERS,
  ticketFilters = FIXTURE_TICKET_FILTERS,
}: {
  tree: MatchSalesTreeNode[];
  matchRows: MatchSalesRow[];
  filters?: DashboardFilters;
  ticketFilters?: TicketFilters;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
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
  return <MobileSalesCards treeState={treeState} />;
}

describe("MobileSalesCards parallel structure", () => {
  it("renders match cards collapsed, then three sibling sections", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);

    expect(screen.getByText("Продажи")).toBeTruthy();
    expect(screen.queryByText(MATCH_SALES_SECTION_LABELS.ticketType)).toBeNull();
    const expand = screen.getByRole("button", {
      name: `Развернуть: ${match.label}`,
    });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    await user.click(expand);
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.ticketType)).toBeTruthy();
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.orderSource)).toBeTruthy();
    expect(screen.getByText(MATCH_SALES_SECTION_LABELS.priceZone)).toBeTruthy();
    expect(screen.queryByText("Арена")).toBeNull();
  });

  it("expands a section independently on mobile", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);
    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MATCH_SALES_SECTION_LABELS.orderSource}`,
      }),
    );
    expect(screen.getByText("Кассы")).toBeTruthy();
    expect(screen.getByText("Официальный сайт")).toBeTruthy();
    expect(screen.getByText("Яндекс-Афиша")).toBeTruthy();
    expect(screen.queryByText("Арена")).toBeNull();
    expect(screen.queryByText("до 1500")).toBeNull();
  });

  it("shows empty state without an inner filter bar", () => {
    const pipeline = computeFixtureMatchSalesTable(FIXTURE_DASHBOARD_FILTERS, {
      ...FIXTURE_TICKET_FILTERS,
      league: "VHL",
    });
    const { container } = render(
      <Harness tree={pipeline.tree} matchRows={pipeline.rows} />,
    );
    expect(screen.getByText("Нет данных")).toBeTruthy();
    expect(container.querySelector("#match-sales-local-filters-title")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Группировка")).toBeNull();
  });

  it("does not show a + control on leaves", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);
    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MATCH_SALES_SECTION_LABELS.ticketType}`,
      }),
    );
    expect(screen.getByText("Арена")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Развернуть: Арена" })).toBeNull();
  });

  it("expands a price zone into sector cards on mobile", async () => {
    const user = userEvent.setup();
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);
    await user.click(
      screen.getByRole("button", { name: `Развернуть: ${match.label}` }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: ${MATCH_SALES_SECTION_LABELS.priceZone}`,
      }),
    );
    expect(screen.getByText("до 1500")).toBeTruthy();
    expect(screen.queryByText("VIP")).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: `Развернуть: от 4000 до 6000`,
      }),
    );
    expect(screen.getByText("VIP")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Развернуть: VIP" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Развернуть: Арена" })).toBeNull();
  });

  it("shows opponent name without the match date on the card title", () => {
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    expect(match.label).toBe("СКА");
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);
    expect(screen.getByText("СКА")).toBeTruthy();
    expect(screen.getByText(formatDate(match.date!))).toBeTruthy();
    expect(screen.queryByText(/СКА \d{2}-\d{2}-\d{2}/)).toBeNull();
  });

  it("shows plan % as its own field after Выручка, not on the revenue value", () => {
    const pipeline = buildDefaultFixtureTree();
    const match = pipeline.tree.find((n) => n.matchId === FIXTURE_CURRENT_MATCH_ID)!;
    render(<Harness tree={pipeline.tree} matchRows={pipeline.rows} />);

    const card = screen.getByText(match.label).closest("article");
    expect(card).toBeTruthy();
    const pct = formatPercent((match.revenue / match.planRevenue!) * 100);
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
});

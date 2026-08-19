/** @vitest-environment jsdom */
import { readFileSync } from "fs";
import { join } from "path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CombinedMatchSalesTable } from "@/components/widgets/DataTableWidget";
import { STICKY_TABLE_ROW_HOVER_CLASS } from "@/components/ui/sales-table-layout";
import type { CombinedMatchSalesRow } from "@/types/dashboard";

afterEach(() => {
  cleanup();
});

const SAMPLE: CombinedMatchSalesRow[] = [
  {
    matchId: "m1",
    eventLabel: "vs СКА",
    date: new Date(2025, 9, 15),
    ticketRevenue: 100_000,
    merchRevenue: 50_000,
    totalRevenue: 150_000,
    planRevenue: 200_000,
    ticketsSold: 10,
    issuedTickets: 10,
    capacity: 100,
    fillRate: 10,
    merchReceipts: 3,
  },
];

function widthClass(name: string) {
  return [...screen.getByRole("columnheader", { name }).classList]
    .filter(
      (cls) =>
        cls.startsWith("w-[") ||
        cls.startsWith("min-w-") ||
        cls.startsWith("max-w-") ||
        cls === "w-auto",
    )
    .sort()
    .join(" ");
}

describe("CombinedMatchSalesTable", () => {
  it("locks name/date/money/percent/qty columns and highlights every hovered cell", () => {
    render(<CombinedMatchSalesTable data={SAMPLE} />);

    expect(widthClass("Мероприятие")).toBe("min-w-0 w-auto");
    expect(widthClass("Дата")).toBe("max-w-[7rem] w-[7rem]");
    expect(
      [...screen.getByRole("columnheader", { name: /^Билеты$/ }).classList]
        .filter(
          (cls) =>
            cls.startsWith("w-[") ||
            cls.startsWith("min-w-") ||
            cls.startsWith("max-w-") ||
            cls === "w-auto",
        )
        .sort()
        .join(" "),
    ).toBe("max-w-[10.5rem] w-[10.5rem]");
    expect(widthClass("Мерч")).toBe("max-w-[10.5rem] w-[10.5rem]");
    expect(widthClass("Итого")).toBe("max-w-[10.5rem] w-[10.5rem]");
    expect(widthClass("Билеты, шт")).toBe("max-w-[9rem] w-[9rem]");
    expect(widthClass("Заполняемость")).toBe("max-w-[10.5rem] w-[10.5rem]");
    expect(widthClass("Чеки мерча")).toBe("max-w-[8rem] w-[8rem]");

    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-[72rem]");
    expect(table.className).toContain("table-fixed");

    const scroller = screen.getByTestId("sticky-scroll-table");
    expect(scroller.className).toContain(STICKY_TABLE_ROW_HOVER_CLASS);
    const row = screen.getByText("vs СКА").closest("tr");
    expect(row?.className).not.toMatch(/hover:bg-/);

    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(
      /\.sticky-scroll-table-row-hover tbody tr:hover > td/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table-row-hover tbody tr:hover > td:first-child/,
    );
  });
});

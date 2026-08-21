/** @vitest-environment jsdom */
import { readFileSync } from "fs";
import { join } from "path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchSkuSalesTable } from "@/components/widgets/DataTableWidget";
import { MERCH_SKU_SALES_COLUMN_WIDTHS } from "@/components/ui/sales-table-layout";
import type { MerchSkuSalesRow } from "@/types/dashboard";

vi.mock("@/hooks/useLayoutMode", () => ({
  useIsMobileLayout: () => false,
}));

afterEach(() => {
  cleanup();
});

const SAMPLE: MerchSkuSalesRow[] = Array.from({ length: 22 }, (_, index) => ({
  productName: `Товар ${index + 1} с длинным названием`,
  units: 100 - index,
  revenue: 10_000 - index * 100,
  receiptsWithProduct: 50 - index,
  marginPct: 55,
  actualToListPricePct: 98,
}));

describe("MerchSkuSalesTable", () => {
  it("fits columns without horizontal scroll and paginates at 20 rows", () => {
    render(<MerchSkuSalesTable data={SAMPLE} />);

    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-0");
    expect(table.className).toContain("table-fixed");
    expect(table.className).not.toMatch(/min-w-\[52rem\]/);

    const cols = table.querySelectorAll("colgroup col");
    expect(cols).toHaveLength(Object.keys(MERCH_SKU_SALES_COLUMN_WIDTHS).length);
    expect(screen.getByRole("columnheader", { name: "Товар" }).className).toContain(
      "min-w-0",
    );
    expect(screen.getByRole("columnheader", { name: "Количество" }).className).toContain(
      "w-[6.5rem]",
    );

    const scroller = screen.getByTestId("sticky-scroll-table");
    expect(scroller.className).toContain("overflow-x-hidden");
    expect(scroller.className).not.toContain("overflow-x-auto");

    expect(screen.getByText(/22 товаров/)).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    // thead + 20 body rows on page 1
    expect(table.querySelectorAll("tbody tr")).toHaveLength(20);
  });

  it("keeps sticky title cells above body content via opaque high z-index", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(
      /\.sticky-scroll-table thead th \{[\s\S]*z-index:\s*20;[\s\S]*background-color:\s*var\(--card\)/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table tfoot td \{[\s\S]*position:\s*sticky;[\s\S]*bottom:\s*0;[\s\S]*z-index:\s*20/,
    );
    expect(css).toMatch(
      /\.sticky-scroll-table tbody td:first-child,[\s\S]*z-index:\s*12;[\s\S]*background-color:\s*var\(--card\)/,
    );
  });
});

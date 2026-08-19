/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

afterEach(() => {
  cleanup();
});

describe("DateRangePicker", () => {
  it("portals the calendar to document.body so filter-bar backdrop-filter cannot offset it", async () => {
    const user = userEvent.setup();
    render(
      <div className="sticky top-0 backdrop-blur-sm">
        <DateRangePicker
          label="Дата покупки"
          value={{ from: null, to: null }}
          onChange={() => {}}
          hideRangeFields
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Весь период" }));

    const menu = screen.getByTestId("date-range-menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu.className).toMatch(/\bfixed\b/);
    expect(screen.getByLabelText("Предыдущий месяц")).toBeTruthy();
  });

  it("keeps the calendar open when clicking a day inside the portaled menu", async () => {
    const user = userEvent.setup();
    render(
      <DateRangePicker
        label="Дата покупки"
        value={{ from: null, to: null }}
        onChange={() => {}}
        hideRangeFields
        minDate={new Date("2026-04-01")}
        maxDate={new Date("2026-04-30")}
        today={new Date("2026-04-15")}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Весь период" }));
    await user.click(screen.getByRole("button", { name: "15" }));

    expect(screen.getByTestId("date-range-menu")).toBeTruthy();
    expect(screen.getByText("Выберите дату окончания периода")).toBeTruthy();
  });
});

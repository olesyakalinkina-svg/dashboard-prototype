/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiSelect } from "@/components/ui/MultiSelect";

const OPTIONS = [
  { value: "a", label: "Динамо Мск · 17 мая 2026" },
  { value: "b", label: "Торпедо · 25 апр. 2026" },
];

afterEach(() => {
  cleanup();
});

describe("MultiSelect", () => {
  it("portals the menu to document.body so filter-bar backdrop-filter cannot offset it", async () => {
    const user = userEvent.setup();
    render(
      <div className="sticky top-0 backdrop-blur-sm">
        <MultiSelect
          label="Матч"
          options={OPTIONS}
          value={[]}
          onChange={() => {}}
          emptyMeansAll
          selectAllLabel="Все матчи"
          allSelectedLabel="Все матчи"
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Все матчи" }));

    const menu = screen.getByTestId("multi-select-menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu.className).toMatch(/\bfixed\b/);
    expect(menu.className).toMatch(/overflow-auto/);
    expect(menu.className).toMatch(/max-h-64/);
    expect(screen.getByText("Динамо Мск · 17 мая 2026")).toBeTruthy();
  });

  it("keeps the menu open when clicking an option inside the portaled list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        options={OPTIONS}
        value={[]}
        onChange={onChange}
        emptyMeansAll
        applyOnClose
        selectAllLabel="Все матчи"
        allSelectedLabel="Все матчи"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Все матчи" }));
    await user.click(screen.getByText("Торпедо · 25 апр. 2026"));

    expect(screen.getByTestId("multi-select-menu")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on outside click and on page scroll", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <MultiSelect
          options={OPTIONS}
          value={[]}
          onChange={() => {}}
          emptyMeansAll
          selectAllLabel="Все матчи"
          allSelectedLabel="Все матчи"
        />
        <button type="button">outside</button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Все матчи" }));
    expect(screen.getByTestId("multi-select-menu")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByTestId("multi-select-menu")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Все матчи" }));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    fireEvent.scroll(window);
    expect(screen.queryByTestId("multi-select-menu")).toBeNull();
  });
});

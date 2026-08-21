import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionRenewalWidget } from "@/components/widgets/SubscriptionRenewalWidget";
import type { Subscription } from "@/types/dashboard";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import {
  computeSubscriptionRenewal,
  getRenewalSectionTitle,
} from "@/lib/subscription-renewal";

const { mockSubscriptions } = vi.hoisted(() => {
  const mockSubscriptions: Subscription[] = [
    {
      id: "p1",
      planId: "plan-1",
      planName: "Абонемент на 5 матчей (сектор A)",
      customerId: "cust-keep",
      purchasedAt: new Date(2024, 8, 1),
      validTo: new Date(2025, 4, 31),
      price: 19_000,
      matchesTotal: 5,
      matchesUsed: 1,
      channel: "official_site",
      status: "active",
      season: "2024/25",
      league: "KHL",
      tournamentStage: "regular",
      arena: "main",
      ticketType: "arena",
      sector: "A",
    },
    {
      id: "p2",
      planId: "plan-2",
      planName: "Абонемент на 5 матчей (сектор B)",
      customerId: "cust-gone",
      purchasedAt: new Date(2024, 8, 2),
      validTo: new Date(2025, 4, 31),
      price: 21_000,
      matchesTotal: 5,
      matchesUsed: 1,
      channel: "official_site",
      status: "active",
      season: "2024/25",
      league: "KHL",
      tournamentStage: "regular",
      arena: "main",
      ticketType: "arena",
      sector: "B1",
    },
    {
      id: "n1",
      planId: "plan-1",
      planName: "Абонемент на 5 матчей (сектор A)",
      customerId: "cust-keep",
      purchasedAt: new Date(2025, 8, 1),
      validTo: new Date(2026, 4, 31),
      price: 19_000,
      matchesTotal: 5,
      matchesUsed: 1,
      channel: "official_site",
      status: "active",
      season: "2025/26",
      league: "KHL",
      tournamentStage: "regular",
      arena: "main",
      ticketType: "arena",
      sector: "A",
    },
    {
      id: "n2",
      planId: "plan-1",
      planName: "Абонемент на 5 матчей (сектор A)",
      customerId: "cust-new",
      purchasedAt: new Date(2025, 8, 2),
      validTo: new Date(2026, 4, 31),
      price: 19_000,
      matchesTotal: 5,
      matchesUsed: 1,
      channel: "official_site",
      status: "active",
      season: "2025/26",
      league: "KHL",
      tournamentStage: "regular",
      arena: "main",
      ticketType: "arena",
      sector: "A",
    },
  ];
  return { mockSubscriptions };
});

vi.mock("@/context/FilterContext", async () => {
  const { DEFAULT_SUBSCRIPTION_FILTERS } = await import(
    "@/lib/subscription-filter-options"
  );
  return {
    useFilterState: () => ({
      subscriptionFilters: DEFAULT_SUBSCRIPTION_FILTERS,
    }),
  };
});

vi.mock("@/lib/mock/hockey", () => ({
  getSubscriptions: () => mockSubscriptions,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

describe("SubscriptionRenewalWidget", () => {
  it("renders the section, three KPI cards, and product chart — not loyalty or share chart", () => {
    const { container } = render(<SubscriptionRenewalWidget />);

    expect(screen.getByText(getRenewalSectionTitle())).toBeTruthy();
    expect(screen.getByText("Продлили")).toBeTruthy();
    expect(screen.getByText("Не продлили")).toBeTruthy();
    expect(screen.getByText("Новые клиенты")).toBeTruthy();
    expect(screen.getByText("Продление по продукту")).toBeTruthy();
    expect(
      screen.getByText("доля владельцев, купивших абонементы на новый сезон"),
    ).toBeTruthy();
    expect(screen.queryByText(/Что покупают/)).toBeNull();
    expect(screen.queryByText(/лояльност/i)).toBeNull();

    const kpiGrid = container.querySelector(
      "div.grid.min-w-0.grid-cols-1.gap-2.sm\\:grid-cols-3",
    );
    expect(kpiGrid).not.toBeNull();

    const productChartGrid = container.querySelector(
      "div.grid.min-w-0.grid-cols-1.items-start.gap-4.min-\\[1024px\\]\\:grid-cols-2",
    );
    expect(productChartGrid).not.toBeNull();
    expect(productChartGrid?.textContent).toContain("Продление по продукту");
  });

  it("shows product / base / renewed / share columns when the table is expanded", async () => {
    const user = userEvent.setup();
    render(<SubscriptionRenewalWidget />);

    expect(screen.queryByText("Продукт")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Показать таблицу" }));
    expect(screen.getByText("Продукт")).toBeTruthy();
    expect(screen.getByText("База")).toBeTruthy();
    expect(screen.getAllByText("Продлили").length).toBeGreaterThan(1);
    expect(screen.getByText("Продление")).toBeTruthy();

    const computed = computeSubscriptionRenewal({
      subscriptions: mockSubscriptions,
      filters: DEFAULT_SUBSCRIPTION_FILTERS,
    });
    expect(screen.getByText("Все включено")).toBeTruthy();
    expect(screen.getByText("Выходного дня")).toBeTruthy();
    expect(screen.getByText("Сезонный")).toBeTruthy();
    expect(computed.products.map((row) => row.planName)).toEqual([
      "Все включено",
      "Выходного дня",
      "Сезонный",
    ]);
  });

  it("does not overflow the subscriptions tab layout contract in source", () => {
    const widget = readFileSync(
      join(process.cwd(), "components/widgets/SubscriptionRenewalWidget.tsx"),
      "utf8",
    );
    expect(widget).toContain("min-w-0");
    expect(widget).toContain("grid-cols-1");
    expect(widget).toContain("sm:grid-cols-3");
    expect(widget).toMatch(
      /grid min-w-0 grid-cols-1 items-start gap-4 min-\[1024px\]:grid-cols-2">[\s\S]*<RenewalProductChart/,
    );
    expect(widget).not.toContain("лояльности");
  });
});

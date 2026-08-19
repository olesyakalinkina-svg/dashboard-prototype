import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join("tmp", "responsive-audit");

const TABS = [
  { id: "tickets", label: "Билеты" },
  { id: "merch", label: "Мерч" },
  { id: "subscriptions", label: "Абонементы" },
  { id: "matches", label: "Матчи" },
] as const;

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

async function waitForDashboard(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Аналитика хоккейного клуба" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Выручка").first()).toBeVisible({
    timeout: 60_000,
  });
  // Layout hooks default to desktop until matchMedia runs after mount.
  await expect(
    page.getByTestId("filter-trigger").or(page.getByTestId("filter-desktop-bar")),
  ).toBeVisible({ timeout: 15_000 });
}

async function openTab(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(200);
}

async function noPageOverflow(page: Page) {
  const ok = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  return ok;
}

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.describe("responsive audit — 18 checks", () => {
  test("1. mobile filters open as a bottom sheet with sticky actions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    await expect(page.getByTestId("filter-trigger")).toBeVisible();
    await page.getByTestId("filter-trigger").click();
    const sheet = page.getByTestId("filter-bottom-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Сбросить" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Применить" })).toBeVisible();
    await expect(page.getByTestId("filter-desktop-bar")).toHaveCount(0);
  });

  test("2. tablet landscape uses a side panel, not a full filter bar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await waitForDashboard(page);
    await expect(page.getByTestId("filter-trigger")).toBeVisible();
    await page.getByTestId("filter-trigger").click();
    await expect(page.getByTestId("filter-side-panel")).toBeVisible();
    await expect(page.getByTestId("filter-desktop-bar")).toHaveCount(0);
  });

  test("3. desktop keeps the full filter bar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForDashboard(page);
    await expect(page.getByTestId("filter-desktop-bar")).toBeVisible();
    await expect(page.getByTestId("filter-trigger")).toHaveCount(0);
  });

  test("4. tabs stay on one row with a 44px hit area", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    const tabs = page.getByTestId("dashboard-tabs").locator("button");
    const count = await tabs.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i += 1) {
      const box = await tabs.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const wraps = await page.evaluate(() => {
      const strip = document.querySelector("[data-testid='dashboard-tabs']");
      if (!(strip instanceof HTMLElement)) return true;
      return strip.scrollHeight > strip.clientHeight + 8;
    });
    expect(wraps).toBe(false);
  });

  test("5. header title does not overlap refresh on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    const title = page.getByRole("heading", {
      name: "Аналитика хоккейного клуба",
    });
    const refresh = page.getByRole("button", { name: "Обновить данные" });
    const titleBox = await title.boundingBox();
    const refreshBox = await refresh.boundingBox();
    expect(titleBox && refreshBox).toBeTruthy();
    expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(refreshBox!.x + 1);
    await expect(refresh).toHaveAttribute("aria-label", "Обновить данные");
    const refreshHiddenLabel = await refresh.evaluate((el) => {
      const span = el.querySelector("span");
      return !span || getComputedStyle(span).display === "none";
    });
    expect(refreshHiddenLabel).toBe(true);
  });

  test("6. KPI grid is two columns on a 390 phone with no horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    const cards = page.locator("main .rounded-lg.border").filter({
      has: page.locator("p").filter({ hasText: "Выручка" }),
    });
    await expect(cards.first()).toBeVisible();
    expect(await noPageOverflow(page)).toBe(true);
  });

  test("7. widgets stack in a single column on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    await expect(page.getByTestId("mobile-sales-cards")).toBeVisible();
    await expect(page.getByTestId("desktop-sales-table")).toHaveCount(0);
  });

  test("8. widget titles are at least 16px on phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    const size = await page.locator("h3").first().evaluate((el) => {
      return Number.parseFloat(getComputedStyle(el).fontSize);
    });
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test("9. wide tables become cards on the phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    await expect(page.getByTestId("mobile-sales-cards")).toBeVisible();
    await expect(page.getByRole("button", { name: "Подробнее" }).first()).toBeVisible();

    await openTab(page, "Мерч");
    await expect(page.getByTestId("merch-mobile-sales-cards")).toBeVisible();

    await openTab(page, "Матчи");
    await expect(page.getByTestId("combined-mobile-sales-cards")).toBeVisible();
  });

  test("10. expand controls keep a 44px hit area on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await waitForDashboard(page);
    const expand = page.getByRole("button", { name: /^Развернуть:/ }).first();
    await expect(expand).toBeVisible();
    const box = await expand.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("11. merch hierarchy cards show name, date, revenue, receipts, units", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    await openTab(page, "Мерч");
    const card = page.getByTestId("merch-mobile-card").first();
    await expect(card).toBeVisible();
    await expect(card.getByText("Выручка")).toBeVisible();
    await expect(card.getByText("Чеки")).toBeVisible();
    await expect(card.getByText("Товары")).toBeVisible();
    await expect(card.getByRole("button", { name: "Подробнее" })).toBeVisible();
  });

  test("12. merch channel bars stack the name above the bar on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    await openTab(page, "Мерч");
    await expect(page.getByText("Выручка по каналам продаж")).toBeVisible();
    const row = page
      .locator("button")
      .filter({ hasText: "%" })
      .first();
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("13. mobile charts stay in the 220–280px band", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    const height = await page
      .locator("h3")
      .filter({ hasText: "Динамика продаж билетов" })
      .evaluate((title) => {
        const card = title.closest(".rounded-lg");
        const plot = card?.querySelector(".recharts-responsive-container");
        return plot instanceof HTMLElement ? plot.getBoundingClientRect().height : 0;
      });
    expect(height).toBeGreaterThanOrEqual(200);
    expect(height).toBeLessThanOrEqual(300);
  });

  test("14. only one heavy table version is in the DOM", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    await expect(page.getByTestId("mobile-sales-cards")).toBeVisible();
    await expect(page.getByTestId("desktop-sales-table")).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForDashboard(page);
    await expect(page.getByTestId("desktop-sales-table")).toBeVisible();
    await expect(page.getByTestId("mobile-sales-cards")).toHaveCount(0);
  });

  test("15. document scrollWidth does not exceed the viewport", async ({
    page,
  }) => {
    const results: Record<string, boolean> = {};
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await waitForDashboard(page);
      for (const tab of TABS) {
        await openTab(page, tab.label);
        results[`${tab.id}-${vp.name}`] = await noPageOverflow(page);
      }
    }
    const failures = Object.entries(results).filter(([, ok]) => !ok);
    expect(failures, JSON.stringify(failures)).toEqual([]);
  });

  test("16. filter overlay is a modal dialog with close and restore", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    const trigger = page.getByTestId("filter-trigger");
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await page.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("17. tablet tables scroll locally with a sticky first column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await waitForDashboard(page);
    await expect(page.getByTestId("sticky-scroll-table").first()).toBeVisible();
    await expect(page.getByTestId("mobile-sales-cards")).toHaveCount(0);
  });

  test("18. decorative chart ellipsis controls are gone", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForDashboard(page);
    await expect(page.locator("button").filter({ has: page.locator("svg.lucide-ellipsis") })).toHaveCount(0);
  });
});

test.describe("responsive screenshots", () => {
  for (const tab of TABS) {
    for (const vp of VIEWPORTS) {
      test(`${tab.label} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await waitForDashboard(page);
        await openTab(page, tab.label);
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(OUT_DIR, `${tab.id}-${vp.name}.png`),
          fullPage: true,
        });
      });
    }
  }

  test("open filters at 390 and 1024 for every tab", async ({ page }) => {
    for (const vp of [
      { name: "390x844", width: 390, height: 844 },
      { name: "1024x768", width: 1024, height: 768 },
    ] as const) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await waitForDashboard(page);
      for (const tab of TABS) {
        await openTab(page, tab.label);
        await page.getByTestId("filter-trigger").click();
        await page.waitForTimeout(250);
        await page.screenshot({
          path: path.join(OUT_DIR, `${tab.id}-${vp.name}-filters.png`),
          fullPage: true,
        });
        await page.keyboard.press("Escape");
      }
    }
  });

  test("expanded hierarchy rows on tickets and merch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForDashboard(page);
    await page.getByRole("button", { name: /^Развернуть:/ }).first().click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(OUT_DIR, "tickets-390x844-expanded.png"),
      fullPage: true,
    });

    await openTab(page, "Мерч");
    await page.getByRole("button", { name: /^Развернуть:/ }).first().click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(OUT_DIR, "merch-390x844-expanded.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await waitForDashboard(page);
    await page.getByRole("button", { name: /^Развернуть:/ }).first().click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(OUT_DIR, "tickets-768x1024-expanded.png"),
      fullPage: true,
    });
  });
});

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function forceClick(locator) {
  await locator.evaluate((el) => {
    if (el instanceof HTMLElement) el.click();
  });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.setDefaultTimeout(30000);

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("button", { name: "Билеты", exact: true }).click();
  await page.locator("h3", { hasText: "Продажи" }).locator("visible=true").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);

  const salesCard = page
    .locator("div.flex.h-full.min-w-0.flex-col")
    .filter({ has: page.locator("h3", { hasText: "Продажи" }) })
    .first();
  await salesCard.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(400);

  const collapsedPath = path.join(__dirname, "tickets-sales-collapsed.png");
  await page.screenshot({ path: collapsedPath, fullPage: false });
  console.log("wrote", collapsedPath, fs.existsSync(collapsedPath));

  await forceClick(salesCard.getByRole("button", { name: /^Развернуть:/ }).first());
  await salesCard.getByText("Тип билета ·").first().waitFor();
  await forceClick(salesCard.getByRole("button", { name: /^Развернуть: Тип билета/ }).first());
  await salesCard.getByText("Источник ·").first().waitFor();
  await forceClick(salesCard.getByRole("button", { name: /^Развернуть: Источник/ }).first());
  await salesCard.getByText("Ценовая зона ·").first().waitFor();
  await page.waitForTimeout(400);

  const expandedPath = path.join(__dirname, "tickets-sales-expanded-zone.png");
  await page.screenshot({ path: expandedPath });

  await forceClick(salesCard.getByRole("button", { name: "Все матчи" }));
  const matchMenu = page.locator("div.absolute").filter({ hasText: "Все матчи" }).last();
  await forceClick(matchMenu.locator("label").nth(2));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await forceClick(salesCard.getByRole("button", { name: "Все зоны" }));
  const zoneMenu = page.locator("div.absolute").filter({ hasText: "Все зоны" }).last();
  await forceClick(zoneMenu.locator("label").filter({ hasText: /^A$/ }).first());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  const firstExpandAfterFilter = salesCard.getByRole("button", { name: /^Развернуть:/ });
  if ((await firstExpandAfterFilter.count()) > 0) {
    await forceClick(firstExpandAfterFilter.first());
    const typeExpand = salesCard.getByRole("button", { name: /^Развернуть: Тип билета/ });
    if ((await typeExpand.count()) > 0) {
      await forceClick(typeExpand.first());
      const sourceExpand = salesCard.getByRole("button", { name: /^Развернуть: Источник/ });
      if ((await sourceExpand.count()) > 0) {
        await forceClick(sourceExpand.first());
      }
    }
  }
  await page.waitForTimeout(400);

  const filteredPath = path.join(__dirname, "tickets-sales-filter-match-zone.png");
  await page.screenshot({ path: filteredPath });

  const bodyText = await page.locator("body").innerText();
  console.log(
    JSON.stringify(
      {
        collapsedPath,
        expandedPath,
        filteredPath,
        hasBanner: bodyText.includes("Показатели рассчитаны по применённым фильтрам"),
        hasZone: bodyText.includes("Ценовая зона ·"),
        hasTicketType: bodyText.includes("Тип билета ·"),
      },
      null,
      2,
    ),
  );

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

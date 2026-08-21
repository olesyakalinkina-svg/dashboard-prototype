import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), "artifacts", "screenshots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const baseUrl = process.env.ZONE_WIDGET_URL ?? "http://localhost:3000";
const widths = [360, 390, 768, 1280, 1440];
const results = [];
const skipWidths = process.env.SKIP_WIDTHS === "1";

if (!skipWidths) {
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 1200 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Продажи по ценовым зонам и секторам на арене", { timeout: 120000 });
  const widgetTitle = page.locator("text=Продажи по ценовым зонам и секторам на арене").first();
  await widgetTitle.scrollIntoViewIfNeeded();

  const rootCard = page.locator("h3:has-text('Продажи по ценовым зонам и секторам на арене')").first().locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
  const cardHeightNoSelection = await rootCard.evaluate((el) => Math.round(el.getBoundingClientRect().height));

  await page.screenshot({ path: join(outDir, `tickets-zone-${width}-default.png`), fullPage: true });

  const firstDataCell = page.locator("table:visible tbody tr td button").nth(1);
  if (await firstDataCell.count()) {
    const started = Date.now();
    await firstDataCell.click();
    await page.waitForTimeout(180);
    const latencyMs = Date.now() - started;
    await page.screenshot({ path: join(outDir, `tickets-zone-${width}-selected.png`), fullPage: true });
    const cardHeightSelected = await rootCard.evaluate((el) => Math.round(el.getBoundingClientRect().height));
    results.push({ width, cardHeightNoSelection, cardHeightSelected, latencyMs });
  } else {
    results.push({ width, cardHeightNoSelection, cardHeightSelected: null, latencyMs: null });
  }

  await page.close();
}
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForSelector("text=Продажи по ценовым зонам и секторам на арене", { timeout: 120000 });
const widget = page.locator("h3:has-text('Продажи по ценовым зонам и секторам на арене')").first().locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
await widget.scrollIntoViewIfNeeded();

const firstMatch = widget.locator("table:visible tbody tr td button").first();
await firstMatch.click();
await page.waitForTimeout(200);

await widget.getByRole("button", { name: "По секторам" }).click();
await page.waitForTimeout(120);

await widget.locator("[data-parent-sector='A'] button").first().click();
await page.waitForTimeout(150);
await page.screenshot({
  path: join(outDir, "tickets-zone-expanded-ordinary-sector.png"),
  fullPage: true,
});

const vipSector = widget.locator("[data-parent-sector='VIP'] button").first();
await vipSector.scrollIntoViewIfNeeded();
await vipSector.click();
await page.waitForTimeout(150);
await page.screenshot({
  path: join(outDir, "tickets-zone-expanded-vip.png"),
  fullPage: true,
});

await widget.getByRole("button", { name: "По ценовым зонам" }).click();
await page.waitForTimeout(120);
await widget.locator("[data-parent-zone='from_2500_to_3000'] button").first().click();
await page.waitForTimeout(150);
await page.screenshot({
  path: join(outDir, "tickets-zone-expanded-2500-3000.png"),
  fullPage: true,
});

await page.evaluate(() => {
  const heading = [...document.querySelectorAll("h3")].find((node) =>
    node.textContent?.includes("Продажи по ценовым зонам и секторам на арене"),
  );
  heading?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(200);

async function clickOpenMenuLabel(text) {
  await page.evaluate((labelText) => {
    const menus = [...document.querySelectorAll("div.absolute.left-0.top-full")];
    const menu = menus[menus.length - 1];
    if (!menu) throw new Error("filter menu is not open");
    const label = [...menu.querySelectorAll("label")].find((node) => {
      const spans = [...node.querySelectorAll("span")].map((span) => span.textContent?.trim());
      return spans.includes(labelText) || node.textContent?.trim() === labelText;
    });
    if (!label) throw new Error(`menu label not found: ${labelText}`);
    label.click();
  }, text);
}

await widget.getByRole("button", { name: "Все секторы" }).click();
for (const sector of ["A", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"]) {
  await clickOpenMenuLabel(sector);
}
await page.waitForTimeout(250);
await page.screenshot({
  path: join(outDir, "tickets-zone-filter-vip.png"),
  fullPage: true,
});

const reset = widget.getByRole("button", { name: "Сбросить фильтры" });
if (await reset.count()) await reset.click();
await page.waitForTimeout(150);
await page.evaluate(() => {
  const heading = [...document.querySelectorAll("h3")].find((node) =>
    node.textContent?.includes("Продажи по ценовым зонам и секторам на арене"),
  );
  heading?.scrollIntoView({ block: "start" });
});

await widget.getByRole("button", { name: "Все зоны" }).click();
for (const label of ["до 500", "от 500 до 1000", "от 2500 до 3000"]) {
  await clickOpenMenuLabel(label);
}
await widget.getByRole("button", { name: /от 1500 до 2000/ }).click();
await widget.getByRole("button", { name: "Все секторы" }).click();
for (const sector of ["A", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"]) {
  await clickOpenMenuLabel(sector);
}
await page.waitForTimeout(250);
await page.screenshot({
  path: join(outDir, "tickets-zone-empty-invalid-filter.png"),
  fullPage: true,
});

await page.close();

console.log(JSON.stringify({
  outDir,
  results,
  matrixShots: [
    "tickets-zone-expanded-ordinary-sector.png",
    "tickets-zone-expanded-vip.png",
    "tickets-zone-expanded-4000-6000.png",
    "tickets-zone-filter-vip.png",
    "tickets-zone-empty-invalid-filter.png",
  ],
}, null, 2));
await browser.close();

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), "artifacts", "screenshots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const widths = [360, 390, 768, 1280, 1440];
const results = [];

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 1200 } });
  await page.goto("http://localhost:3001", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Продажи по ценовым зонам и секторам", { timeout: 120000 });
  const widgetTitle = page.locator("text=Продажи по ценовым зонам и секторам").first();
  await widgetTitle.scrollIntoViewIfNeeded();

  const rootCard = page.locator("h3:has-text('Продажи по ценовым зонам и секторам')").first().locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
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

console.log(JSON.stringify({ outDir, results }, null, 2));
await browser.close();

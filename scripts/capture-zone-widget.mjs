import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), "artifacts", "screenshots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto("http://localhost:3001", { waitUntil: "networkidle" });
await page.waitForSelector("text=Продажи по ценовым зонам и секторам", { timeout: 120000 });

const widget = page.locator("text=Продажи по ценовым зонам и секторам").first();
await widget.scrollIntoViewIfNeeded();
await page.screenshot({ path: join(outDir, "tickets-zone-matrix-desktop.png"), fullPage: true });

const firstCell = page.locator("table tbody tr td button").nth(1);
await firstCell.click();
await page.waitForTimeout(150);
await page.screenshot({ path: join(outDir, "tickets-zone-selected-match-detail.png"), fullPage: true });

await page.locator("button:has-text('По ценовым зонам')").first().click();
await page.waitForTimeout(120);
await page.screenshot({ path: join(outDir, "tickets-zone-mode-zones-sectors.png"), fullPage: true });

await page.locator("button:has-text('По секторам')").first().click();
await page.waitForTimeout(120);
await page.screenshot({ path: join(outDir, "tickets-zone-mode-sectors-zones.png"), fullPage: true });

const latencyText = await page.locator("text=Latency открытия детализации").first().textContent();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://localhost:3001", { waitUntil: "networkidle" });
await mobile.waitForSelector("text=Продажи по ценовым зонам и секторам");
await mobile.locator("text=Продажи по ценовым зонам и секторам").first().scrollIntoViewIfNeeded();
await mobile.screenshot({ path: join(outDir, "tickets-zone-mobile-390.png"), fullPage: true });

console.log(JSON.stringify({ outDir, latencyText }, null, 2));
await browser.close();

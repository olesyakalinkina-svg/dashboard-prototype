import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SCREENSHOT_PATH = path.join(__dirname, "verify-dashboard-desktop.png");

const TABS = [
  { name: "Билеты", checks: ["Бенчмарк выручки сезона", "Продажи"] },
  { name: "Мерч", checks: ["Продажи по сегментам"], absent: ["Продажи по каналам"] },
  { name: "Абонементы", checks: ["Абонементы"] },
  { name: "Матчи", checks: ["Выручка по матчам"] },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(BASE_URL, { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector("h1", { timeout: 60000 });
  await page.waitForTimeout(5000);

  const styled = await page.evaluate(() => {
    const body = document.body;
    const bg = getComputedStyle(body).backgroundColor;
    const hasTailwind = document.querySelector("[class*='bg-']") !== null;
    return { bg, hasTailwind, title: document.querySelector("h1")?.textContent };
  });

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });

  const tabResults = [];
  for (const tab of TABS) {
    await page.getByRole("button", { name: tab.name, exact: true }).click();
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const found = tab.checks.filter((c) => bodyText.includes(c));
    const absentOk = (tab.absent || []).filter((c) => !bodyText.includes(c));
    tabResults.push({
      tab: tab.name,
      found,
      missing: tab.checks.filter((c) => !bodyText.includes(c)),
      absentOk,
      absentFail: (tab.absent || []).filter((c) => bodyText.includes(c)),
    });
  }

  // Tickets tab: check revenue % in sales table
  await page.getByRole("button", { name: "Билеты", exact: true }).click();
  await page.waitForTimeout(2000);
  const hasRevenuePct = await page.evaluate(() => {
    const text = document.body.innerText;
    return /\d+[.,]?\d*\s*%/.test(text) && text.includes("Выручка");
  });

  console.log(JSON.stringify({
    url: BASE_URL,
    screenshot: SCREENSHOT_PATH,
    styled,
    tabResults,
    hasRevenuePct,
    consoleErrors: consoleErrors.slice(0, 20),
  }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

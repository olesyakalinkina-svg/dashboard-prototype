import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function openSubscriptions(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("h1", { timeout: 60000 });
  await page.getByRole("button", { name: "Абонементы", exact: true }).click();
  await page.waitForSelector("text=Темп кампании: абонементы нарастающим итогом", {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
}

async function scrollCheck(page, width) {
  return page.evaluate((expectedWidth) => {
    const doc = document.documentElement;
    return {
      width: expectedWidth,
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      overflow: doc.scrollWidth > window.innerWidth + 1,
    };
  }, width);
}

async function main() {
  const browser = await chromium.launch({
    channel: "msedge",
  });
  const consoleErrors = [];

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  desktop.on("pageerror", (err) => consoleErrors.push(`desktop: ${err.message}`));
  desktop.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`desktop console: ${msg.text()}`);
  });

  await openSubscriptions(desktop);

  const titles = await desktop.evaluate(() =>
    Array.from(document.querySelectorAll("h3"))
      .map((node) => node.textContent?.trim() ?? "")
      .filter((text) => text.includes("Темп кампании")),
  );

  await desktop.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find((node) =>
      node.textContent?.includes("Темп кампании: абонементы"),
    );
    heading?.closest("section")?.scrollIntoView({ block: "start" });
  });
  await desktop.waitForTimeout(400);
  await desktop.screenshot({
    path: path.join(__dirname, "campaign-pace-desktop.png"),
  });

  await desktop.getByRole("button", { name: "Показать таблицу" }).click();
  await desktop.waitForTimeout(400);
  await desktop.screenshot({
    path: path.join(__dirname, "campaign-pace-table.png"),
  });

  const chartBox = await desktop.locator(".recharts-wrapper").first().boundingBox();
  if (chartBox) {
    await desktop.mouse.click(chartBox.x + chartBox.width * 0.7, chartBox.y + chartBox.height * 0.4);
    await desktop.waitForTimeout(400);
  }
  const tooltipVisible = await desktop.locator("text=день кампании").count();
  await desktop.screenshot({
    path: path.join(__dirname, "campaign-pace-tooltip.png"),
  });

  const widths = [360, 390, 430, 768, 1280];
  const scrollResults = [];
  for (const width of widths) {
    const page = await browser.newPage({
      viewport: { width, height: width >= 768 ? 900 : 844 },
    });
    page.on("pageerror", (err) => consoleErrors.push(`${width}: ${err.message}`));
    await openSubscriptions(page);
    scrollResults.push(await scrollCheck(page, width));
    if (width === 390) {
      await page.evaluate(() => {
        const heading = Array.from(document.querySelectorAll("h3")).find((node) =>
          node.textContent?.includes("Темп кампании: абонементы"),
        );
        heading?.closest("section")?.scrollIntoView({ block: "start" });
      });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(__dirname, "campaign-pace-mobile-390.png"),
        fullPage: true,
      });
    }
    await page.close();
  }

  console.log(
    JSON.stringify(
      {
        titles,
        tooltipVisible,
        scrollResults,
        consoleErrors: consoleErrors.slice(0, 20),
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

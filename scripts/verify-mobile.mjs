import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || "http://localhost:3002";
const widths = [360, 390, 430];

async function main() {
  const browser = await chromium.launch();
  const results = [];

  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(BASE_URL, { waitUntil: "load", timeout: 120000 });
    await page.waitForSelector("h1", { timeout: 60000 });
    await page.waitForTimeout(4000);

    const scrollCheck = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      match: document.documentElement.scrollWidth === window.innerWidth,
    }));

    results.push({ width, ...scrollCheck });

    if (width === 390) {
      const dir = __dirname;
      await page.screenshot({
        path: path.join(dir, "mobile-390-top.png"),
        fullPage: false,
      });

      await page.getByRole("button", { name: /Фильтры/ }).click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(dir, "mobile-390-filters-open.png"),
        fullPage: false,
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      await page.screenshot({
        path: path.join(dir, "mobile-390-sales-cards.png"),
        fullPage: true,
      });

      await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h3"));
        const chartTitle = headings.find((h) =>
          h.textContent?.includes("Динамика продаж билетов по матчам"),
        );
        chartTitle?.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(dir, "mobile-390-match-chart.png"),
        fullPage: false,
      });
    }

    await page.close();
  }

  const desktopPage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await desktopPage.goto(BASE_URL, { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(3000);
  await desktopPage.screenshot({
    path: path.join(__dirname, "desktop-1280.png"),
    fullPage: false,
  });
  await desktopPage.close();

  await browser.close();

  console.log(JSON.stringify({ scrollChecks: results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

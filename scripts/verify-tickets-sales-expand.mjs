import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.setDefaultTimeout(20000);

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("button", { name: "Билеты", exact: true }).click();
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")].filter(
      (btn) =>
        btn.getAttribute("aria-label")?.startsWith("Развернуть:") &&
        btn.offsetParent !== null,
    );
    buttons[0]?.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")].filter(
      (btn) =>
        btn.getAttribute("aria-label")?.startsWith("Развернуть: Тип билета") &&
        btn.offsetParent !== null,
    );
    buttons[0]?.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")].filter(
      (btn) =>
        btn.getAttribute("aria-label")?.startsWith("Развернуть: Источник") &&
        btn.offsetParent !== null,
    );
    buttons[0]?.click();
  });
  await page.waitForTimeout(600);

  const expandedPath = path.join(__dirname, "tickets-sales-expanded-zone.png");
  await page.screenshot({ path: expandedPath });

  await page.evaluate(() => {
    const matchBtn = [...document.querySelectorAll("button")].find(
      (btn) =>
        btn.textContent?.trim() === "Все матчи" &&
        btn.closest(".flex.h-full") &&
        btn.offsetParent !== null,
    );
    matchBtn?.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const menu = [...document.querySelectorAll("div.absolute")].find((el) =>
      el.textContent?.includes("Все матчи"),
    );
    const labels = menu ? [...menu.querySelectorAll("label")] : [];
    labels[2]?.click();
  });
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const zoneBtn = [...document.querySelectorAll("button")].find(
      (btn) =>
        btn.textContent?.trim() === "Все зоны" && btn.offsetParent !== null,
    );
    zoneBtn?.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const menu = [...document.querySelectorAll("div.absolute")].find((el) =>
      el.textContent?.includes("Все зоны"),
    );
    const zoneA = menu
      ? [...menu.querySelectorAll("label")].find((label) =>
          /^\s*A\s*$/.test(label.textContent || ""),
        )
      : null;
    zoneA?.click();
  });
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    const visible = (btn) => btn.offsetParent !== null;
    const clickFirst = (prefix) => {
      const btn = [...document.querySelectorAll("button")].find(
        (item) =>
          visible(item) && item.getAttribute("aria-label")?.startsWith(prefix),
      );
      btn?.click();
    };
    clickFirst("Развернуть:");
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (item) =>
        item.offsetParent !== null &&
        item.getAttribute("aria-label")?.startsWith("Развернуть: Тип билета"),
    );
    btn?.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (item) =>
        item.offsetParent !== null &&
        item.getAttribute("aria-label")?.startsWith("Развернуть: Источник"),
    );
    btn?.click();
  });
  await page.waitForTimeout(500);

  const filteredPath = path.join(__dirname, "tickets-sales-filter-match-zone.png");
  await page.screenshot({ path: filteredPath });

  const flags = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasBanner: text.includes("Показатели рассчитаны по применённым фильтрам"),
      hasZone: text.includes("Ценовая зона ·"),
      hasTicketType: text.includes("Тип билета ·"),
      hasSource: text.includes("Источник ·"),
    };
  });

  console.log(JSON.stringify({ expandedPath, filteredPath, ...flags }, null, 2));
  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

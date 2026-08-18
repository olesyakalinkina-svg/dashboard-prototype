import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "tmp", "layout-audit", "after");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 900 },
];

const TABS = [
  { name: "tickets", label: "Билеты" },
  { name: "matches", label: "Матчи" },
];

async function waitForReady(page) {
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const pageOverflowX = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;

    const headings = [...document.querySelectorAll("h3")].map((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        text: (el.textContent || "").trim().slice(0, 80),
        truncated: style.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });

    const charts = [...document.querySelectorAll(".recharts-responsive-container, .recharts-wrapper")].map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        className: el.className,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });

    const smallTargets = [...document.querySelectorAll("button, a, select, input")].filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return rect.height < 44 || rect.width < 44;
    }).slice(0, 25).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      };
    });

    const zoneTitle = [...document.querySelectorAll("h3")].find((el) =>
      (el.textContent || "").includes("ценовым зонам"),
    );
    let zoneLayout = null;
    if (zoneTitle) {
      const card = zoneTitle.closest("[class*='rounded-lg']") || zoneTitle.parentElement;
      const grid = card?.parentElement;
      const gridStyle = grid ? getComputedStyle(grid) : null;
      const cardRect = card?.getBoundingClientRect();
      zoneLayout = {
        cardWidth: cardRect ? Math.round(cardRect.width) : null,
        viewport: window.innerWidth,
        gridCols: gridStyle?.gridTemplateColumns,
        gridClass: grid?.className || null,
        ratio: cardRect ? cardRect.width / window.innerWidth : null,
      };
    }

    const tables = [...document.querySelectorAll("table")].map((table) => {
      const rect = table.getBoundingClientRect();
      const wrapper = table.parentElement;
      const wrapRect = wrapper?.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        wrapWidth: wrapRect ? Math.round(wrapRect.width) : null,
        overflowX: wrapper ? getComputedStyle(wrapper).overflowX : null,
        cols: table.querySelectorAll("thead th").length,
        caption: (table.closest("[class*='rounded-lg']")?.querySelector("h3")?.textContent || "").trim().slice(0, 60),
      };
    });

    const kpiGrid = document.querySelector("main > div.grid");
    let kpi = null;
    if (kpiGrid) {
      const style = getComputedStyle(kpiGrid);
      const cards = [...kpiGrid.children].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          title: (el.querySelector("p")?.textContent || "").trim().slice(0, 50),
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      });
      kpi = {
        cols: style.gridTemplateColumns,
        cardCount: kpiGrid.children.length,
        cards,
      };
    }

    const stickyFilters = document.querySelector("[class*='sticky']");
    let filterBar = null;
    if (stickyFilters) {
      const r = stickyFilters.getBoundingClientRect();
      filterBar = {
        height: Math.round(r.height),
        width: Math.round(r.width),
        text: (stickyFilters.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        children: stickyFilters.querySelectorAll("select, button").length,
      };
    }

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      pageOverflowX,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      headings,
      charts,
      smallTargets,
      zoneLayout,
      tables,
      kpi,
      filterBar,
    };
  });
}

async function screenshotFull(page, path) {
  await page.screenshot({ path, fullPage: true });
}

const report = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitForReady(page);

  for (const tab of TABS) {
    const tabBtn = page.getByRole("button", { name: tab.label, exact: true });
    await tabBtn.click();
    await waitForReady(page);

    const shot = join(OUT, `${tab.name}-${vp.name}.png`);
    await screenshotFull(page, shot);
    const metrics = await measure(page);

    let dropdown = null;
    if (tab.name === "tickets" && (vp.name === "768" || vp.name === "1024")) {
      const sector = page.getByRole("button", { name: "Все секторы" }).first();
      if (await sector.count()) {
        await sector.scrollIntoViewIfNeeded();
        await sector.click();
        await page.waitForTimeout(400);
        dropdown = await page.evaluate(() => {
          const menu = document.querySelector('[data-testid="multi-select-menu"]');
          if (!menu) return { open: false };
          const menuRect = menu.getBoundingClientRect();
          const table = document.querySelector("table");
          const tableRect = table?.getBoundingClientRect();
          const covered = tableRect
            ? menuRect.bottom > tableRect.top && menuRect.top < tableRect.bottom
            : false;
          const style = getComputedStyle(menu);
          return {
            open: true,
            z: style.zIndex,
            top: Math.round(menuRect.top),
            bottom: Math.round(menuRect.bottom),
            height: Math.round(menuRect.height),
            tableTop: tableRect ? Math.round(tableRect.top) : null,
            overlapsTable: covered,
            visible: menuRect.height > 0 && style.visibility !== "hidden",
          };
        });
        const dropShot = join(OUT, `${tab.name}-${vp.name}-sector-dropdown.png`);
        await page.screenshot({ path: dropShot, fullPage: false });
        await page.keyboard.press("Escape");
        await page.mouse.click(10, 10);
      }
    }

    report.push({
      tab: tab.name,
      viewport: vp.name,
      screenshot: shot,
      metrics,
      dropdown,
    });
    console.log(
      JSON.stringify(
        {
          tab: tab.name,
          vp: vp.name,
          overflowX: metrics.pageOverflowX,
          zone: metrics.zoneLayout,
          charts: metrics.charts.map((c) => `${c.width}x${c.height}`),
          tables: metrics.tables.map((t) => `${t.caption}:${t.width}/${t.wrapWidth}`),
          kpiCols: metrics.kpi?.cols,
          small: metrics.smallTargets.length,
          dropdown,
        },
        null,
        0,
      ),
    );
  }
}

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log("Wrote", join(OUT, "report.json"));

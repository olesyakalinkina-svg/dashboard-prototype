import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "tmp", "responsive-audit");
mkdirSync(OUT, { recursive: true });

const TABS = [
  { id: "tickets", label: "Билеты" },
  { id: "merch", label: "Мерч" },
  { id: "subscriptions", label: "Абонементы" },
  { id: "matches", label: "Матчи" },
];

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
];

const FILTER_VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "1024x768", width: 1024, height: 768 },
];

async function waitForReady(page) {
  await page
    .waitForLoadState("networkidle", { timeout: 60_000 })
    .catch(() => {});
  await page.waitForSelector("main", { timeout: 60_000 });
  await page
    .waitForFunction(
      () =>
        document.querySelector("[data-testid='mobile-sales-cards']") ||
        document.querySelector("[data-testid='desktop-sales-table']") ||
        document.querySelector("[data-testid='tickets-sales-table']") ||
        document.querySelector("main .rounded-lg.border h3"),
      { timeout: 60_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(800);
}

async function openTab(page, label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(600);
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const pageOverflowX =
      Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      pageOverflowX,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      hasMobileSalesCards: !!document.querySelector(
        "[data-testid='mobile-sales-cards']",
      ),
      hasDesktopSalesTable: !!document.querySelector(
        "[data-testid='desktop-sales-table']",
      ),
      hasMerchMobileCards: !!document.querySelector(
        "[data-testid='merch-mobile-sales-cards']",
      ),
      hasCombinedMobileCards: !!document.querySelector(
        "[data-testid='combined-mobile-sales-cards']",
      ),
      hasFilterTrigger: !!document.querySelector(
        "[data-testid='filter-trigger']",
      ),
      hasFilterDesktopBar: !!document.querySelector(
        "[data-testid='filter-desktop-bar']",
      ),
      hasStickyTable: !!document.querySelector(
        "[data-testid='sticky-scroll-table']",
      ),
      h3FontSize: (() => {
        const h3 = document.querySelector("h3");
        return h3 ? Number.parseFloat(getComputedStyle(h3).fontSize) : null;
      })(),
    };
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  screenshots: [],
  overflow: {},
  checks: {},
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto("http://localhost:3000/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await waitForReady(page);

  for (const tab of TABS) {
    await openTab(page, tab.label);
    const shot = join(OUT, `${tab.id}-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const metrics = await measure(page);
    report.screenshots.push(shot);
    report.overflow[`${tab.id}-${vp.name}`] = {
      ok: metrics.pageOverflowX <= 1,
      pageOverflowX: metrics.pageOverflowX,
      scrollWidth: metrics.scrollWidth,
      innerWidth: metrics.viewport.w,
    };
    console.log(
      JSON.stringify({
        tab: tab.id,
        vp: vp.name,
        overflowX: metrics.pageOverflowX,
        h3: metrics.h3FontSize,
        mobileCards: metrics.hasMobileSalesCards,
        desktopTable: metrics.hasDesktopSalesTable,
      }),
    );
  }
}

for (const vp of FILTER_VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto("http://localhost:3000/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await waitForReady(page);

  for (const tab of TABS) {
    await openTab(page, tab.label);
    const trigger = page.getByTestId("filter-trigger");
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(350);
    }
    const shot = join(OUT, `${tab.id}-${vp.name}-filters.png`);
    await page.screenshot({ path: shot, fullPage: true });
    report.screenshots.push(shot);
    await page.keyboard.press("Escape").catch(() => {});
    await page.mouse.click(10, 10).catch(() => {});
  }
}

for (const spec of [
  {
    tab: "tickets",
    label: "Билеты",
    vp: { name: "390x844", width: 390, height: 844 },
    file: "tickets-390x844-expanded.png",
  },
  {
    tab: "merch",
    label: "Мерч",
    vp: { name: "390x844", width: 390, height: 844 },
    file: "merch-390x844-expanded.png",
  },
  {
    tab: "tickets",
    label: "Билеты",
    vp: { name: "768x1024", width: 768, height: 1024 },
    file: "tickets-768x1024-expanded.png",
  },
]) {
  await page.setViewportSize({
    width: spec.vp.width,
    height: spec.vp.height,
  });
  await page.goto("http://localhost:3000/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await waitForReady(page);
  await openTab(page, spec.label);
  const expand = page.getByRole("button", { name: /^Развернуть:/ }).first();
  if (await expand.count()) {
    await expand.click();
    await page.waitForTimeout(350);
  }
  const shot = join(OUT, spec.file);
  await page.screenshot({ path: shot, fullPage: true });
  report.screenshots.push(shot);
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:3000/", {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await waitForReady(page);
report.checks.filterBottomSheet = await page.evaluate(async () => {
  const trigger = document.querySelector("[data-testid='filter-trigger']");
  if (!(trigger instanceof HTMLElement)) return { ok: false, reason: "no trigger" };
  trigger.click();
  await new Promise((r) => setTimeout(r, 300));
  const sheet = document.querySelector("[data-testid='filter-bottom-sheet']");
  const desktop = document.querySelector("[data-testid='filter-desktop-bar']");
  return {
    ok: !!sheet && !desktop,
    hasSheet: !!sheet,
    hasDesktop: !!desktop,
  };
});
await page.keyboard.press("Escape").catch(() => {});

await page.setViewportSize({ width: 1024, height: 768 });
await waitForReady(page);
report.checks.filterSidePanel = await page.evaluate(async () => {
  const trigger = document.querySelector("[data-testid='filter-trigger']");
  if (!(trigger instanceof HTMLElement)) return { ok: false, reason: "no trigger" };
  trigger.click();
  await new Promise((r) => setTimeout(r, 300));
  const panel = document.querySelector("[data-testid='filter-side-panel']");
  const desktop = document.querySelector("[data-testid='filter-desktop-bar']");
  return {
    ok: !!panel && !desktop,
    hasPanel: !!panel,
    hasDesktop: !!desktop,
  };
});
await page.keyboard.press("Escape").catch(() => {});

await page.setViewportSize({ width: 1440, height: 900 });
await waitForReady(page);
report.checks.filterDesktopBar = await page.evaluate(() => {
  const desktop = document.querySelector("[data-testid='filter-desktop-bar']");
  const trigger = document.querySelector("[data-testid='filter-trigger']");
  return {
    ok: !!desktop && !trigger,
    hasDesktop: !!desktop,
    hasTrigger: !!trigger,
  };
});

report.checks.singleDomMobile = await page.evaluate(() => {
  const mobile = document.querySelector("[data-testid='mobile-sales-cards']");
  const desktop = document.querySelector("[data-testid='desktop-sales-table']");
  return {
    ok: !mobile && !desktop,
    note: "desktop viewport before resize",
  };
});

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:3000/", {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await waitForReady(page);
report.checks.singleDomMobilePhone = await page.evaluate(() => ({
  mobile: !!document.querySelector("[data-testid='mobile-sales-cards']"),
  desktop: !!document.querySelector("[data-testid='desktop-sales-table']"),
  ok:
    !!document.querySelector("[data-testid='mobile-sales-cards']") &&
    !document.querySelector("[data-testid='desktop-sales-table']"),
}));

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log("Wrote", join(OUT, "report.json"));
const failures = Object.entries(report.overflow).filter(([, v]) => !v.ok);
if (failures.length) {
  console.error("Overflow failures:", failures);
  process.exitCode = 1;
}

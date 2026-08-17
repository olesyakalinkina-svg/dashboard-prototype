import { chromium } from "playwright";

const URL = "http://localhost:3000/?probe=" + Date.now();

function stamp() {
  return new Date().toISOString().slice(11, 23);
}

async function waitForTicketsReady(page) {
  await page.waitForSelector("text=Загрузка данных…", {
    state: "detached",
    timeout: 180000,
  });
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll("p")];
    const kpi = nodes.find((el) => el.textContent?.trim() === "Проданные билеты");
    if (!kpi) return false;
    const value = kpi.parentElement?.querySelector(".font-semibold")?.textContent ?? "";
    const n = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0;
  }, null, { timeout: 180000 });
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll("table tbody tr, [role='row']");
    return rows.length > 1;
  }, null, { timeout: 60000 }).catch(() => {});
}

async function ping(page, samples = 3) {
  return page.evaluate(async (n) => {
    const times = [];
    for (let i = 0; i < n; i += 1) {
      const start = performance.now();
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      times.push(Math.round(performance.now() - start));
    }
    return times;
  }, samples);
}

async function openNative(page, label) {
  const before = Date.now();
  const result = await page.evaluate((lab) => {
    const t0 = performance.now();
    const labels = [...document.querySelectorAll("label")];
    const wrap = labels.find(
      (el) => el.querySelector("select") && el.textContent?.includes(lab),
    );
    const select = wrap?.querySelector("select");
    if (!select) return { ok: false, error: "not found" };
    select.focus();
    const options = [...select.options].map((o) => (o.textContent ?? "").trim());
    return {
      ok: true,
      clickMs: Math.round(performance.now() - t0),
      optionCount: options.length,
      options,
    };
  }, label);
  const pingWhileOpen = await ping(page, 4);
  return {
    label,
    wallMs: Date.now() - before,
    ...result,
    pingWhileOpen,
    maxPing: Math.max(...pingWhileOpen),
  };
}

async function playwrightClickNative(page, label) {
  const select = page
    .locator("label")
    .filter({ hasText: label })
    .locator("select")
    .first();
  const t0 = Date.now();
  await select.click({ timeout: 5000 });
  const clickMs = Date.now() - t0;
  await page.keyboard.press("Escape").catch(() => {});
  const pingAfter = await ping(page, 3);
  return { label, playwrightClickMs: clickMs, pingAfter, maxPing: Math.max(...pingAfter) };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on("dialog", async (dialog) => {
  console.log(`${stamp()} DIALOG ${dialog.type()} ${dialog.message()}`);
  await dialog.dismiss().catch(() => {});
});
page.on("console", (msg) => {
  const text = msg.text();
  if (/tickets|compute|filter/i.test(text) || msg.type() === "error") {
    console.log(`${stamp()} CONSOLE [${msg.type()}] ${text}`);
  }
});

await page.addInitScript(() => {
  window.__longTasks = [];
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__longTasks.push({
          duration: Math.round(entry.duration),
          start: Math.round(entry.startTime),
        });
      }
    });
    po.observe({ type: "longtask", buffered: true });
  } catch {
    /* ignore */
  }
});

const navStart = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
await waitForTicketsReady(page);
console.log(`${stamp()} READY in ${Date.now() - navStart}ms`);
console.log(`${stamp()} ping at ready`, JSON.stringify(await ping(page, 4)));

const matchStart = Date.now();
const matchClickMode = "evaluate";
await Promise.race([
  page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const label = spans.find((s) => s.textContent === "Матч");
    const button = label?.parentElement?.querySelector("button");
    if (!button) throw new Error("Матч button not found");
    button.click();
  }),
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error("evaluate click timeout 4000ms")), 4000);
  }),
]);
await page.locator("div.absolute").locator("text=Все матчи").first().waitFor({
  state: "visible",
  timeout: 5000,
});
const matchOpenMs = Date.now() - matchStart;
const pingOpen = await ping(page, 6);
const optionCount = await page.locator("div.absolute label").count();
console.log(
  `${stamp()} MultiSelect Матч OPEN ${matchOpenMs}ms options=${optionCount} pingWhileOpen=${JSON.stringify(pingOpen)}`,
);
await page.evaluate(() => {
  document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
});

const jsOpens = [];
for (const label of ["Лига", "Сезон", "Тип билета", "Источник заказа", "Ценовая зона"]) {
  const row = await openNative(page, label);
  jsOpens.push(row);
  console.log(`${stamp()} JS open`, JSON.stringify(row));
}

await page.keyboard.press("Escape").catch(() => {});

const pwClicks = [];
for (const label of ["Сезон", "Лига", "Тип билета", "Источник заказа", "Ценовая зона"]) {
  const row = await playwrightClickNative(page, label);
  pwClicks.push(row);
  console.log(`${stamp()} PW click`, JSON.stringify(row));
}

const changeStart = Date.now();
await page
  .locator("label")
  .filter({ hasText: "Лига" })
  .locator("select")
  .first()
  .selectOption("VHL", { timeout: 8000 });
const changeMs = Date.now() - changeStart;
const pingAfterChange = await ping(page, 5);
console.log(
  `${stamp()} selectOption Лига=VHL ${changeMs}ms ping=${JSON.stringify(pingAfterChange)}`,
);

const afterChange = await playwrightClickNative(page, "Сезон");
console.log(`${stamp()} PW click Сезон after change`, JSON.stringify(afterChange));

const longTasks = await page.evaluate(() => window.__longTasks);
const longAfterReady = longTasks.filter((t) => t.start > 2000);
console.log(
  JSON.stringify(
    {
      pwClicks,
      jsOpens,
      matchOpenMs,
      matchPing: pingOpen,
      changeMs,
      pingAfterChange,
      afterChange,
      longTasksOver300: longTasks.filter((t) => t.duration >= 300),
      longAfterReadyOver300: longAfterReady.filter((t) => t.duration >= 300),
    },
    null,
    2,
  ),
);

const failJs = jsOpens.filter((r) => r.clickMs >= 300);
const failMatch = matchOpenMs >= 300;
const failPing = Math.max(...pingOpen) >= 250;
if (failJs.length || failMatch || failPing) {
  console.error("FAIL", { failJs, matchOpenMs, pingOpen });
  process.exitCode = 1;
} else {
  console.log("PASS Матч options in <300ms while open; 5 native filters options <300ms");
}

await browser.close();

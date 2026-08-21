import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join("tmp", "season-match-end-dots");

test("idle plan end dots on the match-dynamics chart do not overlap", async ({
  page,
}) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const title = page.getByRole("heading", {
    name: "Динамика продаж билетов по матчам",
  });
  await expect(title).toBeVisible({ timeout: 60_000 });

  const card = title.locator("xpath=ancestor::div[contains(@class,'rounded')]");
  const scroller = card.locator("div").filter({
    has: page.locator(".recharts-responsive-container"),
  }).first();
  await scroller.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });

  const plot = card.locator(".recharts-responsive-container");
  await expect(plot).toBeVisible();
  await plot.screenshot({
    path: path.join(OUT_DIR, "idle-end-dots.png"),
  });

  const dots = page.getByTestId("season-match-end-dot");
  await expect(dots.first()).toBeVisible();
  const count = await dots.count();
  expect(count).toBeGreaterThanOrEqual(2);

  const placed = await dots.evaluateAll((nodes) =>
    nodes.map((node) => ({
      cx: Number(node.getAttribute("data-cx")),
      cy: Number(node.getAttribute("data-cy")),
    })),
  );

  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const left = placed[i]!;
      const right = placed[j]!;
      const dx = Math.abs(left.cx - right.cx);
      const dy = Math.abs(left.cy - right.cy);
      if (dx < 24) {
        expect(
          dy,
          `end dots ${i} and ${j} share x (${dx}px) but overlap in y (${dy}px)`,
        ).toBeGreaterThanOrEqual(24);
      }
    }
  }
});

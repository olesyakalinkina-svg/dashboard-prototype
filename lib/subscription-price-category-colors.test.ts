import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSubscriptionPriceCategoryColor,
  SUBSCRIPTION_PRICE_CATEGORY_COLORS,
} from "@/lib/subscription-price-category-colors";

describe("subscription price category colors", () => {
  it("gives each product a distinct dashboard color", () => {
    const colors = [
      SUBSCRIPTION_PRICE_CATEGORY_COLORS.all_inclusive,
      SUBSCRIPTION_PRICE_CATEGORY_COLORS.weekend,
      SUBSCRIPTION_PRICE_CATEGORY_COLORS.seasonal,
    ];

    expect(colors).toEqual(["#5282FF", "#00BFA5", "#FF7043"]);
    expect(new Set(colors).size).toBe(3);
    expect(colors.every((color) => color === "#5282FF")).toBe(false);
    expect(getSubscriptionPriceCategoryColor("all_inclusive")).toBe("#5282FF");
    expect(getSubscriptionPriceCategoryColor("weekend")).toBe("#00BFA5");
    expect(getSubscriptionPriceCategoryColor("seasonal")).toBe("#FF7043");
  });

  it("is used by both share and renewal product charts", () => {
    const shareChart = readFileSync(
      join(process.cwd(), "components/widgets/Charts.tsx"),
      "utf8",
    );
    const renewalChart = readFileSync(
      join(
        process.cwd(),
        "components/widgets/subscription-renewal/RenewalProductChart.tsx",
      ),
      "utf8",
    );

    expect(shareChart).toContain("getSubscriptionPriceCategoryColor");
    expect(shareChart).toContain("@/lib/subscription-price-category-colors");
    expect(shareChart).toContain("<Cell");
    expect(renewalChart).toContain("getSubscriptionPriceCategoryColor");
    expect(renewalChart).toContain("@/lib/subscription-price-category-colors");
    expect(renewalChart).toContain("<Cell");
    expect(renewalChart).not.toContain('fill="#5282FF"');
  });
});

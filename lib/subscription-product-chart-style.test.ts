import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_PRODUCT_CHART_TEXT } from "@/lib/subscription-product-chart-style";

describe("subscription product chart text style", () => {
  it("uses 14px regular inherited font in near-black", () => {
    expect(SUBSCRIPTION_PRODUCT_CHART_TEXT).toEqual({
      fontSize: 14,
      fontWeight: 400,
      fontFamily: "inherit",
      fill: "#1A1A1A",
    });
  });

  it("is used by both share and renewal product charts for ticks and value labels", () => {
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

    for (const source of [shareChart, renewalChart]) {
      expect(source).toContain("SUBSCRIPTION_PRODUCT_CHART_TEXT");
      expect(source).toContain("@/lib/subscription-product-chart-style");
      expect(source).toContain("tick={SUBSCRIPTION_PRODUCT_CHART_TEXT}");
      expect(source).toContain("style={SUBSCRIPTION_PRODUCT_CHART_TEXT}");
    }

    expect(renewalChart).not.toContain("fontSize: 12");
  });
});

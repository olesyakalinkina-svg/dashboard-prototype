import { describe, expect, it } from "vitest";
import {
  formatCampaignDayTitle,
  formatCampaignMoneyAxis,
  formatGapCell,
  formatPercentageGap,
} from "@/lib/subscription-campaign/format";

describe("campaign formatters", () => {
  it("formats campaign day titles in Russian", () => {
    expect(formatCampaignDayTitle(1)).toBe("1-й день кампании");
    expect(formatCampaignDayTitle(15)).toBe("15-й день кампании");
  });

  it("abbreviates money on the axis without trailing zeros", () => {
    expect(formatCampaignMoneyAxis(5_000_000)).toBe("5 млн ₽");
    expect(formatCampaignMoneyAxis(42_800_000)).toBe("42,8 млн ₽");
  });

  it("keeps a sign in the gap text and labels a missing base", () => {
    expect(formatGapCell(170, 7.4)).toEqual({
      text: "+170 (+7,4%)",
      tone: "positive",
    });
    expect(formatGapCell(-40, -2.1)).toEqual({
      text: "-40 (-2,1%)",
      tone: "negative",
    });
    expect(formatGapCell(0, 0)).toEqual({ text: "0", tone: "neutral" });
    expect(formatGapCell(170, null)).toEqual({
      text: "+170 (Нет базы для сравнения)",
      tone: "positive",
    });
    expect(formatPercentageGap(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { formatCurrencyCompact } from "@/lib/format";

describe("formatCurrencyCompact", () => {
  it("formats thousands with a Russian suffix", () => {
    expect(formatCurrencyCompact(125_000)).toBe("125 тыс. ₽");
  });

  it("formats millions with a decimal comma", () => {
    expect(formatCurrencyCompact(1_200_000)).toBe("1,2 млн ₽");
  });
});

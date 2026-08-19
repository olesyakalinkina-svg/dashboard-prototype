import { describe, expect, it } from "vitest";
import { formatCurrencyCompact, formatTicketEventTitle } from "@/lib/format";

describe("formatCurrencyCompact", () => {
  it("formats thousands with a Russian suffix", () => {
    expect(formatCurrencyCompact(125_000)).toBe("125 тыс. ₽");
  });

  it("formats millions with a decimal comma", () => {
    expect(formatCurrencyCompact(1_200_000)).toBe("1,2 млн ₽");
  });
});

describe("formatTicketEventTitle", () => {
  it("returns the opponent without concatenating the match date", () => {
    expect(
      formatTicketEventTitle({ opponent: "Динамо Мск" }),
    ).toBe("Динамо Мск");
    expect(formatTicketEventTitle({ opponent: "Динамо Мск" })).not.toMatch(
      /\d{2}-\d{2}-\d{2}/,
    );
  });
});

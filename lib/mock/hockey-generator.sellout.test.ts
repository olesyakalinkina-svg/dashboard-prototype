import { describe, expect, it } from "vitest";
import { generateMockData } from "@/lib/mock/hockey-generator";
import { isSoldOutOccupancyMatch } from "@/lib/ticket-plan";
import { getTicketIssuedQuantity } from "@/lib/ticket-sales-metrics";
import type { Match, Transaction } from "@/types/dashboard";

function arenaIssuedForMatch(match: Match, transactions: Transaction[]): number {
  let issued = 0;
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (tx.matchId !== match.id) continue;
    issued += getTicketIssuedQuantity(tx);
  }
  return issued;
}

describe("hockey generator sold-out occupancy", () => {
  it("issues a full bowl for class_1 and playoff, not for lower regular classes", () => {
    const { matches, transactions } = generateMockData();
    const soldOut = matches.filter((match) => isSoldOutOccupancyMatch(match));
    const partial = matches.filter(
      (match) =>
        match.eventCompleted &&
        (match.matchClass === "class_2" || match.matchClass === "class_3"),
    );
    expect(soldOut.length).toBeGreaterThan(0);
    expect(partial.length).toBeGreaterThan(0);

    for (const match of soldOut) {
      expect(arenaIssuedForMatch(match, transactions)).toBe(match.capacity);
    }

    const samplePartial = partial[0]!;
    expect(arenaIssuedForMatch(samplePartial, transactions)).toBeLessThan(
      samplePartial.capacity,
    );
  });
});

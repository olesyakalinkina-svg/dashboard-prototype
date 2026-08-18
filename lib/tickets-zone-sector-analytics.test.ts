import { describe, expect, it } from "vitest";
import {
  buildAvailabilityIndex,
  buildMatrixRows,
  computeOccupancy,
  preAggregateZoneSector,
} from "@/lib/tickets-zone-sector-analytics";
import type { Match, Transaction } from "@/types/dashboard";

const MATCHES: Match[] = [
  {
    id: "m1",
    date: new Date(2026, 4, 10),
    opponent: "СКА",
    attendance: 1000,
    capacity: 12000,
    season: "2025/26",
    league: "KHL",
    tournamentStage: "regular",
    matchClass: "class_1",
    arena: "main",
    eventCompleted: true,
    ticketSalesWindowDays: 14,
  },
];

const TXS: Transaction[] = [
  {
    id: "t1",
    date: new Date(2026, 4, 5),
    stream: "tickets",
    description: "A",
    matchId: "m1",
    channel: "online",
    amount: 3000,
    quantity: 2,
    ticketType: "arena",
    sector: "A",
    priceZone: "from_1500_to_2500",
    orderSource: "official_site",
  },
  {
    id: "t2",
    date: new Date(2026, 4, 6),
    stream: "tickets",
    description: "B1",
    matchId: "m1",
    channel: "online",
    amount: 8000,
    quantity: 2,
    ticketType: "arena",
    sector: "B1",
    priceZone: "from_2500_to_4000",
    orderSource: "official_site",
  },
  {
    id: "t3",
    date: new Date(2026, 4, 7),
    stream: "tickets",
    description: "VIP",
    matchId: "m1",
    channel: "online",
    amount: 5000,
    quantity: 1,
    ticketType: "arena",
    sector: "VIP",
    priceZone: "from_4000_to_6000",
    orderSource: "official_site",
  },
  {
    id: "t4",
    date: new Date(2026, 4, 8),
    stream: "tickets",
    description: "free",
    matchId: "m1",
    channel: "online",
    amount: 0,
    quantity: 1,
    freeQuantity: 1,
    ticketType: "arena",
    sector: "A",
    priceZone: "from_1500_to_2500",
    orderSource: "official_site",
  },
];

describe("tickets-zone-sector analytics", () => {
  it("aggregates match×sector×zone and computes averages", () => {
    const map = preAggregateZoneSector(TXS, new Map(MATCHES.map((m) => [m.id, m])), "current");
    expect(map.get("m1|A|from_1500_to_2500")).toMatchObject({
      revenue: 3000,
      sold: 2,
      free: 1,
      issued: 3,
    });
    expect(map.get("m1|VIP|from_4000_to_6000")?.revenue).toBe(5000);
  });

  it("builds matrix and preserves totals invariants", () => {
    const rows = buildMatrixRows({
      transactions: TXS,
      matchesById: new Map(MATCHES.map((m) => [m.id, m])),
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      slice: "current",
    });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    const sumZones = Object.values(row.zones).reduce((sum, z) => sum + z.revenue, 0);
    expect(sumZones).toBe(row.totals.revenue);
    expect(row.totals.sold).toBe(5);
    expect(row.totals.avgPrice).toBe(3200);
  });

  it("computes three occupancy formulas and em dash conditions", () => {
    const availability = {
      zoneInMatch: new Map([["m1|from_1500_to_2500", 10]]),
      sectorInMatch: new Map([["m1|A", 6]]),
      zoneInSector: new Map([["m1|A|from_1500_to_2500", 4]]),
    };
    const aOcc = computeOccupancy("m1", "A", "from_1500_to_2500", 3, availability);
    expect(aOcc.zoneInMatch).toBe(30);
    expect(aOcc.sectorInMatch).toBe(50);
    expect(aOcc.zoneInSector).toBe(75);
    const miss = computeOccupancy("m1", "D4", "up_to_1500", 1, availability);
    expect(miss.zoneInMatch).toBeNull();
    expect(miss.sectorInMatch).toBeNull();
    expect(miss.zoneInSector).toBeNull();
  });

  it("keeps VIP only in top zone in fixture", () => {
    const rows = buildMatrixRows({
      transactions: TXS,
      matchesById: new Map(MATCHES.map((m) => [m.id, m])),
      localMatchIds: [],
      localPriceZones: [],
      localSectors: ["VIP"],
      slice: "current",
    });
    expect(rows[0]!.zones.from_4000_to_6000.sold).toBe(1);
    expect(rows[0]!.zones.up_to_1500.sold).toBe(0);
  });

  it("handles large dataset in acceptable time", () => {
    const many: Transaction[] = [];
    for (let i = 0; i < 20000; i += 1) {
      many.push({
        ...TXS[i % TXS.length]!,
        id: `bulk-${i}`,
        matchId: "m1",
      });
    }
    const started = Date.now();
    const rows = buildMatrixRows({
      transactions: many,
      matchesById: new Map(MATCHES.map((m) => [m.id, m])),
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      slice: "current",
    });
    const elapsed = Date.now() - started;
    expect(rows.length).toBe(1);
    expect(elapsed).toBeLessThan(1200);
  });
});

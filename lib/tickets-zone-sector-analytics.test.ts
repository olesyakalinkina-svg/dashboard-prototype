import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ALL_SECTORS,
  NON_VIP_PRICE_ZONES,
  NON_VIP_SECTORS,
  allowedPriceZonesForSector,
  allowedSectorsForPriceZone,
  hasAllowedFilterIntersection,
  isAllowedSectorPriceZone,
  visiblePriceZonesForFilters,
  visibleSectorsForFilters,
} from "@/lib/ticket-filter-options";
import {
  MAIN_ARENA_SECTOR_CAPACITY,
  getComboAvailableMass,
  getSectorCapacitiesForMatch,
  leftoverSectorCapacity,
  splitSectorCapacity,
  sumSectorCapacities,
} from "@/lib/arena-sector-inventory";
import {
  buildAvailabilityIndex,
  buildMatrixRows,
  buildZoneSectorMatchTree,
  buildZoneSectorTree,
  collectInvalidSectorPriceZoneRecords,
  comboKey,
  computeOccupancy,
  effectiveSliceForMatch,
  flattenZoneSectorTree,
  hydrateZoneSectorTree,
  inferChildSectorsForZone,
  inferChildZonesForSector,
  occupancyPercent,
  preAggregateZoneSector,
  resolveAllowedCell,
  sumMatchBySectors,
  sumMatchByZones,
} from "@/lib/tickets-zone-sector-analytics";
import type { Match, PriceZone, Sector, Transaction } from "@/types/dashboard";
import { isSoldOutOccupancyMatch } from "@/lib/ticket-plan";

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
    matchClass: "class_2",
    arena: "main",
    eventCompleted: true,
    ticketSalesWindowDays: 14,
  },
];

function tx(
  id: string,
  sector: Sector,
  priceZone: PriceZone,
  amount: number,
  quantity: number,
  extras: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    date: new Date(2026, 4, 5),
    stream: "tickets",
    description: sector,
    matchId: "m1",
    channel: "online",
    amount,
    quantity,
    ticketType: "arena",
    sector,
    priceZone,
    orderSource: "official_site",
    ...extras,
  };
}

function fillMatchInventory(match: Match): Transaction[] {
  const sectors = getSectorCapacitiesForMatch(match);
  if (!sectors) return [];
  const txs: Transaction[] = [];
  let n = 0;
  for (const sector of ALL_SECTORS) {
    const split = splitSectorCapacity(sector, sectors[sector]);
    for (const zone of allowedPriceZonesForSector(sector)) {
      const mass = split[zone] ?? 0;
      if (!(mass > 0)) continue;
      txs.push(
        tx(`fill-${match.id}-${n++}`, sector, zone, mass * 2000, mass, {
          matchId: match.id,
        }),
      );
    }
  }
  return txs;
}

const TXS: Transaction[] = [
  tx("t1", "A", "from_1500_to_2500", 3000, 2),
  tx("t2", "B1", "from_2500_to_4000", 8000, 2),
  tx("t3", "VIP", "from_4000_to_6000", 5000, 1),
  tx("t4", "A", "from_1500_to_2500", 0, 1, { freeQuantity: 1, description: "free" }),
  tx("t5", "A", "up_to_1500", 1200, 1),
  tx("t6", "A", "from_2500_to_4000", 3200, 1),
  tx("t7", "C2", "up_to_1500", 900, 1),
  tx("t8", "D4", "from_1500_to_2500", 2000, 1),
];

const matchesById = new Map(MATCHES.map((m) => [m.id, m]));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sector × priceZone matrix membership", () => {
  it("1. each ordinary sector contains the three zones below 4000", () => {
    for (const sector of NON_VIP_SECTORS) {
      expect(allowedPriceZonesForSector(sector)).toEqual(NON_VIP_PRICE_ZONES);
      expect(inferChildZonesForSector("m1", sector)).toEqual(NON_VIP_PRICE_ZONES);
    }
  });

  it("2. ordinary sectors never include 4000–6000", () => {
    for (const sector of NON_VIP_SECTORS) {
      expect(allowedPriceZonesForSector(sector)).not.toContain("from_4000_to_6000");
      expect(isAllowedSectorPriceZone(sector, "from_4000_to_6000")).toBe(false);
    }
  });

  it("3. VIP contains only 4000–6000", () => {
    expect(allowedPriceZonesForSector("VIP")).toEqual(["from_4000_to_6000"]);
    expect(inferChildZonesForSector("m1", "VIP")).toEqual(["from_4000_to_6000"]);
  });

  it("4. VIP does not contain the three lower zones", () => {
    for (const zone of NON_VIP_PRICE_ZONES) {
      expect(isAllowedSectorPriceZone("VIP", zone)).toBe(false);
    }
    expect(inferChildZonesForSector("m1", "VIP")).not.toEqual(
      expect.arrayContaining(NON_VIP_PRICE_ZONES),
    );
  });

  it("5. zone 4000–6000 expands only to VIP", () => {
    expect(allowedSectorsForPriceZone("from_4000_to_6000")).toEqual(["VIP"]);
    expect(inferChildSectorsForZone("m1", "from_4000_to_6000")).toEqual(["VIP"]);
  });

  it("6. lower zones expand to ordinary sectors without VIP", () => {
    for (const zone of NON_VIP_PRICE_ZONES) {
      const sectors = inferChildSectorsForZone("m1", zone);
      expect(sectors).toEqual(NON_VIP_SECTORS);
      expect(sectors).not.toContain("VIP");
      expect(visibleSectorsForFilters([zone], [])).toEqual(NON_VIP_SECTORS);
    }
  });
});

describe("filters against the allowed matrix", () => {
  it("7. filter 4000–6000 leaves only VIP", () => {
    expect(visibleSectorsForFilters(["from_4000_to_6000"], [])).toEqual(["VIP"]);
    expect(visiblePriceZonesForFilters(["from_4000_to_6000"], [])).toEqual([
      "from_4000_to_6000",
    ]);
    const rows = buildMatrixRows({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: ["from_4000_to_6000"],
      localSectors: [],
    });
    expect(rows[0]!.zones.from_4000_to_6000.sold).toBe(1);
    expect(rows[0]!.totals.sold).toBe(1);
    expect(rows[0]!.totals.revenue).toBe(5000);
  });

  it("8. filter VIP leaves only 4000–6000", () => {
    expect(visiblePriceZonesForFilters([], ["VIP"])).toEqual(["from_4000_to_6000"]);
    expect(visibleSectorsForFilters([], ["VIP"])).toEqual(["VIP"]);
    expect(inferChildZonesForSector("m1", "VIP", undefined, [])).toEqual([
      "from_4000_to_6000",
    ]);
    const rows = buildMatrixRows({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: ["VIP"],
    });
    expect(rows[0]!.zones.from_4000_to_6000.sold).toBe(1);
    expect(rows[0]!.totals.sold).toBe(1);
    expect(rows[0]!.zones.up_to_1500.sold).toBe(0);
  });

  it("9. illegal filter combo has no allowed intersection", () => {
    expect(
      hasAllowedFilterIntersection(["from_1500_to_2500"], ["VIP"]),
    ).toBe(false);
    expect(
      hasAllowedFilterIntersection(["up_to_1500"], ["VIP"]),
    ).toBe(false);
    const rows = buildMatrixRows({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: ["from_1500_to_2500"],
      localSectors: ["VIP"],
    });
    expect(rows).toEqual([]);
  });
});

describe("empty allowed vs illegal combos", () => {
  it("10. empty allowed combo with ticket mass is zeros at cell level, not a tree row", () => {
    const availability = buildAvailabilityIndex(matchesById);
    const emptySlice = new Map();
    const empty = resolveAllowedCell(
      "m1",
      "B2",
      "from_2500_to_4000",
      emptySlice,
      availability,
    );
    expect(empty.kind).toBe("zeros");
    expect(empty.sold).toBe(0);
    expect(empty.free).toBe(0);
    expect(empty.issued).toBe(0);
    expect(empty.revenue).toBe(0);
    expect(empty.occupancy).toBe(0);
  });

  it("10b. empty allowed combo with no mass shows em dash", () => {
    const noCap: Match = { ...MATCHES[0]!, id: "m0", capacity: 0 };
    const noCapById = new Map([[noCap.id, noCap]]);
    const availability = buildAvailabilityIndex(noCapById);
    const empty = resolveAllowedCell(
      "m0",
      "C4",
      "from_2500_to_4000",
      new Map(),
      availability,
    );
    expect(empty.kind).toBe("dash");
    expect(empty.sold).toBeNull();
    expect(empty.occupancy).toBeNull();
    expect(empty.revenue).toBeNull();
  });

  it("11. illegal combos are never created even at zero", () => {
    expect(inferChildZonesForSector("m1", "A")).not.toContain("from_4000_to_6000");
    expect(inferChildZonesForSector("m1", "VIP")).not.toEqual(
      expect.arrayContaining(NON_VIP_PRICE_ZONES),
    );
    expect(inferChildSectorsForZone("m1", "from_4000_to_6000")).toEqual(["VIP"]);
    const invalid: Transaction[] = [
      tx("bad-vip", "VIP", "from_1500_to_2500", 2000, 1),
      tx("bad-a", "A", "from_4000_to_6000", 5000, 1),
    ];
    const agg = preAggregateZoneSector(invalid, matchesById);
    expect(agg.size).toBe(0);
    expect(agg.has("m1|VIP|from_1500_to_2500")).toBe(false);
    expect(agg.has("m1|A|from_4000_to_6000")).toBe(false);
  });
});

describe("match totals and hierarchy invariance", () => {
  it("12. sum of sectors equals match total", () => {
    const agg = preAggregateZoneSector(TXS, matchesById);
    const bySectors = sumMatchBySectors("m1", agg);
    const matchTotal = [...agg.values()].reduce(
      (sum, cell) => sum + cell.revenue,
      0,
    );
    expect(bySectors.revenue).toBe(matchTotal);
    expect(bySectors.sold).toBe(9);
  });

  it("13. sum of price zones equals match total", () => {
    const agg = preAggregateZoneSector(TXS, matchesById);
    const byZones = sumMatchByZones("m1", agg);
    const bySectors = sumMatchBySectors("m1", agg);
    expect(byZones.revenue).toBe(bySectors.revenue);
    expect(byZones.sold).toBe(bySectors.sold);
    expect(byZones.issued).toBe(bySectors.issued);
    const rows = buildMatrixRows({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
    });
    const sumZones = Object.values(rows[0]!.zones).reduce((sum, z) => sum + z.revenue, 0);
    expect(sumZones).toBe(rows[0]!.totals.revenue);
    expect(sumZones).toBe(byZones.revenue);
  });

  it("14. switching hierarchy direction does not change totals", () => {
    const agg = preAggregateZoneSector(TXS, matchesById);
    const sectorView = sumMatchBySectors("m1", agg);
    const zoneView = sumMatchByZones("m1", agg);
    expect(sectorView).toEqual(zoneView);
    const vipOnlySectors = sumMatchBySectors("m1", agg, [], ["VIP"]);
    const vipOnlyZones = sumMatchByZones("m1", agg, ["from_4000_to_6000"], []);
    expect(vipOnlySectors).toEqual(vipOnlyZones);
  });

  it("15. invalid source combos are diagnosed and excluded", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mixed: Transaction[] = [
      ...TXS,
      tx("illegal-vip-low", "VIP", "up_to_1500", 800, 1),
      tx("illegal-a-top", "A", "from_4000_to_6000", 4500, 1),
    ];
    const invalid = collectInvalidSectorPriceZoneRecords(mixed);
    expect(invalid).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "illegal-vip-low",
          sector: "VIP",
          priceZone: "up_to_1500",
        }),
        expect.objectContaining({
          id: "illegal-a-top",
          sector: "A",
          priceZone: "from_4000_to_6000",
        }),
      ]),
    );
    expect(invalid).toHaveLength(2);

    const agg = preAggregateZoneSector(mixed, matchesById);
    expect(agg.has("m1|VIP|up_to_1500")).toBe(false);
    expect(agg.has("m1|A|from_4000_to_6000")).toBe(false);
    expect(agg.get("m1|VIP|from_4000_to_6000")?.revenue).toBe(5000);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]![0])).toMatch(/2 invalid sector×priceZone/);
  });
});

describe("tickets-zone-sector analytics", () => {
  it("aggregates match×sector×zone and computes averages", () => {
    const map = preAggregateZoneSector(TXS, matchesById);
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
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
    });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    const sumZones = Object.values(row.zones).reduce((sum, z) => sum + z.revenue, 0);
    expect(sumZones).toBe(row.totals.revenue);
    expect(row.totals.sold).toBe(9);
    expect(row.totals.avgPrice).toBeCloseTo(row.totals.revenue / row.totals.sold);
  });

  it("computes three occupancy formulas and em dash conditions", () => {
    const availability = {
      zoneInMatch: new Map([["m1|from_1500_to_2500", 10]]),
      sectorInMatch: new Map([["m1|A", 6]]),
      zoneInSector: new Map([["m1|A|from_1500_to_2500", 4]]),
      leftoverByMatch: new Map([["m1", 0]]),
    };
    const aOcc = computeOccupancy(
      "m1",
      "A",
      "from_1500_to_2500",
      { inZone: 3, inSector: 3, inCombo: 3 },
      availability,
    );
    expect(aOcc.zoneInMatch).toBe(30);
    expect(aOcc.sectorInMatch).toBe(50);
    expect(aOcc.zoneInSector).toBe(75);
    const miss = computeOccupancy(
      "m1",
      "D4",
      "up_to_1500",
      { inZone: 1, inSector: 1, inCombo: 1 },
      availability,
    );
    expect(miss.zoneInMatch).toBeNull();
    expect(miss.sectorInMatch).toBeNull();
    expect(miss.zoneInSector).toBeNull();
  });

  it("keeps VIP only in top zone in fixture", () => {
    const rows = buildMatrixRows({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: ["VIP"],
    });
    expect(rows[0]!.zones.from_4000_to_6000.sold).toBe(1);
    expect(rows[0]!.zones.up_to_1500.sold).toBe(0);
  });

  it("does not merge B/C/D groups — each sector is distinct", () => {
    expect(NON_VIP_SECTORS).toEqual([
      "A",
      "B1",
      "B2",
      "B3",
      "B4",
      "C1",
      "C2",
      "C3",
      "C4",
      "D1",
      "D2",
      "D3",
      "D4",
    ]);
    expect(ALL_SECTORS.filter((sector) => sector.startsWith("B"))).toHaveLength(4);
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
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
    });
    const elapsed = Date.now() - started;
    expect(rows.length).toBe(1);
    expect(elapsed).toBeLessThan(1200);
  });
});

describe("automatic sales slice by match completion", () => {
  const completed: Match = {
    ...MATCHES[0]!,
    id: "done",
    date: new Date(2026, 4, 10),
    eventCompleted: true,
  };
  const unfinished: Match = {
    ...MATCHES[0]!,
    id: "open",
    date: new Date(2026, 4, 10),
    eventCompleted: false,
  };
  const mixedById = new Map<string, Match>([
    [completed.id, completed],
    [unfinished.id, unfinished],
  ]);

  it("selects final for completed matches and current for unfinished", () => {
    expect(effectiveSliceForMatch(completed)).toBe("final");
    expect(effectiveSliceForMatch(unfinished)).toBe("current");
  });

  it("completed matches use final sales and drop post-match-day transactions", () => {
    const txs: Transaction[] = [
      tx("done-before", "A", "from_1500_to_2500", 3000, 2, {
        matchId: "done",
        date: new Date(2026, 4, 9),
      }),
      tx("done-after", "A", "from_1500_to_2500", 1500, 1, {
        matchId: "done",
        date: new Date(2026, 4, 12),
      }),
    ];
    const agg = preAggregateZoneSector(txs, mixedById);
    expect(agg.get("done|A|from_1500_to_2500")).toMatchObject({
      revenue: 3000,
      sold: 2,
    });
  });

  it("unfinished matches keep the current snapshot and are not forecasted", () => {
    const txs: Transaction[] = [
      tx("open-before", "A", "from_1500_to_2500", 2000, 1, {
        matchId: "open",
        date: new Date(2026, 4, 5),
      }),
      tx("open-after", "A", "from_1500_to_2500", 4000, 2, {
        matchId: "open",
        date: new Date(2026, 4, 12),
      }),
    ];
    const agg = preAggregateZoneSector(txs, mixedById);
    expect(agg.get("open|A|from_1500_to_2500")).toMatchObject({
      revenue: 6000,
      sold: 3,
    });
    const rows = buildMatrixRows({
      transactions: txs,
      matchesById: mixedById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
    });
    expect(rows.find((row) => row.matchId === "open")?.totals.sold).toBe(3);
  });

  it("applies the per-match slice in a mixed completed/unfinished set", () => {
    const txs: Transaction[] = [
      tx("done-before", "A", "from_1500_to_2500", 3000, 2, {
        matchId: "done",
        date: new Date(2026, 4, 9),
      }),
      tx("done-after", "A", "from_1500_to_2500", 1500, 1, {
        matchId: "done",
        date: new Date(2026, 4, 12),
      }),
      tx("open-now", "A", "from_1500_to_2500", 2000, 1, {
        matchId: "open",
        date: new Date(2026, 4, 5),
      }),
    ];
    const rows = buildMatrixRows({
      transactions: txs,
      matchesById: mixedById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
    });
    expect(rows.find((row) => row.matchId === "done")?.totals.sold).toBe(2);
    expect(rows.find((row) => row.matchId === "open")?.totals.sold).toBe(1);
  });
});

describe("zone-sector hierarchical tree", () => {
  const treeOptions = {
    transactions: TXS,
    matchesById,
    localMatchIds: [] as string[],
    localPriceZones: [] as PriceZone[],
    localSectors: [] as Sector[],
  };

  it("zones mode is match → allowed zones → allowed sectors", () => {
    const tree = buildZoneSectorTree({ ...treeOptions, mode: "zones_to_sectors" });
    expect(tree).toHaveLength(1);
    const match = tree[0]!;
    expect(match.children.map((child) => child.zoneId)).toEqual([
      "up_to_1500",
      "from_1500_to_2500",
      "from_2500_to_4000",
      "from_4000_to_6000",
    ]);
    const topZone = match.children.find((child) => child.zoneId === "from_4000_to_6000")!;
    expect(topZone.children.map((leaf) => leaf.sectorId)).toEqual(["VIP"]);
    const lowZone = match.children.find((child) => child.zoneId === "up_to_1500")!;
    expect(lowZone.children.map((leaf) => leaf.sectorId)).toEqual(["A", "C2"]);
    expect(lowZone.children.some((leaf) => leaf.sectorId === "VIP")).toBe(false);
    const midZone = match.children.find((child) => child.zoneId === "from_1500_to_2500")!;
    expect(midZone.children.map((leaf) => leaf.sectorId)).toEqual(["A", "D4"]);
    expect(
      midZone.children.every((leaf) => (leaf.issued ?? 0) > 0 || (leaf.revenue ?? 0) > 0),
    ).toBe(true);
  });

  it("sectors mode is match → allowed sectors → allowed zones", () => {
    const tree = buildZoneSectorTree({ ...treeOptions, mode: "sectors_to_zones" });
    const match = tree[0]!;
    expect(match.children.map((child) => child.sectorId)).toEqual([
      "A",
      "B1",
      "C2",
      "D4",
      "VIP",
    ]);
    const sectorA = match.children.find((child) => child.sectorId === "A")!;
    expect(sectorA.children.map((leaf) => leaf.zoneId)).toEqual(NON_VIP_PRICE_ZONES);
    expect(sectorA.children.some((leaf) => leaf.zoneId === "from_4000_to_6000")).toBe(false);
    const vip = match.children.find((child) => child.sectorId === "VIP")!;
    expect(vip.children.map((leaf) => leaf.zoneId)).toEqual(["from_4000_to_6000"]);
  });

  it("zone and sector rollups equal the match total", () => {
    const zoneTree = buildZoneSectorTree({ ...treeOptions, mode: "zones_to_sectors" });
    const sectorTree = buildZoneSectorTree({ ...treeOptions, mode: "sectors_to_zones" });
    const zoneMatch = zoneTree[0]!;
    const sectorMatch = sectorTree[0]!;
    const zoneSum = zoneMatch.children.reduce((sum, child) => sum + (child.revenue ?? 0), 0);
    const sectorSum = sectorMatch.children.reduce((sum, child) => sum + (child.revenue ?? 0), 0);
    expect(zoneSum).toBe(zoneMatch.revenue);
    expect(sectorSum).toBe(sectorMatch.revenue);
    expect(zoneMatch.revenue).toBe(sectorMatch.revenue);
  });

  it("flatten omits collapsed children from the row list", () => {
    const tree = buildZoneSectorTree({ ...treeOptions, mode: "zones_to_sectors" });
    const collapsed = flattenZoneSectorTree(tree, new Set());
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.level).toBe("match");
    const matchId = tree[0]!.id;
    const expandedMatch = flattenZoneSectorTree(tree, new Set([matchId]));
    expect(expandedMatch.some((row) => row.level === "section")).toBe(true);
    expect(expandedMatch.some((row) => row.level === "leaf")).toBe(false);
  });

  it("does not create illegal sector×zone rows even at zero", () => {
    const tree = buildZoneSectorTree({ ...treeOptions, mode: "zones_to_sectors" });
    const illegal = flattenZoneSectorTree(
      tree,
      new Set(tree.flatMap((match) => [match.id, ...match.children.map((child) => child.id)])),
    ).filter(
      (row) =>
        row.level === "leaf" &&
        row.sectorId &&
        row.zoneId &&
        !isAllowedSectorPriceZone(row.sectorId, row.zoneId),
    );
    expect(illegal).toEqual([]);
  });

  it("match tree keeps children empty until hydrate", () => {
    const agg = preAggregateZoneSector(TXS, matchesById);
    const ctx = {
      agg,
      availability: buildAvailabilityIndex(matchesById, agg),
      matchesById,
      localMatchIds: [] as string[],
      localPriceZones: [] as PriceZone[],
      localSectors: [] as Sector[],
    };
    const matchTree = buildZoneSectorMatchTree(ctx);
    expect(matchTree).toHaveLength(1);
    expect(matchTree[0]!.children).toEqual([]);
    expect(matchTree[0]!.hasChildren).toBe(true);
    expect(matchTree[0]!.revenue).toBeGreaterThan(0);

    const hydrated = hydrateZoneSectorTree(matchTree, {
      ...ctx,
      mode: "zones_to_sectors",
    });
    expect(matchTree[0]!.children).toEqual([]);
    expect(hydrated[0]!.children.length).toBeGreaterThan(0);
    expect(hydrated[0]!.revenue).toBe(matchTree[0]!.revenue);
  });

  it("hydrate of a page does not attach children to other matches", () => {
    const extraMatches: Match[] = Array.from({ length: 40 }, (_, idx) => ({
      ...MATCHES[0]!,
      id: `page-m${idx + 1}`,
      opponent: `Opp ${idx + 1}`,
      date: new Date(2026, 4, 20),
    }));
    const extraById = new Map(extraMatches.map((match) => [match.id, match]));
    const extraTxs: Transaction[] = extraMatches.flatMap((match) => [
      tx(`${match.id}-a`, "A", "from_1500_to_2500", 3000, 2, { matchId: match.id }),
      tx(`${match.id}-vip`, "VIP", "from_4000_to_6000", 5000, 1, { matchId: match.id }),
    ]);
    const agg = preAggregateZoneSector(extraTxs, extraById);
    const ctx = {
      agg,
      availability: buildAvailabilityIndex(extraById, agg),
      matchesById: extraById,
      localMatchIds: [] as string[],
      localPriceZones: [] as PriceZone[],
      localSectors: [] as Sector[],
    };
    const matchTree = buildZoneSectorMatchTree(ctx);
    expect(matchTree).toHaveLength(40);
    expect(matchTree.every((node) => node.children.length === 0)).toBe(true);

    const page = matchTree.slice(0, 15);
    const hydratedPage = hydrateZoneSectorTree(page, {
      ...ctx,
      mode: "zones_to_sectors",
    });
    expect(hydratedPage).toHaveLength(15);
    expect(hydratedPage.every((node) => node.children.length > 0)).toBe(true);
    expect(matchTree.every((node) => node.children.length === 0)).toBe(true);
    const collapsed = flattenZoneSectorTree(hydratedPage, new Set());
    expect(collapsed).toHaveLength(15);
    expect(collapsed.every((row) => row.level === "match")).toBe(true);
  });
});

describe("sector capacity occupancy (not issued/issued)", () => {
  const agg = preAggregateZoneSector(TXS, matchesById);
  const availability = buildAvailabilityIndex(matchesById, agg);

  it("does not use issued as the availability denominator", () => {
    const combo = comboKey("m1", "A", "from_1500_to_2500");
    const issued = agg.get(combo)!.issued;
    const mass = availability.zoneInSector.get(combo)!;
    expect(issued).toBe(3);
    expect(mass).toBeGreaterThan(issued);
    expect(mass).not.toBe(issued);
    expect(occupancyPercent(issued, mass)).not.toBe(100);
  });

  it("produces different occupancy % across combos, not all 100%", () => {
    const tree = buildZoneSectorTree({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "sectors_to_zones",
    });
    const leaves = tree[0]!.children.flatMap((section) => section.children);
    const occupancies = leaves
      .filter((leaf) => leaf.kind === "values")
      .map((leaf) => leaf.occupancy);
    expect(occupancies.length).toBeGreaterThan(1);
    expect(occupancies.every((value) => value != null && value !== 100)).toBe(true);
    expect(new Set(occupancies.map((value) => value!.toFixed(4))).size).toBeGreaterThan(1);

    const sectorA = tree[0]!.children.find((child) => child.sectorId === "A")!;
    const mid = sectorA.children.find((leaf) => leaf.zoneId === "from_1500_to_2500")!;
    const aMass = getComboAvailableMass(MATCHES[0]!, "A", "from_1500_to_2500");
    expect(aMass).toBe(320);
    expect(mid.issued).toBe(3);
    expect(mid.occupancy).toBeCloseTo((3 / 320) * 100);
    expect(sectorA.occupancy).toBeCloseTo((5 / 800) * 100);
  });

  it("uses match.capacity for match occupancy, not issued", () => {
    const tree = buildZoneSectorTree({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    const match = tree[0]!;
    expect(match.issued).toBe(10);
    expect(match.occupancy).toBeCloseTo((10 / 12_000) * 100);
    expect(match.occupancy).not.toBe(100);
  });

  it("returns null occupancy when mass is missing or 0", () => {
    expect(occupancyPercent(5, 0)).toBeNull();
    const noCap: Match = { ...MATCHES[0]!, id: "m0", capacity: 0 };
    const tree = buildZoneSectorTree({
      transactions: [tx("zero-cap", "A", "from_1500_to_2500", 3000, 2, { matchId: "m0" })],
      matchesById: new Map([[noCap.id, noCap]]),
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    expect(tree[0]!.occupancy).toBeNull();
    const zone = tree[0]!.children.find((child) => child.zoneId === "from_1500_to_2500");
    expect(zone?.occupancy).toBeNull();
  });

  it("sums combo masses to match.capacity with leftover 0", () => {
    let comboSum = 0;
    for (const mass of availability.zoneInSector.values()) comboSum += mass;
    expect(comboSum).toBe(12_000);
    expect(availability.leftoverByMatch.get("m1")).toBe(0);

    let sectorSum = 0;
    for (const mass of availability.sectorInMatch.values()) sectorSum += mass;
    expect(sectorSum).toBe(12_000);
    expect(sectorSum).toBe(sumSectorCapacities(MAIN_ARENA_SECTOR_CAPACITY));
  });

  it("splits non-VIP sector capacity across three zones and VIP into 4000–6000 only", () => {
    const splitA = splitSectorCapacity("A", 800);
    expect(splitA.up_to_1500).toBe(240);
    expect(splitA.from_1500_to_2500).toBe(320);
    expect(splitA.from_2500_to_4000).toBe(240);
    expect(
      (splitA.up_to_1500 ?? 0) +
        (splitA.from_1500_to_2500 ?? 0) +
        (splitA.from_2500_to_4000 ?? 0),
    ).toBe(800);
    expect(splitA.from_4000_to_6000).toBeUndefined();

    const splitVip = splitSectorCapacity("VIP", 400);
    expect(splitVip).toEqual({ from_4000_to_6000: 400 });
    expect(leftoverSectorCapacity(MATCHES[0]!)).toBe(0);
  });

  it("hides zero-sale leaves and empty parent sections", () => {
    const tree = buildZoneSectorTree({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    const rows = flattenZoneSectorTree(
      tree,
      new Set(tree.flatMap((match) => [match.id, ...match.children.map((child) => child.id)])),
    );
    const zeroRows = rows.filter(
      (row) => row.level !== "match" && (row.issued ?? 0) === 0 && (row.revenue ?? 0) === 0,
    );
    expect(zeroRows).toEqual([]);
    expect(rows.some((row) => row.sectorId === "C1")).toBe(false);
    expect(rows.some((row) => row.sectorId === "B2")).toBe(false);
  });

  it("reallocates oversold zone mass so leaf occupancy is ≤ 100% and not issued/issued", () => {
    const oversold: Transaction[] = [
      tx("os-a", "A", "from_1500_to_2500", 1_000_000, 540),
      tx("os-b1", "B1", "from_1500_to_2500", 900_000, 500),
      tx("os-b2", "B2", "from_1500_to_2500", 880_000, 490),
      tx("os-b3", "B3", "from_1500_to_2500", 860_000, 480),
      tx("os-b4", "B4", "from_1500_to_2500", 840_000, 470),
    ];
    const tree = buildZoneSectorTree({
      transactions: oversold,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    const match = tree[0]!;
    const mid = match.children.find((child) => child.zoneId === "from_1500_to_2500")!;
    expect(mid.children.map((leaf) => leaf.sectorId)).toEqual(["A", "B1", "B2", "B3", "B4"]);
    expect(mid.children.some((leaf) => leaf.sectorId?.startsWith("C"))).toBe(false);
    expect(mid.children.some((leaf) => leaf.sectorId?.startsWith("D"))).toBe(false);

    for (const leaf of mid.children) {
      expect(leaf.occupancy).not.toBeNull();
      expect(leaf.occupancy!).toBeLessThanOrEqual(100);
      expect(leaf.issued).toBeGreaterThan(0);
      const combo = comboKey("m1", leaf.sectorId!, "from_1500_to_2500");
      const leafAgg = preAggregateZoneSector(oversold, matchesById);
      const availability = buildAvailabilityIndex(matchesById, leafAgg);
      const mass = availability.zoneInSector.get(combo)!;
      expect(mass).toBeGreaterThanOrEqual(leaf.issued!);
      expect(leaf.occupancy).toBeCloseTo(
        Math.min(100, (leaf.issued! / mass) * 100),
      );
    }

    expect(mid.occupancy).not.toBeNull();
    expect(mid.occupancy!).toBeLessThanOrEqual(100);
    expect(mid.occupancy!).toBeLessThan(mid.children[0]!.occupancy!);
  });

  it("caps occupancy at 100% when issued exceeds sector capacity", () => {
    const overflow: Transaction[] = [
      tx("overflow-a", "A", "from_1500_to_2500", 2_000_000, 900),
    ];
    const tree = buildZoneSectorTree({
      transactions: overflow,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "sectors_to_zones",
    });
    const sectorA = tree[0]!.children.find((child) => child.sectorId === "A")!;
    expect(sectorA.issued).toBe(900);
    expect(sectorA.occupancy).toBe(100);
    const leaf = sectorA.children.find((child) => child.zoneId === "from_1500_to_2500")!;
    expect(leaf.occupancy).toBe(100);
    const overflowAgg = preAggregateZoneSector(overflow, matchesById);
    const overflowAvailability = buildAvailabilityIndex(matchesById, overflowAgg);
    expect(overflowAvailability.zoneInSector.get(comboKey("m1", "A", "from_1500_to_2500"))).toBe(
      800,
    );
  });
});

describe("class_1 and playoff sellout occupancy", () => {
  function soldOutMatch(
    id: string,
    extras: Partial<Match>,
  ): Match {
    return {
      ...MATCHES[0]!,
      id,
      ...extras,
    };
  }

  it("treats class_1 and playoff as sold-out occupancy matches", () => {
    expect(isSoldOutOccupancyMatch({ matchClass: "class_1" })).toBe(true);
    expect(
      isSoldOutOccupancyMatch({ matchClass: "playoff", tournamentStage: "playoff" }),
    ).toBe(true);
    expect(
      isSoldOutOccupancyMatch({ matchClass: "class_2", tournamentStage: "playoff" }),
    ).toBe(true);
    expect(
      isSoldOutOccupancyMatch({ matchClass: "class_2", tournamentStage: "regular" }),
    ).toBe(false);
    expect(
      isSoldOutOccupancyMatch({ matchClass: "class_3", tournamentStage: "regular" }),
    ).toBe(false);
  });

  it("fills class_1 matches to 100% occupancy with no zero rows", () => {
    const match = soldOutMatch("c1", { matchClass: "class_1", opponent: "СКА" });
    const byId = new Map([[match.id, match]]);
    const txs = fillMatchInventory(match);
    const tree = buildZoneSectorTree({
      transactions: txs,
      matchesById: byId,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    const root = tree[0]!;
    expect(root.issued).toBe(match.capacity);
    expect(root.occupancy).toBeCloseTo(100);
    const rows = flattenZoneSectorTree(
      tree,
      new Set(tree.flatMap((node) => [node.id, ...node.children.map((child) => child.id)])),
    );
    expect(
      rows.some((row) => (row.issued ?? 0) === 0 && (row.revenue ?? 0) === 0),
    ).toBe(false);
    for (const row of rows) {
      expect(row.occupancy).not.toBeNull();
      expect(row.occupancy!).toBeCloseTo(100);
      expect(row.occupancy!).toBeLessThanOrEqual(100);
    }
  });

  it("fills playoff matches to 100% occupancy", () => {
    const match = soldOutMatch("po", {
      matchClass: "playoff",
      tournamentStage: "playoff",
      opponent: "Динамо Мск",
    });
    const byId = new Map([[match.id, match]]);
    const tree = buildZoneSectorTree({
      transactions: fillMatchInventory(match),
      matchesById: byId,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "sectors_to_zones",
    });
    expect(tree[0]!.occupancy).toBeCloseTo(100);
    for (const section of tree[0]!.children) {
      expect(section.occupancy).toBeCloseTo(100);
      for (const leaf of section.children) {
        expect(leaf.occupancy).toBeCloseTo(100);
      }
    }
  });

  it("does not force class_2 / class_3 occupancy to 100%", () => {
    const class2 = buildZoneSectorTree({
      transactions: TXS,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    expect(isSoldOutOccupancyMatch(MATCHES[0]!)).toBe(false);
    expect(class2[0]!.occupancy).toBeCloseTo((10 / 12_000) * 100);
    expect(class2[0]!.occupancy).not.toBe(100);

    const class3 = soldOutMatch("c3", {
      matchClass: "class_3",
      tournamentStage: "regular",
    });
    const class3Tree = buildZoneSectorTree({
      transactions: [
        tx("c3-a", "A", "from_1500_to_2500", 3000, 2, { matchId: "c3" }),
      ],
      matchesById: new Map([[class3.id, class3]]),
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    expect(isSoldOutOccupancyMatch(class3)).toBe(false);
    expect(class3Tree[0]!.occupancy).toBeLessThan(100);
  });
});


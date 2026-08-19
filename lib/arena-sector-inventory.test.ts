import { describe, expect, it } from "vitest";
import {
  MAIN_ARENA_SECTOR_CAPACITY,
  MHL_ARENA_SECTOR_CAPACITY,
  SECONDARY_ARENA_SECTOR_CAPACITY,
  allocateIntegerSharesWithBounds,
  getSectorCapacitiesForMatch,
  leftoverSectorCapacity,
  splitSectorCapacity,
  splitSectorCapacityForDemand,
  sumSectorCapacities,
} from "@/lib/arena-sector-inventory";
import {
  ALL_SECTORS,
  allowedPriceZonesForSector,
} from "@/lib/ticket-filter-options";
import {
  MAIN_ARENA_CAPACITY,
  MHL_ARENA_CAPACITY,
  SECONDARY_ARENA_CAPACITY,
} from "@/lib/ticket-plan";
import type { Match } from "@/types/dashboard";

const MAIN_MATCH: Pick<Match, "arena" | "league" | "capacity"> = {
  arena: "main",
  league: "KHL",
  capacity: MAIN_ARENA_CAPACITY,
};

describe("arena sector inventory", () => {
  it("main / secondary / MHL maps sum to arena capacity with leftover 0", () => {
    expect(sumSectorCapacities(MAIN_ARENA_SECTOR_CAPACITY)).toBe(MAIN_ARENA_CAPACITY);
    expect(sumSectorCapacities(SECONDARY_ARENA_SECTOR_CAPACITY)).toBe(
      SECONDARY_ARENA_CAPACITY,
    );
    expect(sumSectorCapacities(MHL_ARENA_SECTOR_CAPACITY)).toBe(MHL_ARENA_CAPACITY);
    expect(leftoverSectorCapacity(MAIN_MATCH)).toBe(0);
  });

  it("keeps VIP small, A medium, and D as the largest bowl", () => {
    const map = MAIN_ARENA_SECTOR_CAPACITY;
    expect(map.VIP).toBe(400);
    expect(map.A).toBe(800);
    expect(map.VIP).toBeLessThan(map.A);
    const b = map.B1 + map.B2 + map.B3 + map.B4;
    const c = map.C1 + map.C2 + map.C3 + map.C4;
    const d = map.D1 + map.D2 + map.D3 + map.D4;
    expect(d).toBeGreaterThan(b);
    expect(d).toBeGreaterThan(c);
    expect(d).toBeGreaterThan(map.A);
  });

  it("covers all 14 sectors and splits only allowed zones", () => {
    expect(ALL_SECTORS).toHaveLength(14);
    for (const sector of ALL_SECTORS) {
      const cap = MAIN_ARENA_SECTOR_CAPACITY[sector];
      const split = splitSectorCapacity(sector, cap);
      const splitSum = Object.values(split).reduce((sum, value) => sum + value, 0);
      expect(splitSum).toBe(cap);
      expect(Object.keys(split).sort()).toEqual(
        allowedPriceZonesForSector(sector).slice().sort(),
      );
    }
  });

  it("uses the shared venue map for KHL main-arena matches", () => {
    expect(getSectorCapacitiesForMatch(MAIN_MATCH)).toEqual(MAIN_ARENA_SECTOR_CAPACITY);
  });

  it("enlarges an oversold zone from unused zones in the same sector", () => {
    const planned = splitSectorCapacity("A", 800);
    expect(planned.from_1500_to_2500).toBe(320);
    const split = splitSectorCapacityForDemand("A", 800, {
      from_1500_to_2500: 500,
    });
    expect(split.from_1500_to_2500).toBeGreaterThanOrEqual(500);
    expect(
      (split.up_to_1500 ?? 0) +
        (split.from_1500_to_2500 ?? 0) +
        (split.from_2500_to_4000 ?? 0),
    ).toBe(800);
    expect(split.up_to_1500).toBeGreaterThan(0);
    expect(split.from_2500_to_4000).toBeGreaterThan(0);
  });

  it("cannot exceed sector capacity when issued overflows the bowl", () => {
    const split = splitSectorCapacityForDemand("A", 800, {
      from_1500_to_2500: 900,
    });
    expect(split.from_1500_to_2500).toBe(800);
    expect(split.up_to_1500).toBe(0);
    expect(split.from_2500_to_4000).toBe(0);
  });

  it("keeps the planned split when issued fits inside it", () => {
    const planned = splitSectorCapacity("A", 800);
    const split = splitSectorCapacityForDemand("A", 800, {
      from_1500_to_2500: 3,
      up_to_1500: 1,
    });
    expect(split).toEqual(planned);
  });

  it("allocates with floors and caps so no item is left at 0 when total allows it", () => {
    const items = [
      { id: "a", weight: 90, min: 1, max: 10 },
      { id: "b", weight: 9, min: 1, max: 10 },
      { id: "c", weight: 1, min: 1, max: 10 },
    ];
    const allocated = allocateIntegerSharesWithBounds(6, items);
    expect(allocated.get("a")).toBeGreaterThanOrEqual(1);
    expect(allocated.get("b")).toBeGreaterThanOrEqual(1);
    expect(allocated.get("c")).toBeGreaterThanOrEqual(1);
    expect(
      [...allocated.values()].reduce((sum, value) => sum + value, 0),
    ).toBe(6);
    for (const item of items) {
      const value = allocated.get(item.id)!;
      expect(value).toBeGreaterThanOrEqual(item.min);
      expect(value).toBeLessThanOrEqual(item.max);
    }
  });
});

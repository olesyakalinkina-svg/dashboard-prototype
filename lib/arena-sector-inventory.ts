import {
  ALL_SECTORS,
  NON_VIP_PRICE_ZONES,
  allowedPriceZonesForSector,
} from "@/lib/ticket-filter-options";
import {
  MAIN_ARENA_CAPACITY,
  MHL_ARENA_CAPACITY,
  SECONDARY_ARENA_CAPACITY,
} from "@/lib/ticket-plan";
import type { Match, PriceZone, Sector, SectorCapacityMap } from "@/types/dashboard";

export type ArenaInventoryProfile = "main_full" | "main_partial" | "secondary";

/**
 * Non-VIP zone shares inside a sector. Weights are relative and must be
 * allocated so the three zones sum to that sector's capacity.
 * VIP is not split: 100% of VIP capacity is `from_4000_to_6000`.
 */
export const NON_VIP_ZONE_WEIGHTS = {
  A: { up_to_1500: 30, from_1500_to_2500: 40, from_2500_to_4000: 30 },
  B: { up_to_1500: 40, from_1500_to_2500: 35, from_2500_to_4000: 25 },
  C: { up_to_1500: 45, from_1500_to_2500: 35, from_2500_to_4000: 20 },
  D: { up_to_1500: 50, from_1500_to_2500: 35, from_2500_to_4000: 15 },
} as const;

/** Main arena full bowl. Sum = 12_000 = MAIN_ARENA_CAPACITY. VIP small, A medium, D largest. */
export const MAIN_ARENA_SECTOR_CAPACITY: SectorCapacityMap = {
  VIP: 400,
  A: 800,
  B1: 920,
  B2: 880,
  B3: 900,
  B4: 900,
  C1: 860,
  C2: 840,
  C3: 850,
  C4: 850,
  D1: 980,
  D2: 940,
  D3: 950,
  D4: 930,
};

/** Secondary arena. Sum = 3_000 = SECONDARY_ARENA_CAPACITY. */
export const SECONDARY_ARENA_SECTOR_CAPACITY: SectorCapacityMap = {
  VIP: 80,
  A: 220,
  B1: 240,
  B2: 230,
  B3: 225,
  B4: 225,
  C1: 230,
  C2: 220,
  C3: 215,
  C4: 215,
  D1: 240,
  D2: 230,
  D3: 220,
  D4: 210,
};

export function sumSectorCapacities(map: SectorCapacityMap): number {
  let sum = 0;
  for (const sector of ALL_SECTORS) sum += map[sector];
  return sum;
}

export function allocateIntegerShares(
  total: number,
  weights: ReadonlyArray<{ id: string; weight: number }>,
): Map<string, number> {
  const result = new Map<string, number>();
  if (weights.length === 0) return result;
  if (total <= 0) {
    for (const item of weights) result.set(item.id, 0);
    return result;
  }
  const weightSum = weights.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum <= 0) {
    for (const item of weights) result.set(item.id, 0);
    return result;
  }

  const rows = weights.map((item) => {
    const exact = (total * item.weight) / weightSum;
    const value = Math.floor(exact);
    return { id: item.id, value, frac: exact - value };
  });
  let leftover = total - rows.reduce((sum, row) => sum + row.value, 0);
  const ranked = [...rows].sort(
    (a, b) => b.frac - a.frac || a.id.localeCompare(b.id),
  );
  for (const row of ranked) {
    if (leftover <= 0) break;
    row.value += 1;
    leftover -= 1;
  }
  for (const row of rows) result.set(row.id, row.value);
  return result;
}

function scaleSectorMap(
  base: SectorCapacityMap,
  target: number,
): SectorCapacityMap {
  const allocated = allocateIntegerShares(
    target,
    ALL_SECTORS.map((sector) => ({ id: sector, weight: base[sector] })),
  );
  const out = {} as SectorCapacityMap;
  for (const sector of ALL_SECTORS) {
    out[sector] = allocated.get(sector) ?? 0;
  }
  return out;
}

/** MHL partial bowl on the main arena. Same sector shape, scaled to 6_300. Leftover 0. */
export const MHL_ARENA_SECTOR_CAPACITY: SectorCapacityMap = scaleSectorMap(
  MAIN_ARENA_SECTOR_CAPACITY,
  MHL_ARENA_CAPACITY,
);

export function arenaInventoryProfileForMatch(match: Pick<
  Match,
  "arena" | "league" | "capacity"
>): ArenaInventoryProfile | null {
  if (!(match.capacity > 0)) return null;
  if (match.arena === "secondary") return "secondary";
  if (match.league === "MHL") return "main_partial";
  return "main_full";
}

export function catalogSectorCapacities(
  profile: ArenaInventoryProfile,
): SectorCapacityMap {
  if (profile === "secondary") return SECONDARY_ARENA_SECTOR_CAPACITY;
  if (profile === "main_partial") return MHL_ARENA_SECTOR_CAPACITY;
  return MAIN_ARENA_SECTOR_CAPACITY;
}

export function getSectorCapacitiesForMatch(
  match: Pick<Match, "arena" | "league" | "capacity">,
): SectorCapacityMap | null {
  const profile = arenaInventoryProfileForMatch(match);
  if (!profile) return null;
  const catalog = catalogSectorCapacities(profile);
  const catalogSum = sumSectorCapacities(catalog);
  if (match.capacity === catalogSum) return catalog;
  return scaleSectorMap(catalog, match.capacity);
}

export function getSectorCapacity(
  match: Pick<Match, "arena" | "league" | "capacity">,
  sector: Sector,
): number {
  return getSectorCapacitiesForMatch(match)?.[sector] ?? 0;
}

function sectorBowlGroup(sector: Exclude<Sector, "VIP">): "A" | "B" | "C" | "D" {
  if (sector === "A") return "A";
  const bowl = sector[0];
  if (bowl === "B" || bowl === "C" || bowl === "D") return bowl;
  return "D";
}

export function splitSectorCapacity(
  sector: Sector,
  sectorCapacity: number,
): Partial<Record<PriceZone, number>> {
  const allowed = allowedPriceZonesForSector(sector);
  if (!(sectorCapacity > 0) || allowed.length === 0) return {};
  if (sector === "VIP") {
    return { from_4000_to_6000: sectorCapacity };
  }
  const weights = NON_VIP_ZONE_WEIGHTS[sectorBowlGroup(sector)];
  const allocated = allocateIntegerShares(
    sectorCapacity,
    (Object.keys(weights) as Array<keyof typeof weights>).map((zone) => ({
      id: zone,
      weight: weights[zone],
    })),
  );
  const out: Partial<Record<PriceZone, number>> = {};
  for (const zone of NON_VIP_PRICE_ZONES) {
    if (!allowed.includes(zone)) continue;
    out[zone] = allocated.get(zone) ?? 0;
  }
  return out;
}

/**
 * Split a sector so zone masses still sum to capacity, and each zone's
 * mass is at least its issued count when that fits in the sector.
 * Extra seats stay in unused / under-sold zones (zero-sale inventory first).
 */
export function splitSectorCapacityForDemand(
  sector: Sector,
  sectorCapacity: number,
  issuedByZone: Partial<Record<PriceZone, number>> = {},
): Partial<Record<PriceZone, number>> {
  const planned = splitSectorCapacity(sector, sectorCapacity);
  const allowed = allowedPriceZonesForSector(sector);
  if (!(sectorCapacity > 0) || allowed.length === 0) return planned;

  const issued: Partial<Record<PriceZone, number>> = {};
  let issuedSum = 0;
  for (const zone of allowed) {
    const qty = Math.max(0, Math.floor(issuedByZone[zone] ?? 0));
    issued[zone] = qty;
    issuedSum += qty;
  }
  if (issuedSum <= 0) return planned;

  if (issuedSum >= sectorCapacity) {
    const byDemand = allocateIntegerShares(
      sectorCapacity,
      allowed.map((zone) => ({ id: zone, weight: issued[zone] ?? 0 })),
    );
    const out: Partial<Record<PriceZone, number>> = {};
    for (const zone of allowed) out[zone] = byDemand.get(zone) ?? 0;
    return out;
  }

  const mass: Partial<Record<PriceZone, number>> = {};
  for (const zone of allowed) mass[zone] = planned[zone] ?? 0;

  type PoolItem = { zone: PriceZone; amount: number };
  const need: PoolItem[] = [];
  const surplusZeroSale: PoolItem[] = [];
  const surplusWithSales: PoolItem[] = [];
  for (const zone of allowed) {
    const plannedMass = mass[zone] ?? 0;
    const issuedMass = issued[zone] ?? 0;
    if (issuedMass > plannedMass) {
      need.push({ zone, amount: issuedMass - plannedMass });
    } else if (plannedMass > issuedMass) {
      const extra = plannedMass - issuedMass;
      if (issuedMass === 0) surplusZeroSale.push({ zone, amount: extra });
      else surplusWithSales.push({ zone, amount: extra });
    }
  }

  const takeFrom = (pool: PoolItem[], amount: number): number => {
    let remaining = amount;
    for (const item of pool) {
      if (remaining <= 0) break;
      const take = Math.min(item.amount, remaining);
      item.amount -= take;
      mass[item.zone] = (mass[item.zone] ?? 0) - take;
      remaining -= take;
    }
    return remaining;
  };

  for (const item of need) {
    let remaining = item.amount;
    remaining = takeFrom(surplusZeroSale, remaining);
    remaining = takeFrom(surplusWithSales, remaining);
    mass[item.zone] = (mass[item.zone] ?? 0) + (item.amount - remaining);
  }

  return mass;
}

export function getComboAvailableMass(
  match: Pick<Match, "arena" | "league" | "capacity">,
  sector: Sector,
  zone: PriceZone,
): number {
  if (!allowedPriceZonesForSector(sector).includes(zone)) return 0;
  const sectorCap = getSectorCapacity(match, sector);
  return splitSectorCapacity(sector, sectorCap)[zone] ?? 0;
}

export function leftoverSectorCapacity(
  match: Pick<Match, "arena" | "league" | "capacity">,
): number {
  const sectors = getSectorCapacitiesForMatch(match);
  if (!sectors) return match.capacity;
  return match.capacity - sumSectorCapacities(sectors);
}

export {
  MAIN_ARENA_CAPACITY,
  MHL_ARENA_CAPACITY,
  SECONDARY_ARENA_CAPACITY,
};
